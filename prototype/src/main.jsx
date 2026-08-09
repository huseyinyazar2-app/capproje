import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App.jsx";
import { LiveWorkspace } from "./LiveWorkspace.jsx";
import "./styles.css";

function Root() {
  const params = new URLSearchParams(window.location.search);
  const liveHost = window.location.hostname.endsWith(".chatgpt.site");
  const [prototypeMode, setPrototypeMode] = useState(() => params.get("prototype") === "1" || (!liveHost && params.get("live") !== "1"));

  return prototypeMode ? <App /> : <LiveWorkspace onBackToPrototype={() => setPrototypeMode(true)} />;
}

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>,
);

if ("serviceWorker" in navigator && import.meta.env.PROD) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => undefined);
  });
}
