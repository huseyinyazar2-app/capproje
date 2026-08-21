"use strict";

const { app, BrowserWindow, Menu, dialog, session, shell } = require("electron");
const { existsSync, readFileSync, writeFileSync } = require("node:fs");
const path = require("node:path");

// Kurulumdan sonra sunucu adresi değişebilir. Müşteriye yeni bir kurulum
// göndermek gerekmesin diye adres sırayla ortam değişkeninden, kullanıcı ayar
// dosyasından ve programın yanındaki ayar dosyasından okunur; hiçbiri yoksa
// yayındaki adres kullanılır.
const DEFAULT_URL = "https://cap.taslak.online";
const SETTINGS_FILE = "capproje-masaustu.json";
const WINDOW_STATE_FILE = "capproje-pencere.json";

function normalizeUrl(value) {
  const candidate = typeof value === "string" ? value.trim() : "";
  // Yalnızca http(s) kabul ediliyor: ayar dosyasına elle yazılmış bir file: ya
  // da javascript: adresi, uygulamanın kendi diskini açmasına yol açabilirdi.
  if (!/^https?:\/\/[^\s/]+/i.test(candidate)) return null;
  return candidate.replace(/\/+$/, "");
}

function readUrlFrom(file) {
  try {
    if (!existsSync(file)) return null;
    return normalizeUrl(JSON.parse(readFileSync(file, "utf8"))?.url);
  } catch {
    // Bozuk bir ayar dosyası uygulamayı açılamaz hale getirmemeli.
    return null;
  }
}

function resolveAppUrl() {
  return (
    normalizeUrl(process.env.CAPPROJE_URL) ||
    readUrlFrom(path.join(app.getPath("userData"), SETTINGS_FILE)) ||
    readUrlFrom(path.join(path.dirname(app.getPath("exe")), SETTINGS_FILE)) ||
    DEFAULT_URL
  );
}

function belongsToApp(target, appUrl) {
  try {
    return new URL(target).origin === new URL(appUrl).origin;
  } catch {
    return false;
  }
}

function windowStatePath() {
  return path.join(app.getPath("userData"), WINDOW_STATE_FILE);
}

function readWindowState() {
  try {
    const state = JSON.parse(readFileSync(windowStatePath(), "utf8"));
    const usable = ["width", "height"].every((key) => Number.isFinite(state?.[key]) && state[key] >= 640);
    return usable ? state : null;
  } catch {
    return null;
  }
}

function saveWindowState(window) {
  try {
    // Tam ekran ya da büyütülmüş haldeki ölçüleri kaydetmek, uygulamanın bir
    // sonraki açılışta ekranı kaplayıp geri küçültülememesine yol açardı.
    const bounds = window.isMaximized() || window.isFullScreen() ? window.getNormalBounds() : window.getBounds();
    writeFileSync(windowStatePath(), JSON.stringify({ ...bounds, maximized: window.isMaximized() }));
  } catch {
    // Ayar yazılamaması uygulamanın kapanmasını engellememeli.
  }
}

function showConnectionError(window, appUrl, description) {
  window.loadFile(path.join(__dirname, "baglanti-yok.html"), { query: { url: appUrl, hata: description || "" } });
}

function showServerInfo(window, appUrl) {
  const settingsPath = path.join(app.getPath("userData"), SETTINGS_FILE);
  dialog
    .showMessageBox(window, {
      type: "info",
      title: "Sunucu Adresi",
      message: appUrl,
      detail: `Adresi değiştirmek için aşağıdaki dosyayı oluşturup uygulamayı yeniden başlatın:\n\n${settingsPath}\n\nDosyanın içeriği:\n{ "url": "https://ornek-adres.com" }`,
      buttons: ["Tamam", "Klasörü Aç"],
      defaultId: 0,
      cancelId: 0,
    })
    .then(({ response }) => {
      if (response === 1) shell.openPath(app.getPath("userData"));
    });
}

function buildMenu(window, appUrl) {
  return Menu.buildFromTemplate([
    {
      label: "Uygulama",
      submenu: [
        { label: "Ana Sayfa", accelerator: "Alt+Home", click: () => window.loadURL(appUrl) },
        { label: "Yenile", role: "reload" },
        { type: "separator" },
        { label: "Geri", accelerator: "Alt+Left", click: () => window.webContents.navigationHistory.goBack() },
        { label: "İleri", accelerator: "Alt+Right", click: () => window.webContents.navigationHistory.goForward() },
        { type: "separator" },
        { label: "Yazdır", accelerator: "CmdOrCtrl+P", click: () => window.webContents.print() },
        { type: "separator" },
        { label: "Çıkış", role: "quit" },
      ],
    },
    {
      label: "Düzen",
      submenu: [
        { label: "Geri Al", role: "undo" },
        { label: "Yinele", role: "redo" },
        { type: "separator" },
        { label: "Kes", role: "cut" },
        { label: "Kopyala", role: "copy" },
        { label: "Yapıştır", role: "paste" },
        { label: "Tümünü Seç", role: "selectAll" },
      ],
    },
    {
      label: "Görünüm",
      submenu: [
        { label: "Yakınlaştır", role: "zoomIn" },
        { label: "Uzaklaştır", role: "zoomOut" },
        { label: "Normal Boyut", role: "resetZoom" },
        { type: "separator" },
        { label: "Tam Ekran", role: "togglefullscreen" },
      ],
    },
    {
      label: "Yardım",
      submenu: [
        { label: "Sunucu Adresi…", click: () => showServerInfo(window, appUrl) },
        { label: "Sürüm: " + app.getVersion(), enabled: false },
        { type: "separator" },
        { label: "Sorun Giderme Araçları", accelerator: "CmdOrCtrl+Shift+I", role: "toggleDevTools" },
      ],
    },
  ]);
}

function createWindow(appUrl) {
  const state = readWindowState();
  const window = new BrowserWindow({
    width: state?.width ?? 1360,
    height: state?.height ?? 880,
    x: state?.x,
    y: state?.y,
    minWidth: 880,
    minHeight: 600,
    // Pencere içerik hazır olmadan gösterilirse önce beyaz bir kare parlıyor.
    show: false,
    backgroundColor: "#fbfaf8",
    title: "Capproje",
    icon: path.join(__dirname, "assets", "icon.png"),
    webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true, spellcheck: false },
  });

  if (state?.maximized) window.maximize();
  window.once("ready-to-show", () => window.show());

  window.webContents.on("did-fail-load", (event, errorCode, errorDescription, validatedURL, isMainFrame) => {
    // ERR_ABORTED (-3), kullanıcı sayfa yüklenirken başka bir yere geçtiğinde de
    // gelir; bunu bağlantı hatası saymak yanlış uyarı verirdi.
    if (!isMainFrame || errorCode === -3) return;
    showConnectionError(window, appUrl, errorDescription);
  });

  // Dış bağlantılar kullanıcının kendi tarayıcısında açılmalı. Aksi halde
  // pencere Capproje'den çıkıp geri dönüş yolu olmayan bir sayfada kalır.
  window.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/i.test(url)) shell.openExternal(url);
    return { action: "deny" };
  });

  window.webContents.on("will-navigate", (event, target) => {
    if (belongsToApp(target, appUrl) || target.startsWith("file://")) return;
    event.preventDefault();
    if (/^https?:/i.test(target)) shell.openExternal(target);
  });

  window.on("close", () => saveWindowState(window));
  window.on("closed", () => {
    mainWindow = null;
  });

  Menu.setApplicationMenu(buildMenu(window, appUrl));
  window.loadURL(appUrl);
  return window;
}

let mainWindow = null;

function start() {
  const appUrl = resolveAppUrl();
  // Sunucu günlüklerinde masaüstü kullanıcılarını ayırt edebilmek için.
  session.defaultSession.setUserAgent(`${session.defaultSession.getUserAgent()} Capproje-Masaustu/${app.getVersion()}`);
  mainWindow = createWindow(appUrl);
}

if (!app.requestSingleInstanceLock()) {
  // Program zaten açıkken kısayola tekrar tıklanırsa ikinci bir pencere yerine
  // mevcut pencere öne getirilir; iki oturum aynı anda açık kalmaz.
  app.quit();
} else {
  app.setAppUserModelId("online.taslak.cap.desktop");

  app.on("second-instance", () => {
    if (!mainWindow) return;
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  });

  app.on("window-all-closed", () => {
    if (process.platform !== "darwin") app.quit();
  });

  app.on("activate", () => {
    if (!mainWindow) mainWindow = createWindow(resolveAppUrl());
  });

  app.whenReady().then(start);
}
