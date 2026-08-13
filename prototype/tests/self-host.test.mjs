import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { DatabaseSync } from "node:sqlite";
import worker from "../worker/index.js";
import { createDailySqliteBackup, createRuntime, FilesystemBucket, LocalD1Database, migrateLocalDatabase, startSelfHostedServer, StaticAssets } from "../server/index.mjs";

async function temporaryDirectory() {
  return mkdtemp(path.join(tmpdir(), "capproje-self-host-"));
}

test("local SQLite adapter applies every migration and rolls back failed batches", async (t) => {
  const directory = await temporaryDirectory();
  const databasePath = path.join(directory, "capproje.sqlite");
  const sqlite = new DatabaseSync(databasePath);
  t.after(() => sqlite.close());
  t.after(() => rm(directory, { recursive: true, force: true }));
  const migrations = await migrateLocalDatabase(sqlite);
  assert.equal(sqlite.prepare("SELECT COUNT(*) AS count FROM schema_migrations").get().count, migrations.length);
  assert.ok(migrations.length >= 10);
  const DB = new LocalD1Database(sqlite);
  assert.throws(() => DB.batch([
    DB.prepare("INSERT INTO tenants (id,name,slug,created_at,updated_at) VALUES (?,?,?,?,?)").bind("tenant-rollback", "Rollback", "rollback", "2026-08-11", "2026-08-11"),
    DB.prepare("INSERT INTO tenants (id,name,slug,created_at,updated_at) VALUES (?,?,?,?,?)").bind("tenant-duplicate", "Duplicate", "rollback", "2026-08-11", "2026-08-11"),
  ]));
  assert.equal(sqlite.prepare("SELECT COUNT(*) AS count FROM tenants WHERE slug='rollback'").get().count, 0);
});

test("filesystem bucket keeps objects inside its private root", async (t) => {
  const directory = await temporaryDirectory();
  t.after(() => rm(directory, { recursive: true, force: true }));
  const bucket = new FilesystemBucket(path.join(directory, "objects"));
  await bucket.put("tenant-a/projects/file.txt", "saha kanıtı");
  const stored = await bucket.get("tenant-a/projects/file.txt");
  assert.equal(stored.body.toString("utf8"), "saha kanıtı");
  assert.match(stored.httpEtag, /^"[a-f0-9]{64}"$/);
  await assert.rejects(() => bucket.put("../outside.txt", "blocked"));
  await bucket.delete("tenant-a/projects/file.txt");
  assert.equal(await bucket.get("tenant-a/projects/file.txt"), null);
});

test("static adapter serves the app shell without exposing parent files", async (t) => {
  const directory = await temporaryDirectory();
  t.after(() => rm(directory, { recursive: true, force: true }));
  const assets = path.join(directory, "client");
  await mkdir(assets, { recursive: true });
  await writeFile(path.join(assets, "index.html"), "<!doctype html><title>Capproje</title>");
  await writeFile(path.join(directory, "secret.txt"), "secret");
  const storage = new StaticAssets(assets);
  const index = await storage.fetch(new Request("https://example.test/index.html"));
  assert.equal(index.status, 200);
  assert.match(await index.text(), /Capproje/);
  const escaped = await storage.fetch(new Request("https://example.test/%2e%2e/secret.txt"));
  assert.equal(escaped.status, 404);
});

test("self-host health checks the database and reports file storage", async (t) => {
  const directory = await temporaryDirectory();
  const sqlite = new DatabaseSync(":memory:");
  t.after(() => sqlite.close());
  t.after(() => rm(directory, { recursive: true, force: true }));
  const response = await worker.fetch(new Request("https://example.test/api/v1/health"), {
    DB: new LocalD1Database(sqlite),
    FILES: new FilesystemBucket(path.join(directory, "objects")),
  });
  assert.equal(response.status, 200);
  assert.deepEqual((await response.json()).data.database, "ok");
  const failed = await worker.fetch(new Request("https://example.test/api/v1/health"), {
    DB: { prepare() { throw new Error("database offline"); } },
  });
  assert.equal(failed.status, 503);
});

test("daily SQLite backup creates a readable, date-scoped snapshot", async (t) => {
  const directory = await temporaryDirectory();
  const sqlite = new DatabaseSync(path.join(directory, "source.sqlite"));
  t.after(() => sqlite.close());
  t.after(() => rm(directory, { recursive: true, force: true }));
  sqlite.exec("CREATE TABLE evidence (id TEXT PRIMARY KEY, note TEXT); INSERT INTO evidence VALUES ('one','verified')");
  const destination = await createDailySqliteBackup(sqlite, path.join(directory, "backups"), 30, new Date("2026-08-11T04:00:00.000Z"));
  assert.match(destination, /capproje-2026-08-11\.sqlite$/);
  assert.ok((await readFile(destination)).byteLength > 0);
  const restored = new DatabaseSync(destination, { readOnly: true });
  assert.equal(restored.prepare("SELECT note FROM evidence WHERE id='one'").get().note, "verified");
  restored.close();
});

test("Node HTTP bridge serves API health and the SPA shell", async (t) => {
  const directory = await temporaryDirectory();
  const assetsDirectory = path.join(directory, "client");
  await mkdir(assetsDirectory, { recursive: true });
  await writeFile(path.join(assetsDirectory, "index.html"), "<!doctype html><title>Self hosted Capproje</title>");
  const sqlite = new DatabaseSync(":memory:");
  const runtime = {
    sqlite,
    env: {
      DB: new LocalD1Database(sqlite),
      FILES: new FilesystemBucket(path.join(directory, "objects")),
      ASSETS: new StaticAssets(assetsDirectory),
    },
  };
  const server = await startSelfHostedServer(runtime, { HOST: "127.0.0.1", PORT: "0" });
  t.after(() => new Promise((resolve) => server.close(async () => { await server.waitForBackgroundTasks(); resolve(); })));
  t.after(() => sqlite.close());
  t.after(() => rm(directory, { recursive: true, force: true }));
  const { port } = server.address();
  const health = await fetch(`http://127.0.0.1:${port}/api/v1/health`);
  assert.equal(health.status, 200);
  assert.equal((await health.json()).data.status, "ok");
  const shell = await fetch(`http://127.0.0.1:${port}/projects`, { headers: { accept: "text/html" } });
  assert.equal(shell.status, 200);
  assert.match(await shell.text(), /Self hosted Capproje/);
});

test("self-host server refuses accidental direct public binding", async () => {
  await assert.rejects(() => startSelfHostedServer({ env: {} }, { HOST: "0.0.0.0", PORT: "0" }), /doğrudan genel ağa açılamaz/);
});

test("self-host Turso runtime requires remote database credentials", async (t) => {
  const directory = await temporaryDirectory();
  const assetsDirectory = path.join(directory, "client");
  await mkdir(assetsDirectory, { recursive: true });
  await writeFile(path.join(assetsDirectory, "index.html"), "<!doctype html><title>Capproje</title>");
  t.after(() => rm(directory, { recursive: true, force: true }));
  await assert.rejects(() => createRuntime({
    DATABASE_PROVIDER: "turso",
    CAPPROJE_DATA_DIR: path.join(directory, "data"),
    STATIC_ASSETS_DIR: assetsDirectory,
  }), /TURSO_DATABASE_URL ve TURSO_AUTH_TOKEN/);
});

test("self-host runtime bootstraps and authenticates through the real HTTP bridge", async (t) => {
  const directory = await temporaryDirectory();
  const assetsDirectory = path.join(directory, "client");
  await mkdir(assetsDirectory, { recursive: true });
  await writeFile(path.join(assetsDirectory, "index.html"), "<!doctype html><title>Capproje</title>");
  const environment = {
    HOST: "127.0.0.1",
    PORT: "0",
    CAPPROJE_DATA_DIR: path.join(directory, "data"),
    STATIC_ASSETS_DIR: assetsDirectory,
    BOOTSTRAP_SECRET: "bootstrap-secret-for-self-host-test",
    PASSWORD_AUTH_ENABLED: "true",
    PASSWORD_AUTH_PEPPER: "password-pepper-for-self-host-test",
    PHONE_AUTH_ENABLED: "false",
    ALLOW_DEV_AUTH: "false",
  };
  const runtime = await createRuntime(environment);
  const server = await startSelfHostedServer(runtime, environment);
  t.after(() => new Promise((resolve) => server.close(async () => { await server.waitForBackgroundTasks(); resolve(); })));
  t.after(() => runtime.sqlite.close());
  t.after(() => rm(directory, { recursive: true, force: true }));
  const { port } = server.address();
  const baseUrl = `http://127.0.0.1:${port}`;
  const bootstrapResponse = await fetch(`${baseUrl}/api/v1/bootstrap`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-bootstrap-secret": environment.BOOTSTRAP_SECRET },
    body: JSON.stringify({ tenant_name: "Capproje", tenant_slug: "capproje", owner_email: "owner@example.test", owner_name: "Firma Sahibi", owner_phone: "0533 656 52 55", owner_password: "Test-password-123" }),
  });
  assert.equal(bootstrapResponse.status, 201);
  const loginResponse = await fetch(`${baseUrl}/api/v1/auth/password/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ phone: "0533 656 52 55", password: "Test-password-123" }),
  });
  assert.equal(loginResponse.status, 200);
  const cookie = loginResponse.headers.get("set-cookie");
  // Bu köprü düz HTTP üzerinden çalışıyor. Secure çerez tarayıcıda saklanmayacağı
  // için ad ve bayrak şemaya göre değişir; HTTPS'te __Host- öneki kullanılır.
  assert.match(cookie, /^capproje_session=/);
  assert.match(cookie, /HttpOnly/);
  assert.match(cookie, /SameSite=Lax/);
  assert.doesNotMatch(cookie, /Secure/);
  const sessionResponse = await fetch(`${baseUrl}/api/v1/session`, { headers: { cookie: cookie.split(";")[0] } });
  assert.equal(sessionResponse.status, 200);
  assert.equal((await sessionResponse.json()).data.tenant.name, "Capproje");
});
