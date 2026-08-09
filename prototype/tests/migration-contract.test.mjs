import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const migrationUrl = new URL("../migrations/0001_tenant_core.sql", import.meta.url);

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
