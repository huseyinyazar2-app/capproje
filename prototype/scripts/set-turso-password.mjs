#!/usr/bin/env node
import { createClient } from "@tursodatabase/serverless/compat";
import { __testing } from "../worker/index.js";

const required = ["TURSO_DATABASE_URL", "TURSO_AUTH_TOKEN", "PASSWORD_AUTH_PEPPER", "CAP_PASSWORD_RESET_PHONE", "CAP_PASSWORD_RESET_PASSWORD"];
for (const key of required) if (!process.env[key]) throw new Error(`${key} zorunludur.`);

const phone = __testing.normalizeTurkishMobile(process.env.CAP_PASSWORD_RESET_PHONE);
if (!phone) throw new Error("CAP_PASSWORD_RESET_PHONE geçerli bir Türkiye cep telefonu olmalıdır.");

const credential = await __testing.passwordRecord(process.env, process.env.CAP_PASSWORD_RESET_PASSWORD);
const timestamp = new Date().toISOString();
const client = createClient({ url: process.env.TURSO_DATABASE_URL, authToken: process.env.TURSO_AUTH_TOKEN });
const result = await client.execute({
  sql: "UPDATE users SET password_hash=?,password_salt=?,password_iterations=?,password_changed_at=?,updated_at=? WHERE phone=?",
  args: [credential.hash, credential.salt, credential.iterations, timestamp, timestamp, phone],
});

if (Number(result.rowsAffected || 0) !== 1) throw new Error("Şifresi güncellenecek tek kullanıcı bulunamadı.");
console.log("Password updated for one user.");
