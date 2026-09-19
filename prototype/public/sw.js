const CACHE_NAME = "capproje-shell-v3";
const APP_SHELL = ["/", "/index.html", "/manifest.webmanifest"];

// Kurulum tek bir dosya yüzünden çökmemeli. cache.addAll listedeki herhangi bir
// istek başarısız olursa tümünü birden iptal eder; bu yüzden service worker hiç
// kurulmuyor, çevrimdışı kabuk da hiç oluşmuyordu. Dosyalar tek tek deneniyor.
async function primeShell() {
  const cache = await caches.open(CACHE_NAME);
  await Promise.all(APP_SHELL.map(async (address) => {
    try {
      const response = await fetch(address, { cache: "reload" });
      if (response.ok) await cache.put(address, response);
    } catch { /* bu dosya olmadan da devam edilir */ }
  }));
}

self.addEventListener("install", (event) => {
  event.waitUntil(primeShell());
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))),
  );
  self.clients.claim();
});

async function cachedShell() {
  return (await caches.match("/index.html")) || (await caches.match("/"));
}

// Geri düğmesiyle açılan sayfalar tarayıcı önbelleğini tazeliğini doğrulamadan
// kullanır. Adrese ait hatalı bir yanıt bir kez saklanmışsa geri tuşu sürekli
// onu gösterir, sunucu düzelse bile. Bu yüzden sayfa açılışlarında önbellek
// atlanıp ağa gidilir. Yönlendirmeler tarayıcıya bırakılır ki adres çubuğu
// hedefi gösterebilsin.
function freshNavigation(request) {
  return fetch(request.url, { cache: "reload", credentials: "same-origin", redirect: "manual" });
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);

  if (request.method !== "GET" || url.origin !== self.location.origin || url.pathname.startsWith("/api/")) return;

  // Sayfa açılışları ayrı ele alınır: sunucudan hatalı bir yanıt gelse bile
  // kullanıcıya boş bir hata sayfası değil, uygulamanın kabuğu gösterilir.
  const isNavigation = request.mode === "navigate";

  event.respondWith((async () => {
    try {
      const response = isNavigation ? await freshNavigation(request) : await fetch(request);
      if (response.type === "opaqueredirect") return response;
      if (response.ok) caches.open(CACHE_NAME).then((cache) => cache.put(request, response.clone())).catch(() => {});
      if (!response.ok && isNavigation) return (await cachedShell()) || response;
      return response;
    } catch {
      return (await caches.match(request))
        || (isNavigation ? await cachedShell() : undefined)
        || Response.error();
    }
  })());
});
