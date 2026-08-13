#!/usr/bin/env node
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

// Turso tek seferde bir statement çalıştırır; migration dosyaları bu ayrıştırıcıyla
// bölünür. Tetikleyici gövdeleri çok satırlı `BEGIN … END;` biçiminde yazılmalıdır,
// aksi hâlde dosyanın kalanı tek bir statement'a yapışır.
const commentOnly = (text) => !text.replace(/^\s*--.*$/gm, "").trim();

export function splitSqlStatements(sql) {
  const statements = [];
  let buffer = "";
  let trigger = false;
  for (const line of sql.split(/\r?\n/)) {
    // Statement'ın başladığı yeri belirlerken yorum satırları sayılmaz; aksi
    // hâlde tetikleyicinin üstündeki bir açıklama satırı gövdeyi yanlış bölerdi.
    if (commentOnly(buffer) && /^\s*CREATE\s+TRIGGER\b/i.test(line)) trigger = true;
    buffer += `${line}\n`;
    if (commentOnly(buffer)) continue;
    const complete = trigger ? /^\s*END;\s*$/i.test(line) : /;\s*(?:--.*)?$/.test(line);
    if (!complete) continue;
    statements.push(buffer.trim().replace(/;\s*$/, ""));
    buffer = "";
    trigger = false;
  }
  if (!commentOnly(buffer)) statements.push(buffer.trim());
  return statements;
}

export async function migrationStatements(name) {
  const sql = await readFile(path.join(root, "migrations", name), "utf8");
  return splitSqlStatements(sql)
    .map((statement) => statement.trim())
    .filter(Boolean)
    .filter((statement) => !/^PRAGMA\s+(foreign_keys|optimize)\b/i.test(statement));
}

export async function migrationFileNames() {
  return (await readdir(path.join(root, "migrations")))
    .filter((name) => /^\d{4}_.+\.sql$/.test(name))
    .sort();
}

async function main() {
  const { createClient } = await import("@tursodatabase/serverless/compat");
  const url = process.env.TURSO_DATABASE_URL;
  const authToken = process.env.TURSO_AUTH_TOKEN;
  if (!url || !authToken) throw new Error("TURSO_DATABASE_URL ve TURSO_AUTH_TOKEN zorunludur.");
  const client = createClient({ url, authToken });

  await client.execute(`CREATE TABLE IF NOT EXISTS schema_migrations (
  name TEXT PRIMARY KEY,
  applied_at TEXT NOT NULL
)`);

  const appliedResult = await client.execute("SELECT name FROM schema_migrations");
  const applied = new Set(appliedResult.rows.map((row) => String(row.name)));

  for (const name of await migrationFileNames()) {
    if (applied.has(name)) continue;
    const statements = await migrationStatements(name);
    statements.push("INSERT INTO schema_migrations (name, applied_at) VALUES (?, ?)");
    const batch = statements.map((statement, index) => index === statements.length - 1
      ? { sql: statement, args: [name, new Date().toISOString()] }
      : { sql: statement });
    await client.batch(batch, "write");
    console.log(`Applied ${name}`);
  }

  client.close();
  console.log("Turso migrations are current.");
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  await main();
}
