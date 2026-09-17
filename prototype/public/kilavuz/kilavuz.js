// Telefonda içindekiler açılır bir kutudur; bir başlığa gidince kapanmalı.
(function closeTocOnJump() {
  const details = document.getElementById("toc-mobil");
  if (!details) return;
  details.addEventListener("click", (event) => {
    if (event.target.closest("a")) details.open = false;
  });
})();

// Ekran görüntüleri telefonda küçük kalıyor; dokununca tam ekran açılır.
(function lightbox() {
  const dialog = document.getElementById("buyutec");
  const image = document.getElementById("buyutec-resim");
  const close = document.getElementById("buyutec-kapat");
  if (!dialog || !image || typeof dialog.showModal !== "function") return;
  for (const thumb of document.querySelectorAll("figure.sahne img")) {
    thumb.addEventListener("click", () => {
      image.src = thumb.currentSrc || thumb.src;
      image.alt = thumb.alt;
      dialog.showModal();
    });
  }
  close.addEventListener("click", () => dialog.close());
  dialog.addEventListener("click", (event) => { if (event.target === dialog) dialog.close(); });
  dialog.addEventListener("close", () => { image.removeAttribute("src"); });
})();
