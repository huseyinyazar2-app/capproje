#!/usr/bin/env node
import { copyFileSync, cpSync, existsSync, mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "vite";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dist = path.join(root, "dist");
const index = path.join(dist, "client", "index.html");
const worker = path.join(root, "worker", "index.js");
const hosting = path.join(root, ".openai", "hosting.json");
const migrations = path.join(root, "migrations");

for (const file of [index, worker, hosting]) {
  if (!existsSync(file)) throw new Error("Missing Sites build input: " + file);
}

mkdirSync(path.join(dist, "server"), { recursive: true });
mkdirSync(path.join(dist, ".openai"), { recursive: true });
copyFileSync(hosting, path.join(dist, ".openai", "hosting.json"));

await build({
  configFile: false,
  logLevel: "warn",
  build: {
    ssr: worker,
    outDir: path.join(dist, "server"),
    emptyOutDir: false,
    rollupOptions: { output: { entryFileNames: "index.js" } },
  },
  ssr: { noExternal: ["@tursodatabase/serverless"] },
});

if (existsSync(migrations)) {
  cpSync(migrations, path.join(dist, ".openai", "drizzle"), { recursive: true });
}

console.log("Prepared Sites build: bundled worker, hosting bindings and database migrations");
