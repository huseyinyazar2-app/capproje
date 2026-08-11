import assert from "node:assert/strict";
import { access } from "node:fs/promises";
import test from "node:test";
import worker from "../worker/index.js";

test("serves existing static assets without a fallback", async () => {
  const calls = [];
  const response = await worker.fetch(new Request("https://example.test/assets/app.js"), {
    ASSETS: {
      fetch: async (request) => {
        calls.push(new URL(request.url).pathname);
        return new Response("asset", { status: 200 });
      },
    },
  });

  assert.equal(response.status, 200);
  assert.deepEqual(calls, ["/assets/app.js"]);
});

test("falls back to index.html for an unknown app route", async () => {
  const calls = [];
  const response = await worker.fetch(
    new Request("https://example.test/flow/step-two?source=share", {
      headers: { accept: "text/html" },
    }),
    {
      ASSETS: {
        fetch: async (request) => {
          const url = new URL(request.url);
          calls.push(url.pathname + url.search);
          return new Response(url.pathname === "/index.html" ? "app" : "missing", {
            status: url.pathname === "/index.html" ? 200 : 404,
          });
        },
      },
    },
  );

  assert.equal(response.status, 200);
  assert.deepEqual(calls, ["/flow/step-two?source=share", "/index.html"]);
});

test("adds restrictive security headers to static assets and the app shell", async () => {
  const env = {
    ASSETS: {
      fetch: async (request) => {
        const path = new URL(request.url).pathname;
        return new Response(path === "/index.html" || path.startsWith("/assets/") ? "content" : "missing", {
          status: path === "/index.html" || path.startsWith("/assets/") ? 200 : 404,
        });
      },
    },
  };
  const responses = [
    await worker.fetch(new Request("https://example.test/assets/app.js"), env),
    await worker.fetch(new Request("https://example.test/projects", { headers: { accept: "text/html" } }), env),
  ];
  for (const response of responses) {
    const csp = response.headers.get("content-security-policy");
    assert.match(csp, /default-src 'self'/);
    assert.match(csp, /script-src 'self'/);
    assert.doesNotMatch(csp, /script-src[^;]*'unsafe-inline'/);
    assert.doesNotMatch(csp, /'unsafe-eval'/);
    assert.match(csp, /style-src 'self' 'unsafe-inline' https:\/\/fonts\.googleapis\.com/);
    assert.match(csp, /frame-ancestors 'none'/);
    assert.equal(response.headers.get("x-frame-options"), "DENY");
    assert.equal(response.headers.get("referrer-policy"), "strict-origin-when-cross-origin");
    assert.equal(response.headers.get("permissions-policy"), "camera=(), microphone=(), geolocation=(), payment=(), usb=()");
    assert.equal(response.headers.get("x-content-type-options"), "nosniff");
  }
});

test("keeps API responses non-cacheable", async () => {
  const response = await worker.fetch(new Request("https://example.test/api/v1/health"), { DB: { prepare: () => ({ first: async () => ({ ok: 1 }) }) } });
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.equal(response.headers.get("x-content-type-options"), "nosniff");
});

test("does not turn missing API or write requests into the app shell", async () => {
  for (const request of [
    new Request("https://example.test/api/missing", { headers: { accept: "application/json" } }),
    new Request("https://example.test/flow", { method: "POST", headers: { accept: "text/html" } }),
  ]) {
    let calls = 0;
    const response = await worker.fetch(request, {
      ASSETS: {
        fetch: async () => {
          calls += 1;
          return new Response("missing", { status: 404 });
        },
      },
    });

    assert.equal(response.status, 404);
    assert.equal(calls, 1);
  }
});

test("emits the files required by Sites packaging", async () => {
  await access(new URL("../dist/client/index.html", import.meta.url));
  await access(new URL("../dist/server/index.js", import.meta.url));
  await access(new URL("../dist/.openai/hosting.json", import.meta.url));
  await access(new URL("../dist/.openai/drizzle/0001_tenant_core.sql", import.meta.url));
});
