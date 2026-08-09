import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import test from "node:test";

const manifestUrl = new URL("../public/manifest.webmanifest", import.meta.url);
const serviceWorkerUrl = new URL("../public/sw.js", import.meta.url);
const mainUrl = new URL("../src/main.jsx", import.meta.url);
const workspaceUrl = new URL("../src/LiveWorkspace.jsx", import.meta.url);
const packagingUrl = new URL("../scripts/prepare-sites-build.mjs", import.meta.url);

const [manifestSource, serviceWorkerSource, mainSource, workspaceSource, packagingSource] = await Promise.all([
  readFile(manifestUrl, "utf8"),
  readFile(serviceWorkerUrl, "utf8"),
  readFile(mainUrl, "utf8"),
  readFile(workspaceUrl, "utf8"),
  readFile(packagingUrl, "utf8"),
]);

test("the web app manifest contains the fields and icons required for installation", () => {
  const manifest = JSON.parse(manifestSource);

  assert.ok(manifest.name);
  assert.ok(manifest.short_name);
  assert.equal(manifest.start_url, "/");
  assert.equal(manifest.scope, "/");
  assert.match(manifest.display, /^(standalone|minimal-ui|fullscreen)$/);
  assert.match(manifest.theme_color, /^#[0-9a-f]{6}$/i);
  assert.match(manifest.background_color, /^#[0-9a-f]{6}$/i);
  assert.ok(Array.isArray(manifest.icons), "installable manifest needs an icons array");

  for (const requiredSize of ["192x192", "512x512"]) {
    const icon = manifest.icons.find((item) => String(item.sizes || "").split(/\s+/).includes(requiredSize));
    assert.ok(icon, `manifest needs a ${requiredSize} icon`);
    assert.match(icon.src, /^\//);
    assert.match(icon.type || "", /^image\/(png|webp)$/);
  }
});

test("every manifest icon points to a packaged image file", async () => {
  const manifest = JSON.parse(manifestSource);

  for (const icon of manifest.icons || []) {
    const relativePath = String(icon.src || "").replace(/^\//, "");
    assert.ok(relativePath, "manifest icon src must not be empty");
    const bytes = await readFile(new URL(`../public/${relativePath}`, import.meta.url));
    assert.ok(bytes.length > 8, `${icon.src} must not be empty`);
    if (icon.type === "image/png") {
      assert.deepEqual([...bytes.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10], `${icon.src} must be a real PNG`);
    }
  }
});

test("the service worker is registered only for a production build", () => {
  assert.match(mainSource, /["']serviceWorker["']\s+in\s+navigator\s*&&\s*import\.meta\.env\.PROD/);
  assert.match(mainSource, /navigator\.serviceWorker\.register\(["']\/sw\.js["']\)/);
  assert.doesNotMatch(mainSource, /import\.meta\.env\.DEV[^\n]*serviceWorker\.register/);
});

test("API requests are never intercepted or stored by the service worker", () => {
  const apiGuard = serviceWorkerSource.indexOf('url.pathname.startsWith("/api/")');
  const respondWith = serviceWorkerSource.indexOf("event.respondWith");
  const cachePut = serviceWorkerSource.indexOf("cache.put");

  assert.ok(apiGuard >= 0, "service worker needs an explicit /api/ bypass");
  assert.ok(respondWith > apiGuard, "the API bypass must run before respondWith");
  assert.ok(cachePut > apiGuard, "the API bypass must run before cache writes");
  assert.doesNotMatch(serviceWorkerSource, /APP_SHELL\s*=\s*\[[^\]]*["']\/api\//s);
});

test("runtime shell caching is limited to same-origin GET requests", () => {
  assert.match(serviceWorkerSource, /request\.method\s*!==\s*["']GET["']/);
  assert.match(serviceWorkerSource, /url\.origin\s*!==\s*self\.location\.origin/);
  assert.ok(serviceWorkerSource.indexOf("request.method") < serviceWorkerSource.indexOf("event.respondWith"));
  assert.ok(serviceWorkerSource.indexOf("url.origin") < serviceWorkerSource.indexOf("event.respondWith"));
  assert.match(serviceWorkerSource, /response\.ok[^\n]*cache\.put\(request,\s*response\.clone\(\)\)/);
  assert.match(serviceWorkerSource, /caches\.match\(["']\/index\.html["']\)/);
});

test("offline mode visibly and programmatically blocks critical mutations", () => {
  assert.match(workspaceSource, /navigator\.onLine/);
  assert.match(workspaceSource, /addEventListener\(["']offline["']/);
  assert.match(workspaceSource, /canCreate\s*=\s*online\s*&&[^;]*permissionAllows/);
  assert.match(workspaceSource, /canEdit\s*=\s*online\s*&&[^;]*permissionAllows/);
  assert.match(workspaceSource, /async function save\([^)]*\)\s*\{\s*if\s*\(!online\)/);
  assert.match(workspaceSource, /Çevrimdışıyken kayıt değiştirilemez/);
});

test("every database migration is copied unchanged into the Sites package", async () => {
  assert.match(packagingSource, /path\.join\(root,\s*["']migrations["']\)/);
  assert.match(packagingSource, /path\.join\(dist,\s*["']\.openai["'],\s*["']drizzle["']\)/);
  assert.match(packagingSource, /cpSync\([^\n]*recursive:\s*true/);

  const sourceDirectory = new URL("../migrations/", import.meta.url);
  const packagedDirectory = new URL("../dist/.openai/drizzle/", import.meta.url);
  const sourceMigrations = (await readdir(sourceDirectory)).filter((name) => name.endsWith(".sql")).sort();
  const packagedMigrations = (await readdir(packagedDirectory)).filter((name) => name.endsWith(".sql")).sort();

  assert.ok(sourceMigrations.length > 0);
  assert.deepEqual(packagedMigrations, sourceMigrations);
  for (const fileName of sourceMigrations) {
    assert.equal(
      await readFile(new URL(fileName, packagedDirectory), "utf8"),
      await readFile(new URL(fileName, sourceDirectory), "utf8"),
      `${fileName} must be packaged without modification`,
    );
  }
});
