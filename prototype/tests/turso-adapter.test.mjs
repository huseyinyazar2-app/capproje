import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { createD1CompatibleTurso, databaseFromEnv } from "../worker/database.js";

function result(columns = [], rows = [], rowsAffected = 0, lastInsertRowid) {
  return { columns, rows, rowsAffected, lastInsertRowid };
}

test("Turso adapter preserves the D1 prepare/bind result contract", async () => {
  const calls = [];
  const client = {
    async execute(statement) {
      calls.push(statement);
      if (statement.sql.startsWith("SELECT")) return result(["id", "name"], [{ 0: "c1", 1: "Capproje", id: "c1", name: "Capproje" }]);
      return result([], [], 1, 7n);
    },
    async batch(statements, mode) {
      calls.push({ statements, mode });
      return statements.map(() => result([], [], 1));
    },
  };
  const database = createD1CompatibleTurso(client);

  assert.deepEqual(await database.prepare("SELECT id,name FROM tenants WHERE id=?").bind("c1").first(), { id: "c1", name: "Capproje" });
  assert.deepEqual((await database.prepare("SELECT id,name FROM tenants").all()).results, [{ id: "c1", name: "Capproje" }]);
  assert.equal((await database.prepare("INSERT INTO tenants VALUES (?)").bind("c2").run()).meta.last_row_id, 7);
  const batch = await database.batch([
    database.prepare("INSERT INTO tenants VALUES (?)").bind("c3"),
    database.prepare("INSERT INTO audit_logs VALUES (?)").bind("a1"),
  ]);

  assert.equal(batch.length, 2);
  assert.equal(calls.at(-1).mode, "write");
});

test("D1 remains the default and Turso requires explicit configuration", () => {
  const d1 = { prepare() {} };
  assert.equal(databaseFromEnv({ DB: d1 }), d1);
  assert.throws(() => databaseFromEnv({ DATABASE_PROVIDER: "turso" }), /TURSO_DATABASE_URL/);
});

test("Turso migration splitter keeps trigger bodies as one SQL statement", async () => {
  const source = await readFile(new URL("../scripts/migrate-turso.mjs", import.meta.url), "utf8");
  assert.match(source, /CREATE\\s\+TRIGGER/);
  assert.match(source, /END;\\s\*\$/);
  assert.doesNotMatch(source, /\.split\(\/;\\s\*/);
});

test("a comment line ending in a semicolon does not cut a statement in half", async () => {
  const { splitSqlStatements } = await import("../scripts/migrate-turso.mjs");
  // Türkçe açıklamalar noktalı virgülle biten cümleler kurabiliyor. Böyle bir
  // satır kod sanılırsa görünüm ortadan bölünür ve göç "incomplete input" ile
  // düşer; bu bir kez gerçekten oldu (0017_project_profitability.sql).
  const sql = [
    "CREATE VIEW IF NOT EXISTS ornek AS",
    "SELECT",
    "  -- asli kayıt zaten `reversed` olup toplamdan düşüyor;",
    "  SUM(amount_minor) AS toplam",
    "FROM financial_transactions;",
    "",
    "CREATE INDEX IF NOT EXISTS idx_ornek ON financial_transactions(tenant_id);",
  ].join("\n");

  const statements = splitSqlStatements(sql);
  assert.equal(statements.length, 2);
  assert.match(statements[0], /^CREATE VIEW/);
  assert.match(statements[0], /FROM financial_transactions$/);
  assert.match(statements[1], /^CREATE INDEX/);
});

test("a trailing comment after real code still closes the statement", async () => {
  const { splitSqlStatements } = await import("../scripts/migrate-turso.mjs");
  const sql = "CREATE INDEX IF NOT EXISTS a ON t(x); -- neden burada\nCREATE INDEX IF NOT EXISTS b ON t(y);";
  const statements = splitSqlStatements(sql);
  assert.equal(statements.length, 2);
  assert.match(statements[1], /^CREATE INDEX IF NOT EXISTS b/);
});
