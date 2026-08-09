#!/usr/bin/env node
import { __testing } from "../worker/index.js";

const required = ["BOOTSTRAP_SECRET", "CAP_BOOTSTRAP_OWNER_PHONE", "CAP_BOOTSTRAP_OWNER_PASSWORD"];
for (const key of required) if (!process.env[key]) throw new Error(`${key} zorunludur.`);

const response = await __testing.handleApi(new Request("https://bootstrap.local/api/v1/bootstrap", {
  method: "POST",
  headers: { "content-type": "application/json", "x-bootstrap-secret": process.env.BOOTSTRAP_SECRET },
  body: JSON.stringify({
    tenant_name: process.env.CAP_BOOTSTRAP_TENANT_NAME || "Capproje Orman Ürünleri",
    tenant_slug: process.env.CAP_BOOTSTRAP_TENANT_SLUG || "capproje",
    owner_email: process.env.CAP_BOOTSTRAP_OWNER_EMAIL || "yonetici@capproje.local",
    owner_name: process.env.CAP_BOOTSTRAP_OWNER_NAME || "Capproje Yöneticisi",
    owner_phone: process.env.CAP_BOOTSTRAP_OWNER_PHONE,
    owner_password: process.env.CAP_BOOTSTRAP_OWNER_PASSWORD,
    owner_title: "Firma Sahibi",
  }),
}), process.env);

const payload = await response.json();
if (!response.ok) throw new Error(payload?.error?.message || "İlk kullanıcı oluşturulamadı.");
console.log(`Bootstrap completed for ${payload.data.tenant.slug}.`);
