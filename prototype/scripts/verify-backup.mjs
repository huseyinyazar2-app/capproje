#!/usr/bin/env node
// Yedek doğrulama ve geri yükleme provası.
//
// Test edilmemiş yedek yedek sayılmaz. Bu araç bir JSONL tenant yedeğini boş bir
// SQLite veritabanına geri yükleyerek şemayla uyumlu olduğunu ve satırların
// eksiksiz yazılabildiğini kanıtlar. Canlı veritabanına asla dokunmaz.
//
//   node scripts/verify-backup.mjs <yedek.jsonl> [--into geri-yukleme.sqlite]
//
// --into verilmezse bellek içi veritabanı kullanılır ve süreç sonunda atılır.

import { readFile, readdir, rm } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const migrationsDirectory = path.join(projectRoot, "migrations");

// Yabancı anahtar sırası: üst kayıtlar önce yazılmalıdır.
const restoreOrder = [
  "tenants", "users", "roles", "role_permissions", "memberships", "membership_roles",
  "customers", "suppliers", "projects", "offers", "offer_items", "contracts",
  "site_surveys", "survey_measurements", "design_revisions",
  "project_tasks", "work_items", "inventory_items", "material_requirements",
  "purchase_requests", "purchase_orders", "production_orders", "stock_movements",
  "installations", "quality_inspections", "handovers", "handover_punch_items",
  "accounts", "financial_transactions", "invoices", "progress_payments",
  "employees", "attendance", "leave_requests", "payroll_inputs",
  "project_meetings", "meeting_actions", "project_communications", "resource_assignments",
  "files", "notifications", "audit_logs",
];

function fail(message) {
  console.error(`HATA: ${message}`);
  process.exit(1);
}

async function applyMigrations(database) {
  const files = (await readdir(migrationsDirectory)).filter((name) => /^\d{4}_.+\.sql$/.test(name)).sort();
  for (const name of files) database.exec(await readFile(path.join(migrationsDirectory, name), "utf8"));
  return files;
}

function insertRow(database, table, row) {
  const columns = Object.keys(row).filter((column) => row[column] !== undefined);
  const sql = `INSERT OR REPLACE INTO ${table} (${columns.join(",")}) VALUES (${columns.map(() => "?").join(",")})`;
  const values = columns.map((column) => {
    const value = row[column];
    if (value === null) return null;
    if (typeof value === "boolean") return value ? 1 : 0;
    if (typeof value === "object") return JSON.stringify(value);
    return value;
  });
  database.prepare(sql).run(...values);
}

async function main() {
  const [backupPath, ...rest] = process.argv.slice(2);
  if (!backupPath) fail("Yedek dosyasının yolunu verin: node scripts/verify-backup.mjs <yedek.jsonl>");
  if (!existsSync(backupPath)) fail(`Yedek dosyası bulunamadı: ${backupPath}`);
  const intoIndex = rest.indexOf("--into");
  const target = intoIndex >= 0 ? rest[intoIndex + 1] : ":memory:";
  if (intoIndex >= 0 && !target) fail("--into için hedef dosya yolu verilmelidir.");
  if (target !== ":memory:" && existsSync(target)) fail(`Hedef dosya zaten var, üzerine yazılmaz: ${target}`);

  const content = await readFile(backupPath, "utf8");
  const lines = content.split("\n").filter((line) => line.trim());
  if (!lines.length) fail("Yedek dosyası boş.");

  let manifest;
  try { manifest = JSON.parse(lines[0]); }
  catch { fail("Yedeğin ilk satırı geçerli bir manifest değil."); }
  if (manifest.type !== "manifest") fail("Yedeğin ilk satırı manifest olmalıdır.");

  const database = new DatabaseSync(target);
  database.exec("PRAGMA foreign_keys=ON");
  const migrations = await applyMigrations(database);

  const missing = (manifest.migrations || []).filter((name) => !migrations.includes(name));
  const extra = migrations.filter((name) => !(manifest.migrations || []).includes(name));
  if (missing.length) fail(`Yedek, bu kod tabanında bulunmayan migration'lar içeriyor: ${missing.join(", ")}`);
  if (extra.length) console.warn(`UYARI: yedek alındıktan sonra eklenen migration'lar var: ${extra.join(", ")}. Geri yükleme sonrası bu değişiklikler boş varsayılanlarla uygulanır.`);

  const grouped = new Map();
  for (const [index, line] of lines.slice(1).entries()) {
    let entry;
    try { entry = JSON.parse(line); }
    catch { fail(`${index + 2}. satır geçerli JSON değil.`); }
    if (!entry.table || !entry.row) continue;
    if (!grouped.has(entry.table)) grouped.set(entry.table, []);
    grouped.get(entry.table).push(entry.row);
  }

  const unknownTables = [...grouped.keys()].filter((table) => !restoreOrder.includes(table));
  if (unknownTables.length) console.warn(`UYARI: geri yükleme sırasında tanımsız tablolar en sona alınır: ${unknownTables.join(", ")}`);

  const summary = [];
  const failures = [];
  database.exec("BEGIN IMMEDIATE");
  try {
    for (const table of [...restoreOrder, ...unknownTables]) {
      const rows = grouped.get(table);
      if (!rows?.length) continue;
      let written = 0;
      for (const row of rows) {
        try { insertRow(database, table, row); written += 1; }
        catch (error) { failures.push(`${table}: ${error.message}`); }
      }
      summary.push({ table, rows: rows.length, written });
    }
    database.exec("COMMIT");
  } catch (error) {
    database.exec("ROLLBACK");
    fail(`Geri yükleme işlemi tamamlanamadı: ${error.message}`);
  }

  console.log(`Yedek: ${backupPath}`);
  console.log(`Firma: ${manifest.tenant_id} · alındığı zaman: ${manifest.created_at} · şema sürümü: ${manifest.schema_version}`);
  console.log(`Hedef: ${target === ":memory:" ? "bellek içi prova" : target}`);
  console.log("");
  for (const item of summary) console.log(`  ${item.table.padEnd(26)} ${String(item.written).padStart(7)} / ${item.rows}`);
  console.log("");
  const totalRows = summary.reduce((total, item) => total + item.rows, 0);
  const totalWritten = summary.reduce((total, item) => total + item.written, 0);
  console.log(`Toplam ${totalWritten} / ${totalRows} satır geri yüklendi.`);

  if (failures.length) {
    console.error("");
    console.error(`${failures.length} satır yazılamadı:`);
    for (const message of failures.slice(0, 20)) console.error(`  - ${message}`);
    if (failures.length > 20) console.error(`  … ve ${failures.length - 20} tane daha.`);
    database.close();
    if (target !== ":memory:") await rm(target, { force: true });
    process.exit(2);
  }

  database.close();
  console.log("Yedek doğrulandı: tüm satırlar güncel şemaya geri yüklenebiliyor.");
}

main().catch((error) => { console.error(error); process.exit(1); });
