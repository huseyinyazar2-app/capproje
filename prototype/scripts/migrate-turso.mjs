#!/usr/bin/env node
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@tursodatabase/serverless/compat";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
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
const files = (await readdir(path.join(root, "migrations")))
  .filter((name) => /^\d{4}_.+\.sql$/.test(name))
  .sort();

for (const name of files) {
  if (applied.has(name)) continue;
  const sql = await readFile(path.join(root, "migrations", name), "utf8");
  const statements = sql
    .split(/;\s*(?:\r?\n|$)/)
    .map((statement) => statement.trim())
    .filter(Boolean)
    .filter((statement) => !/^PRAGMA\s+(foreign_keys|optimize)\b/i.test(statement));
  statements.push("INSERT INTO schema_migrations (name, applied_at) VALUES (?, ?)");
  const batch = statements.map((statement, index) => index === statements.length - 1
    ? { sql: statement, args: [name, new Date().toISOString()] }
    : { sql: statement });
  await client.batch(batch, "write");
  console.log(`Applied ${name}`);
}

client.close();
console.log("Turso migrations are current.");
