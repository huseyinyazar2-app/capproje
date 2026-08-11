import { createClient } from "@tursodatabase/serverless/compat";

function plainRows(result) {
  return (result.rows || []).map((row) => Object.fromEntries(
    (result.columns || []).map((column, index) => [column, row[column] ?? row[index] ?? null]),
  ));
}

function d1Result(result) {
  return {
    success: true,
    results: plainRows(result),
    meta: {
      changes: result.rowsAffected || 0,
      last_row_id: result.lastInsertRowid == null ? null : Number(result.lastInsertRowid),
    },
  };
}

class TursoStatement {
  constructor(database, sql, bindings = []) {
    this.database = database;
    this.sql = sql;
    this.bindings = bindings;
  }

  bind(...bindings) {
    return new TursoStatement(this.database, this.sql, bindings);
  }

  async first(column) {
    const result = await this.database.client.execute({ sql: this.sql, args: this.bindings });
    const row = plainRows(result)[0] || null;
    return column && row ? row[column] ?? null : row;
  }

  async all() {
    return d1Result(await this.database.client.execute({ sql: this.sql, args: this.bindings }));
  }

  async run() {
    return d1Result(await this.database.client.execute({ sql: this.sql, args: this.bindings }));
  }
}

export function createD1CompatibleTurso(client) {
  return {
    provider: "turso",
    client,
    prepare(sql) {
      return new TursoStatement(this, sql);
    },
    async batch(statements) {
      const results = await client.batch(
        statements.map((statement) => ({ sql: statement.sql, args: statement.bindings })),
        "write",
      );
      return results.map(d1Result);
    },
  };
}

export function databaseFromEnv(env) {
  if (env.DATABASE_PROVIDER !== "turso") return env.DB || null;
  if (env.DB?.provider === "turso") return env.DB;
  if (!env.TURSO_DATABASE_URL || !env.TURSO_AUTH_TOKEN) {
    throw new Error("Turso bağlantısı için TURSO_DATABASE_URL ve TURSO_AUTH_TOKEN zorunludur.");
  }
  return createD1CompatibleTurso(createClient({
    url: env.TURSO_DATABASE_URL,
    authToken: env.TURSO_AUTH_TOKEN,
  }));
}
