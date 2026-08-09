import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const migrationUrl = new URL("../migrations/0001_tenant_core.sql", import.meta.url);
const phoneMigrationUrl = new URL("../migrations/0006_phone_auth.sql", import.meta.url);
const passwordMigrationUrl = new URL("../migrations/0007_password_auth.sql", import.meta.url);
const workerUrl = new URL("../worker/index.js", import.meta.url);

test("tenant-owned business tables require tenant_id", async () => {
  const sql = await readFile(migrationUrl, "utf8");
  const tables = [
    "customers", "suppliers", "projects", "offers", "offer_items", "project_tasks", "work_items",
    "purchase_requests", "purchase_orders", "production_orders", "installations", "accounts",
    "financial_transactions", "invoices", "employees", "attendance", "leave_requests", "payroll_inputs",
    "files", "audit_logs", "backup_runs",
  ];

  for (const table of tables) {
    const match = sql.match(new RegExp(`CREATE TABLE IF NOT EXISTS ${table} \\(([\\s\\S]*?)\\n\\);`, "i"));
    assert.ok(match, `${table} tablosu migration içinde bulunmalı`);
    assert.match(match[1], /tenant_id\s+TEXT\s+NOT NULL/i, `${table}.tenant_id zorunlu olmalı`);
  }
});

test("money values use integer minor units", async () => {
  const sql = await readFile(migrationUrl, "utf8");
  const monetaryColumns = [...sql.matchAll(/\b([a-z_]*(?:amount|total|balance|price|cost|salary|limit)[a-z_]*)\s+(INTEGER|REAL|NUMERIC)/gi)];
  assert.ok(monetaryColumns.length > 10, "Parasal kolonlar bulunmalı");
  for (const [, column, type] of monetaryColumns) {
    assert.equal(type.toUpperCase(), "INTEGER", `${column} parasal değeri INTEGER minor-unit olmalı`);
    assert.match(column, /_minor$/, `${column} adı minor-unit sözleşmesini göstermeli`);
  }
});

test("common tenant queries have scoped indexes", async () => {
  const sql = await readFile(migrationUrl, "utf8");
  for (const table of ["projects", "offers", "purchase_requests", "production_orders", "financial_transactions", "employees", "audit_logs"]) {
    assert.match(sql, new RegExp(`CREATE INDEX IF NOT EXISTS idx_${table}_[^\\n]+[\\s\\S]*?ON ${table}\\s*\\(tenant_id`, "i"), `${table} tenant indexi olmalı`);
  }
  assert.match(sql, /PRAGMA optimize/i);
});

test("phone sessions store only hashed tokens and expire", async () => {
  const sql = await readFile(phoneMigrationUrl, "utf8");
  assert.match(sql, /CREATE UNIQUE INDEX IF NOT EXISTS idx_users_phone_unique/);
  assert.match(sql, /CREATE TABLE IF NOT EXISTS phone_sessions/);
  assert.match(sql, /token_hash TEXT NOT NULL UNIQUE/);
  assert.match(sql, /expires_at TEXT NOT NULL/);
  assert.match(sql, /revoked_at TEXT/);
  assert.doesNotMatch(sql, /\btoken\s+TEXT/);
  assert.match(sql, /CREATE TABLE IF NOT EXISTS phone_auth_requests/);
  assert.match(sql, /phone_hash TEXT NOT NULL/);
  assert.match(sql, /ip_hash TEXT NOT NULL/);
});

test("password authentication stores only salted adaptive hashes and rate-limit metadata", async () => {
  const sql = await readFile(passwordMigrationUrl, "utf8");
  assert.match(sql, /password_hash TEXT/);
  assert.match(sql, /password_salt TEXT/);
  assert.match(sql, /password_iterations INTEGER/);
  assert.match(sql, /CREATE TABLE IF NOT EXISTS password_auth_attempts/);
  assert.doesNotMatch(sql, /password\s+TEXT/i);
});

test("password hashing stays within the production WebCrypto limit", async () => {
  const source = await readFile(workerUrl, "utf8");
  assert.match(source, /const PASSWORD_ITERATIONS = 100_000;/);
});
