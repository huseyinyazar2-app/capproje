import assert from "node:assert/strict";
import test from "node:test";
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
