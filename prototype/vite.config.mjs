import { execSync } from "node:child_process";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Ekranda gösterilen sürüm damgası. Bir dağıtımın sunucuya gerçekten çıkıp
// çıkmadığı ancak uygulamaya bakılarak anlaşılabilmeli; kullanıcıya dosya
// adresi açtırmak çözüm değil. Docker imajında depo geçmişi bulunmadığı için
// commit numarası her zaman okunamaz, derleme zamanı tek başına yeterlidir.
function buildStamp() {
  let commit = "";
  try { commit = execSync("git rev-parse --short HEAD", { stdio: ["ignore", "pipe", "ignore"] }).toString().trim(); }
  catch { /* depo bilgisi olmadan da derlenir */ }
  return { builtAt: new Date().toISOString(), commit };
}

export default defineConfig({
  define: {
    __BUILD_STAMP__: JSON.stringify(buildStamp()),
  },
  build: {
    outDir: "dist/client",
  },
  optimizeDeps: {
    include: ["react", "react-dom/client"],
  },
  server: {
    host: "0.0.0.0",
    allowedHosts: ["terminal.local"],
    warmup: {
      clientFiles: ["./src/main.jsx"],
    },
  },
  plugins: [react()],
});
