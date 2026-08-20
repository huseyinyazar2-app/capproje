#!/usr/bin/env node
import { createHash, randomUUID } from "node:crypto";
import { createServer } from "node:http";
import { chmod, mkdir, readFile, rename, rm, stat, writeFile } from "node:fs/promises";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { backup, DatabaseSync } from "node:sqlite";
import { fileURLToPath, pathToFileURL } from "node:url";
import worker from "../worker/index.js";
import { databaseFromEnv } from "../worker/database.js";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const migrationPattern = /^\d{4}_.+\.sql$/;
const backupPattern = /^capproje-(\d{4}-\d{2}-\d{2})\.sqlite$/;

function safeInteger(value, fallback, minimum, maximum) {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed >= minimum && parsed <= maximum ? parsed : fallback;
}

class LocalStatement {
  constructor(database, sql, bindings = []) {
    this.database = database;
    this.sql = sql;
    this.bindings = bindings;
  }

  bind(...bindings) {
    return new LocalStatement(this.database, this.sql, bindings);
  }

  first(column) {
    const row = this.database.sqlite.prepare(this.sql).get(...this.bindings) || null;
    return column && row ? row[column] ?? null : row;
  }

  all() {
    return { success: true, results: this.database.sqlite.prepare(this.sql).all(...this.bindings), meta: { changes: 0 } };
  }

  run() {
    return this.runSync();
  }

  runSync() {
    const result = this.database.sqlite.prepare(this.sql).run(...this.bindings);
    return { success: true, results: [], meta: { changes: Number(result.changes), last_row_id: result.lastInsertRowid == null ? null : Number(result.lastInsertRowid) } };
  }
}

export class LocalD1Database {
  constructor(sqlite) {
    this.provider = "sqlite";
    this.sqlite = sqlite;
  }

  prepare(sql) {
    return new LocalStatement(this, sql);
  }

  batch(statements) {
    this.sqlite.exec("BEGIN IMMEDIATE");
    try {
      const results = statements.map((statement) => statement.runSync());
      this.sqlite.exec("COMMIT");
      return results;
    } catch (error) {
      this.sqlite.exec("ROLLBACK");
      throw error;
    }
  }
}

function resolveInside(root, key) {
  if (typeof key !== "string" || !key || key.includes("\0")) throw new Error("Geçersiz dosya anahtarı.");
  const resolvedRoot = path.resolve(root);
  const resolved = path.resolve(resolvedRoot, key.replaceAll("\\", "/"));
  if (resolved !== resolvedRoot && !resolved.startsWith(`${resolvedRoot}${path.sep}`)) throw new Error("Dosya anahtarı veri dizini dışında olamaz.");
  return resolved;
}

async function bytesFrom(value) {
  if (typeof value === "string") return Buffer.from(value);
  if (value instanceof ArrayBuffer) return Buffer.from(value);
  if (ArrayBuffer.isView(value)) return Buffer.from(value.buffer, value.byteOffset, value.byteLength);
  if (value && typeof value.arrayBuffer === "function") return Buffer.from(await value.arrayBuffer());
  throw new TypeError("Desteklenmeyen dosya içeriği.");
}

export class FilesystemBucket {
  constructor(root) {
    this.root = path.resolve(root);
  }

  async put(key, value) {
    const target = resolveInside(this.root, key);
    const temporary = `${target}.${randomUUID()}.tmp`;
    await mkdir(path.dirname(target), { recursive: true, mode: 0o700 });
    const bytes = await bytesFrom(value);
    try {
      await writeFile(temporary, bytes, { mode: 0o600 });
      await rename(temporary, target);
    } catch (error) {
      await rm(temporary, { force: true }).catch(() => {});
      throw error;
    }
    return { key };
  }

  async get(key) {
    const target = resolveInside(this.root, key);
    try {
      const body = await readFile(target);
      return { body, httpEtag: `"${createHash("sha256").update(body).digest("hex")}"` };
    } catch (error) {
      if (error?.code === "ENOENT") return null;
      throw error;
    }
  }

  async delete(key) {
    await rm(resolveInside(this.root, key), { force: true });
  }
}

const mimeTypes = new Map([
  [".css", "text/css; charset=utf-8"], [".html", "text/html; charset=utf-8"], [".ico", "image/x-icon"],
  [".jpeg", "image/jpeg"], [".jpg", "image/jpeg"], [".js", "text/javascript; charset=utf-8"],
  [".json", "application/json; charset=utf-8"], [".png", "image/png"], [".svg", "image/svg+xml"],
  [".txt", "text/plain; charset=utf-8"], [".webmanifest", "application/manifest+json"], [".woff2", "font/woff2"],
]);

export class StaticAssets {
  constructor(root) {
    this.root = path.resolve(root);
  }

  async fetch(request) {
    if (!["GET", "HEAD"].includes(request.method)) return new Response("Not found", { status: 404 });
    let pathname;
    try { pathname = decodeURIComponent(new URL(request.url).pathname); }
    catch { return new Response("Bad request", { status: 400 }); }
    const relative = pathname.replace(/^\/+/, "");
    let target;
    try { target = resolveInside(this.root, relative || "."); }
    catch { return new Response("Not found", { status: 404 }); }
    try {
      const info = await stat(target);
      if (!info.isFile()) return new Response("Not found", { status: 404 });
      const headers = new Headers({
        "content-type": mimeTypes.get(path.extname(target).toLowerCase()) || "application/octet-stream",
        "content-length": String(info.size),
        // Yazı tipi dosyalarının adı içerik özetini taşır, bu yüzden derlenmiş
        // varlıklar gibi kalıcı olarak önbelleğe alınabilirler.
        "cache-control": relative.startsWith("assets/") || relative.startsWith("fonts/") ? "public, max-age=31536000, immutable" : "no-cache",
      });
      return new Response(request.method === "HEAD" ? null : await readFile(target), { headers });
    } catch (error) {
      if (error?.code === "ENOENT") return new Response("Not found", { status: 404 });
      throw error;
    }
  }
}

export async function migrateLocalDatabase(sqlite, migrationsDirectory = path.join(projectRoot, "migrations")) {
  sqlite.exec("CREATE TABLE IF NOT EXISTS schema_migrations (name TEXT PRIMARY KEY, applied_at TEXT NOT NULL)");
  const applied = new Set(sqlite.prepare("SELECT name FROM schema_migrations").all().map((row) => row.name));
  const files = readdirSync(migrationsDirectory).filter((name) => migrationPattern.test(name)).sort();
  for (const name of files) {
    if (applied.has(name)) continue;
    const sql = readFileSync(path.join(migrationsDirectory, name), "utf8");
    sqlite.exec("BEGIN IMMEDIATE");
    try {
      sqlite.exec(sql);
      sqlite.prepare("INSERT INTO schema_migrations (name, applied_at) VALUES (?, ?)").run(name, new Date().toISOString());
      sqlite.exec("COMMIT");
    } catch (error) {
      sqlite.exec("ROLLBACK");
      throw new Error(`${name} migration uygulanamadı: ${error.message}`, { cause: error });
    }
  }
  sqlite.exec("PRAGMA optimize");
  return files;
}

export async function createDailySqliteBackup(sqlite, backupDirectory, retentionDays = 30, clock = new Date()) {
  await mkdir(backupDirectory, { recursive: true, mode: 0o700 });
  const date = clock.toISOString().slice(0, 10);
  const destination = path.join(backupDirectory, `capproje-${date}.sqlite`);
  if (!existsSync(destination)) {
    const temporary = `${destination}.${randomUUID()}.tmp`;
    try {
      await backup(sqlite, temporary);
      await chmod(temporary, 0o600);
      await rename(temporary, destination);
    } catch (error) {
      await rm(temporary, { force: true }).catch(() => {});
      throw error;
    }
  }
  const cutoff = clock.getTime() - retentionDays * 24 * 60 * 60 * 1000;
  for (const name of readdirSync(backupDirectory)) {
    if (!backupPattern.test(name)) continue;
    const candidate = path.join(backupDirectory, name);
    const info = await stat(candidate);
    if (info.mtimeMs < cutoff) await rm(candidate, { force: true });
  }
  return destination;
}

// Veri dizini kalıcı bir diske bağlanmadığında her dağıtımda veritabanı sıfırlanır
// ve bu, sorun çıkana kadar fark edilmez. Açılışta dizine bir işaret dosyası yazıp
// önceki açılışları sayıyoruz; sayaç sıfırlanmışsa dizin kalıcı değildir.
export async function checkStoragePersistence(dataDirectory, hasDatabase) {
  const markerPath = path.join(dataDirectory, ".capproje-storage.json");
  let previous = null;
  try { previous = JSON.parse(await readFile(markerPath, "utf8")); }
  catch { previous = null; }
  const marker = {
    installation_id: previous?.installation_id || randomUUID(),
    first_seen_at: previous?.first_seen_at || new Date().toISOString(),
    boot_count: Number(previous?.boot_count || 0) + 1,
    last_seen_at: new Date().toISOString(),
  };
  await writeFile(markerPath, JSON.stringify(marker, null, 2), { mode: 0o600 }).catch(() => {});
  // İlk açılışta veritabanı zaten yoktur; uyarı yalnızca veri beklenen bir
  // kurulumda işaret dosyasının kaybolmuş olması hâlinde anlamlıdır.
  const persistent = Boolean(previous);
  if (!persistent && hasDatabase) {
    console.warn("UYARI: Veri dizininde önceki açılış izi yok ama veritabanı dosyası mevcut. Kalıcı disk yapılandırmasını kontrol edin.");
  }
  if (!previous) {
    console.log(`Veri dizini ilk kez kullanılıyor: ${dataDirectory}. Bu dizin kalıcı bir diske bağlı değilse yeniden dağıtımda tüm veriler silinir.`);
  }
  return { ...marker, persistent, dataDirectory };
}

export async function createRuntime(environment = process.env) {
  if (environment.ALLOW_DEV_AUTH === "true") throw new Error("ALLOW_DEV_AUTH üretim sunucusunda true olamaz.");
  const databaseProvider = environment.DATABASE_PROVIDER === "turso" ? "turso" : "sqlite";
  const dataDirectory = path.resolve(environment.CAPPROJE_DATA_DIR || path.join(projectRoot, "data"));
  const databasePath = path.resolve(environment.SQLITE_DATABASE_PATH || path.join(dataDirectory, "capproje.sqlite"));
  const objectDirectory = path.resolve(environment.OBJECT_STORAGE_DIR || path.join(dataDirectory, "objects"));
  const backupDirectory = path.resolve(environment.SQLITE_BACKUP_DIR || path.join(dataDirectory, "backups"));
  const assetsDirectory = path.resolve(environment.STATIC_ASSETS_DIR || path.join(projectRoot, "dist", "client"));
  if (!existsSync(path.join(assetsDirectory, "index.html"))) throw new Error("Üretim arayüzü bulunamadı. Önce npm run build çalıştırılmalıdır.");
  await mkdir(dataDirectory, { recursive: true, mode: 0o700 });
  await mkdir(objectDirectory, { recursive: true, mode: 0o700 });
  const storage = await checkStoragePersistence(dataDirectory, existsSync(databasePath));
  let sqlite = null;
  let database;
  if (databaseProvider === "turso") {
    database = databaseFromEnv({ ...environment, DATABASE_PROVIDER: "turso" });
  } else {
    await mkdir(path.dirname(databasePath), { recursive: true, mode: 0o700 });
    sqlite = new DatabaseSync(databasePath, { timeout: 5000 });
    sqlite.exec("PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; PRAGMA busy_timeout=5000; PRAGMA wal_autocheckpoint=1000;");
    await migrateLocalDatabase(sqlite);
    await chmod(databasePath, 0o600).catch(() => {});
    database = new LocalD1Database(sqlite);
  }
  return {
    sqlite,
    database,
    backupDirectory,
    storage,
    retentionDays: safeInteger(environment.SQLITE_BACKUP_RETENTION_DAYS, 30, 1, 3650),
    env: { ...environment, DATABASE_PROVIDER: databaseProvider, DB: database, FILES: new FilesystemBucket(objectDirectory), ASSETS: new StaticAssets(assetsDirectory), STORAGE_STATE: storage },
  };
}

class RequestTooLargeError extends Error {}

async function requestBody(incoming, maximumBytes) {
  const declared = Number(incoming.headers["content-length"] || 0);
  if (declared > maximumBytes) throw new RequestTooLargeError();
  const chunks = [];
  let size = 0;
  for await (const chunk of incoming) {
    size += chunk.length;
    if (size > maximumBytes) throw new RequestTooLargeError();
    chunks.push(chunk);
  }
  return chunks.length ? Buffer.concat(chunks) : undefined;
}

function requestUrl(incoming) {
  const forwardedProtocol = String(incoming.headers["x-forwarded-proto"] || "").split(",")[0].trim();
  const protocol = ["http", "https"].includes(forwardedProtocol) ? forwardedProtocol : incoming.socket.encrypted ? "https" : "http";
  const host = String(incoming.headers["x-forwarded-host"] || incoming.headers.host || "localhost").split(",")[0].trim();
  return new URL(incoming.url || "/", `${protocol}://${host}`).toString();
}

async function sendNodeResponse(outgoing, response, headOnly = false) {
  const headers = {};
  for (const [name, value] of response.headers) if (name !== "set-cookie") headers[name] = value;
  const cookies = response.headers.getSetCookie?.() || [];
  if (cookies.length) headers["set-cookie"] = cookies;
  outgoing.writeHead(response.status, headers);
  if (headOnly || !response.body) return outgoing.end();
  outgoing.end(Buffer.from(await response.arrayBuffer()));
}

export async function startSelfHostedServer(runtime, environment = process.env) {
  const host = environment.HOST || "127.0.0.1";
  if (!["127.0.0.1", "::1", "localhost"].includes(host) && environment.ALLOW_PUBLIC_BIND !== "true") {
    throw new Error("Uygulama doğrudan genel ağa açılamaz. Nginx arkasında loopback adresi kullanın.");
  }
  const port = safeInteger(environment.PORT, 3000, 0, 65535);
  const maximumRequestBytes = safeInteger(environment.MAX_REQUEST_BYTES, 12 * 1024 * 1024, 1024, 100 * 1024 * 1024);
  const backgroundTasks = new Set();
  const server = createServer(async (incoming, outgoing) => {
    try {
      const body = ["GET", "HEAD"].includes(incoming.method || "GET") ? undefined : await requestBody(incoming, maximumRequestBytes);
      const tasks = [];
      const response = await worker.fetch(new Request(requestUrl(incoming), { method: incoming.method, headers: incoming.headers, body }), runtime.env, { waitUntil(task) { tasks.push(Promise.resolve(task)); } });
      await sendNodeResponse(outgoing, response, incoming.method === "HEAD");
      for (const task of tasks) {
        const tracked = task.catch((error) => console.error("Background request task failed", error)).finally(() => backgroundTasks.delete(tracked));
        backgroundTasks.add(tracked);
      }
    } catch (error) {
      if (outgoing.headersSent) return outgoing.end();
      const status = error instanceof RequestTooLargeError ? 413 : 500;
      const message = status === 413 ? "İstek gövdesi çok büyük." : "Beklenmeyen bir sunucu hatası oluştu.";
      await sendNodeResponse(outgoing, new Response(JSON.stringify({ error: { code: status === 413 ? "request_too_large" : "internal_error", message } }), { status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" } }));
      if (status === 500) console.error("Self-host request error", error);
    }
  });
  server.waitForBackgroundTasks = () => Promise.allSettled([...backgroundTasks]);
  await new Promise((resolve, reject) => { server.once("error", reject); server.listen(port, host, resolve); });
  return server;
}

async function runScheduled(runtime) {
  const tasks = [];
  await worker.scheduled({}, runtime.env, { waitUntil(task) { tasks.push(Promise.resolve(task)); } });
  await Promise.all(tasks);
  if (runtime.sqlite) await createDailySqliteBackup(runtime.sqlite, runtime.backupDirectory, runtime.retentionDays);
}

async function main() {
  process.umask(0o077);
  const runtime = await createRuntime();
  const server = await startSelfHostedServer(runtime);
  const address = server.address();
  console.log(`Capproje ${typeof address === "object" ? `${address.address}:${address.port}` : address} adresinde çalışıyor.`);
  const scheduledTasks = new Set();
  const schedule = () => {
    const task = runScheduled(runtime).catch((error) => console.error("Scheduled backup failed", error)).finally(() => scheduledTasks.delete(task));
    scheduledTasks.add(task);
  };
  schedule();
  const timer = setInterval(schedule, 6 * 60 * 60 * 1000);
  timer.unref();
  const shutdown = () => {
    clearInterval(timer);
    server.close(async () => {
      await Promise.allSettled([server.waitForBackgroundTasks(), ...scheduledTasks]);
      runtime.sqlite?.close();
      runtime.database?.client?.close?.();
      process.exit(0);
    });
    setTimeout(() => process.exit(1), 10_000).unref();
  };
  process.once("SIGINT", shutdown);
  process.once("SIGTERM", shutdown);
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) main().catch((error) => { console.error(error); process.exit(1); });
