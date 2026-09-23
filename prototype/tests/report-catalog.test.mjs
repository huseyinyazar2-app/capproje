import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import test from "node:test";
import { DatabaseSync } from "node:sqlite";
import worker from "../worker/index.js";
import { builtinReports } from "../worker/report-catalog.js";

const migrationsDirectory = new URL("../migrations/", import.meta.url);
const timestamp = "2026-08-09T10:00:00.000Z";
const categories = new Set(["Satış", "Proje", "Finans", "Satın Alma", "Üretim", "Montaj", "İnsan Kaynakları"]);
const sensitivePermissions = ["cost.view", "salary.view", "hr.sensitive.read", "finance.sensitive.read"];

class D1Statement {
  constructor(database, sql) { this.database = database; this.sql = sql; this.values = []; }
  bind(...values) { this.values = values; return this; }
  async first() { return this.database.prepare(this.sql).get(...this.values) || null; }
  async all() { return { results: this.database.prepare(this.sql).all(...this.values) }; }
  async run() {
    const result = this.database.prepare(this.sql).run(...this.values);
    return { success: true, meta: { changes: Number(result.changes) } };
  }
}

class D1Database {
  constructor(database) { this.database = database; }
  prepare(sql) { return new D1Statement(this.database, sql); }
  async batch(statements) {
    this.database.exec("BEGIN");
    try {
      const results = [];
      for (const statement of statements) results.push(await statement.run());
      this.database.exec("COMMIT");
      return results;
    } catch (error) {
      this.database.exec("ROLLBACK");
      throw error;
    }
  }
}

// Katalog kodda duruyor ama sorguları gerçek şemaya çarpıyor: bir sütun adı
// göçte değişirse bunu ancak göçleri aynen uygulayan bir test yakalar.
async function setup({ users = [] } = {}) {
  const database = new DatabaseSync(":memory:");
  for (const name of (await readdir(migrationsDirectory)).filter((item) => /^\d{4}_.+\.sql$/.test(item)).sort()) {
    database.exec(await readFile(new URL(name, migrationsDirectory), "utf8"));
  }
  database.prepare("INSERT INTO tenants (id,name,slug,created_at,updated_at) VALUES (?,?,?,?,?)").run("tenant-a", "Firma A", "firma-a", timestamp, timestamp);
  database.prepare("INSERT INTO users (id,email,full_name,status,created_at,updated_at) VALUES (?,?,?,?,?,?)").run("owner-a", "owner@a.test", "Firma Sahibi", "active", timestamp, timestamp);
  database.prepare("INSERT INTO roles (id,tenant_id,code,name,is_system,created_at,updated_at) VALUES (?,?,?,?,?,?,?)").run("role-owner", "tenant-a", "owner", "Firma Sahibi", 1, timestamp, timestamp);
  database.prepare("INSERT INTO memberships (id,tenant_id,user_id,role_id,status,created_at,updated_at) VALUES (?,?,?,?,?,?,?)").run("member-a", "tenant-a", "owner-a", "role-owner", "active", timestamp, timestamp);
  for (const user of users) {
    database.prepare("INSERT INTO users (id,email,full_name,status,created_at,updated_at) VALUES (?,?,?,?,?,?)").run(user.id, user.email, user.id, "active", timestamp, timestamp);
    database.prepare("INSERT INTO roles (id,tenant_id,code,name,is_system,created_at,updated_at) VALUES (?,?,?,?,?,?,?)").run(`role-${user.id}`, "tenant-a", `rol-${user.id}`, `Rol ${user.id}`, 0, timestamp, timestamp);
    database.prepare("INSERT INTO memberships (id,tenant_id,user_id,role_id,status,created_at,updated_at) VALUES (?,?,?,?,?,?,?)").run(`member-${user.id}`, "tenant-a", user.id, `role-${user.id}`, "active", timestamp, timestamp);
    for (const code of user.permissions || []) {
      database.prepare("INSERT OR IGNORE INTO permissions (code,description) VALUES (?,?)").run(code, code);
      database.prepare("INSERT OR IGNORE INTO role_permissions (tenant_id,role_id,permission_code) VALUES (?,?,?)").run("tenant-a", `role-${user.id}`, code);
    }
  }
  // Göreli tarihli tanımlar da takvimden bağımsız çalışsın.
  return { database, env: { DB: new D1Database(database), ALLOW_DEV_AUTH: "true", REPORT_CLOCK: "2026-09-23T10:00:00.000Z" } };
}

function request(path, { method = "GET", body, email = "owner@a.test" } = {}) {
  const headers = new Headers();
  headers.set("x-user-email", email);
  headers.set("x-tenant-id", "tenant-a");
  if (body !== undefined) headers.set("content-type", "application/json");
  return new Request(`https://example.test${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
}

const send = (env, path, options) => worker.fetch(request(path, options), env);
const payload = async (response) => response.json();
const postRun = (env, body, email) => send(env, "/api/v1/reports/run", { method: "POST", body, email });
const listBuiltin = async (env, email) => (await payload(await send(env, "/api/v1/reports/builtin", { email }))).data;
const fieldsFor = async (env, email) => new Map((await payload(await send(env, "/api/v1/reports/fields", { email }))).data.map((item) => [item.resource, item.columns]));
const isRelative = (value) => Boolean(value) && typeof value === "object" && !Array.isArray(value) && "relative" in value;

// Tanımın dokunduğu her sütun: yetki kararını bunların hepsi etkiler.
function referencedColumns(definition) {
  const group = definition.group || null;
  const groupBy = group?.by || [];
  const columns = [
    ...(group ? [] : definition.columns || []),
    ...(definition.filters || []).map((filter) => filter.field),
    ...groupBy,
    ...(group?.aggregates || []).map((aggregate) => aggregate.field).filter((field) => field !== undefined && field !== null),
    // Gruplu raporda sıralama toplam başlığına da yapılabilir; o bir sütun değil.
    ...(definition.sort || []).map((entry) => entry.field).filter((field) => !group || groupBy.includes(field)),
  ];
  return [...new Set(columns)];
}

test("katalog biçimi: kimlikler benzersiz ve kebab-case, kategori ve metinler dolu", () => {
  assert.ok(Array.isArray(builtinReports) && builtinReports.length > 0, "katalog boş olmamalı");
  const ids = builtinReports.map((report) => report.id);
  assert.equal(new Set(ids).size, ids.length, `yinelenen kimlik: ${ids.filter((id, index) => ids.indexOf(id) !== index).join(", ")}`);
  for (const report of builtinReports) {
    assert.match(report.id, /^[a-z0-9]+(?:-[a-z0-9]+)*$/, `${report.id} kebab-case olmalı`);
    assert.ok(categories.has(report.category), `${report.id}: tanınmayan kategori ${report.category}`);
    assert.ok(typeof report.name === "string" && report.name.trim(), `${report.id}: ad boş`);
    assert.ok(typeof report.description === "string" && report.description.trim(), `${report.id}: açıklama boş`);
    assert.ok(report.definition && typeof report.definition === "object" && typeof report.definition.resource === "string", `${report.id}: tanım ya da kaynak eksik`);
  }
});

test("her hazır rapor firma sahibi için motordan geçer ve gerçek şemada çalışır", async () => {
  const { env } = await setup();
  // Liste ucu her tanımı motorun kendi kapısından geçirir; sahip için hiçbirinin
  // düşmemesi, hepsinin hatasız plan ürettiği anlamına gelir.
  const listed = await listBuiltin(env, "owner@a.test");
  assert.deepEqual(listed.map((report) => report.id), builtinReports.map((report) => report.id), "sahip bütün kataloğu, katalogdaki sırayla görmeli");

  const failures = [];
  for (const report of builtinReports) {
    for (const preview of [false, true]) {
      const response = await postRun(env, { builtinReportId: report.id, preview }, "owner@a.test");
      if (response.status !== 200) failures.push(`${report.id} (${preview ? "önizleme" : "tam"}): ${response.status} ${JSON.stringify((await payload(response)).error)}`);
    }
  }
  assert.deepEqual(failures, [], "çalışmayan hazır raporlar");
});

test("süzgeçlerdeki durum ve tür kodları sunucunun gerçekten tanıdığı kodlardır", async () => {
  const { env } = await setup();
  const fields = await fieldsFor(env, "owner@a.test");
  const problems = [];
  for (const report of builtinReports) {
    const columns = fields.get(report.definition.resource);
    if (!columns) { problems.push(`${report.id}: ${report.definition.resource} kaynağı alan listesinde yok`); continue; }
    for (const filter of report.definition.filters || []) {
      if (!["eq", "ne", "in"].includes(filter.op) || isRelative(filter.value)) continue;
      const column = columns.find((item) => item.key === filter.field);
      if (!column) { problems.push(`${report.id}: ${filter.field} sütunu yok`); continue; }
      const values = Array.isArray(filter.value) ? filter.value : [filter.value];
      if (column.values) {
        for (const value of values) if (!column.values.includes(value)) problems.push(`${report.id}: ${filter.field}=${JSON.stringify(value)} geçerli bir kod değil`);
      } else if (column.type === "status") {
        // Kümesi bilinmeyen durum sütununda yazılan kodu doğrulamak mümkün değil;
        // hazır raporun buna dayanması sessiz boş sonuç riskidir.
        problems.push(`${report.id}: ${filter.field} için doğrulanabilir kod kümesi yok`);
      }
    }
  }
  assert.deepEqual(problems, [], "uydurma kod sessizce boş rapor döndürür");
});

test("hazır rapor listesi kullanıcının çalıştırabildikleriyle sınırlıdır", async () => {
  // En çok raporu olan kaynak seçilir ki süzmenin hem bıraktığı hem attığı olsun.
  const counts = new Map();
  for (const report of builtinReports) counts.set(report.definition.resource, (counts.get(report.definition.resource) || 0) + 1);
  const [resource] = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];
  const narrow = { id: "dar", email: "dar@a.test", permissions: ["reports.read", `${resource}.read`] };
  const unrelated = { id: "ilgisiz", email: "ilgisiz@a.test", permissions: ["reports.read"] };
  const outsider = { id: "yabanci", email: "yabanci@a.test", permissions: [`${resource}.read`] };
  const { env } = await setup({ users: [narrow, unrelated, outsider] });

  const visible = await fieldsFor(env, narrow.email);
  const expected = builtinReports.filter((report) => {
    const columns = visible.get(report.definition.resource);
    return Boolean(columns) && referencedColumns(report.definition).every((column) => columns.some((item) => item.key === column));
  });
  const listed = await listBuiltin(env, narrow.email);
  assert.deepEqual(listed.map((report) => report.id), expected.map((report) => report.id), "liste, kullanıcının görebildiği kaynak ve sütunlarla birebir örtüşmeli");
  assert.ok(listed.length > 0, "kaynağı okuyabilen kullanıcı en az bir rapor görmeli");
  assert.ok(listed.every((report) => report.definition.resource === resource), "okuyamadığı kaynağın raporu listelenmemeli");
  assert.deepEqual(Object.keys(listed[0]).sort(), ["category", "definition", "description", "id", "name"]);

  // Listede olmayan rapor, kimliği bilinse de çalışmaz.
  const hidden = builtinReports.find((report) => report.definition.resource !== resource);
  if (hidden) {
    assert.ok(!listed.some((report) => report.id === hidden.id));
    assert.equal((await postRun(env, { builtinReportId: hidden.id }, narrow.email)).status, 403);
  }

  // Kaynak yetkisi olmayan kullanıcı hiçbir hazır rapor görmez; rapor yetkisi
  // olmayan ise ucu hiç açamaz.
  const unrelatedList = await listBuiltin(env, unrelated.email);
  assert.ok(unrelatedList.every((report) => report.definition.resource === "saved-reports"));
  assert.equal((await send(env, "/api/v1/reports/builtin", { email: outsider.email })).status, 403);
});

test("korumalı sütuna dokunan hazır rapor, o yetkisi olmayana listelenmez", async (t) => {
  // Hangi sütunun korumalı olduğu elle yazılmaz: sahibin gördüğü ile yalnız
  // kaynak okuma yetkisi olanın gördüğü arasındaki fark korumalı sütunlardır.
  const resources = [...new Set(builtinReports.map((report) => report.definition.resource))];
  const plain = { id: "sade", email: "sade@a.test", permissions: ["reports.read", ...resources.map((resource) => `${resource}.read`)] };
  const trusted = { id: "yetkili", email: "yetkili@a.test", permissions: [...plain.permissions, ...sensitivePermissions] };
  const { env } = await setup({ users: [plain, trusted] });
  const ownerFields = await fieldsFor(env, "owner@a.test");
  const plainFields = await fieldsFor(env, plain.email);
  const guarded = builtinReports.filter((report) => {
    const plainKeys = new Set((plainFields.get(report.definition.resource) || []).map((column) => column.key));
    const ownerKeys = new Set((ownerFields.get(report.definition.resource) || []).map((column) => column.key));
    return referencedColumns(report.definition).some((column) => ownerKeys.has(column) && !plainKeys.has(column));
  });

  const plainIds = (await listBuiltin(env, plain.email)).map((report) => report.id);
  const trustedIds = (await listBuiltin(env, trusted.email)).map((report) => report.id);
  assert.deepEqual(trustedIds, builtinReports.map((report) => report.id), "bütün kaynak ve hassas alan yetkileri olan kullanıcı her şeyi görmeli");
  assert.deepEqual(plainIds, builtinReports.filter((report) => !guarded.includes(report)).map((report) => report.id));
  if (!guarded.length) t.diagnostic("katalogda korumalı sütuna dokunan rapor yok; bu yol yalnız boş kümeyle doğrulandı");
  for (const report of guarded) {
    const response = await postRun(env, { builtinReportId: report.id }, plain.email);
    assert.equal(response.status, 403, `${report.id} korumalı sütun yüzünden çalışmamalı`);
    assert.equal((await payload(response)).error.code, "sensitive_field_forbidden");
  }
});

test("builtinReportId tek kaynak olmalı; bilinmeyen kimlik 404, döküm kendi türüyle iz bırakır", async () => {
  const { database, env } = await setup();
  const [first] = builtinReports;
  const saved = (await payload(await send(env, "/api/v1/saved-reports", {
    method: "POST", body: { name: "Kopya", resource: first.definition.resource, definition_json: first.definition },
  }))).data;
  assert.ok(saved?.id, "hazır raporun kopyası sıradan bir kayıtlı rapor olarak kaydedilebilmeli");

  for (const body of [
    { builtinReportId: first.id, definition: first.definition },
    { builtinReportId: first.id, savedReportId: saved.id },
    { builtinReportId: first.id, savedReportId: saved.id, definition: first.definition },
    {},
  ]) {
    const response = await postRun(env, body);
    assert.equal(response.status, 422, JSON.stringify(Object.keys(body)));
    assert.equal((await payload(response)).error.code, "ambiguous_report_source");
  }
  // null "gönderilmemiş" sayılır; istemci boş alanı null olarak yollayabilir.
  assert.equal((await postRun(env, { builtinReportId: first.id, definition: null, savedReportId: null })).status, 200);

  const unknown = await postRun(env, { builtinReportId: "boyle-bir-rapor-yok" });
  assert.equal(unknown.status, 404);
  assert.equal((await payload(unknown)).error.code, "not_found");
  assert.equal((await postRun(env, { builtinReportId: 42 })).status, 422);
  assert.equal((await postRun(env, { builtinReportId: "__proto__" })).status, 404);

  const exportLogs = () => database.prepare("SELECT * FROM audit_logs WHERE action='export'").all();
  assert.equal(exportLogs().length, 0);
  const plain = await postRun(env, { builtinReportId: first.id });
  assert.equal(plain.status, 200);
  assert.equal(exportLogs().length, 0, "ekrana bakmak iz bırakmamalı");

  const exported = await postRun(env, { builtinReportId: first.id, export: true });
  assert.equal(exported.status, 200);
  const logs = exportLogs();
  assert.equal(logs.length, 1, "döküm tam olarak bir denetim kaydı yazmalı");
  // Hazır rapor saved_reports tablosunda yoktur; iz onu orada aratmamalı.
  assert.equal(logs[0].entity_type, "builtin-reports");
  assert.equal(logs[0].entity_id, first.id);
  assert.equal(logs[0].user_id, "owner-a");
  assert.equal(JSON.parse(logs[0].changes_json).resource, first.definition.resource);
});
