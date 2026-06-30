// script.js
const idleScreen = document.getElementById("screenIdle");
const vipScreen = document.getElementById("screenVip");
const nfcStatus = document.getElementById("nfcStatus");
const transitionOverlay = document.getElementById("transitionOverlay");
const flyerImage = document.getElementById("flyerImage");
const flyerImage2 = document.getElementById("flyerImage2");
const vipProgress = document.getElementById("vipProgress");
const flyerFrame = document.getElementById("flyerFrame");
const vipHint = document.getElementById("vipHint");

const timings = {
  detected: 500,
  validating: 1000,
  transition: 640,
  flyerDuration: 30000,
  flyerSwitch: 720,
};

const zoomConfig = {
  min: 0.6,
  max: 2.2,
  step: 0.1,
};

let zoomLevel = 1;

let flowTimer = null;
let flyerTimer = null;
let progressTimer = null;
let inVip = false;
let vipReady = false;
let flyerIndex = 0; // índice de SECCIÓN (cada sección = 2 flyers)
let flyers = [];

let isTauri = false;
try {
  // eslint-disable-next-line no-undef
  if (window.__TAURI__ && window.__TAURI__.invoke) isTauri = true;
} catch (e) {
  isTauri = false;
}

let debugPanel = null;
let debugVisible = false;

function initDebugPanel() {
  debugPanel = document.createElement("div");
  debugPanel.id = "debugPanel";
  debugPanel.style.cssText = [
    "position:fixed",
    "right:16px",
    "bottom:16px",
    "max-width:560px",
    "max-height:40vh",
    "overflow:auto",
    "background:rgba(8,8,10,0.82)",
    "color:#f5f4ef",
    "border:1px solid rgba(255,255,255,0.18)",
    "padding:10px 12px",
    "font:12px/1.4 monospace",
    "border-radius:8px",
    "box-shadow:0 10px 30px rgba(0,0,0,0.45)",
    "z-index:99999",
    "display:none"
  ].join(";");
  document.body.appendChild(debugPanel);
}

function setDebugVisible(state) {
  debugVisible = state;
  if (debugPanel) debugPanel.style.display = debugVisible ? "block" : "none";
}

function logDebug(message, level = "info") {
  const prefix = level.toUpperCase();
  // eslint-disable-next-line no-console
  if (level === "error") console.error(message);
  else if (level === "warn") console.warn(message);
  else console.log(message);

  if (!debugPanel) return;
  const line = document.createElement("div");
  line.textContent = `[${prefix}] ${message}`;
  debugPanel.appendChild(line);
  debugPanel.scrollTop = debugPanel.scrollHeight;
}

window.addEventListener("error", (event) => {
  logDebug(`JS error: ${event.message}`, "error");
});

window.addEventListener("unhandledrejection", (event) => {
  logDebug(`Promise rejection: ${event.reason}`, "error");
});

// Diagnóstico: útil para confirmar en runtime qué ruta está usando el .exe
async function logFlyersPathIfTauri() {
  // get_flyers_path no está implementado en el backend, omitir silenciosamente
  return;
}

function setStatus(text) {
  if (nfcStatus) nfcStatus.textContent = text;
}

function applyZoom(level) {
  zoomLevel = Math.min(zoomConfig.max, Math.max(zoomConfig.min, level));
  document.documentElement.style.zoom = String(zoomLevel);
}

function adjustZoom(delta) {
  applyZoom(Number((zoomLevel + delta).toFixed(2)));
}

function resetZoom() {
  applyZoom(1);
}

function clearTimers() {
  if (flowTimer) clearTimeout(flowTimer);
  if (flyerTimer) clearTimeout(flyerTimer);
  if (progressTimer) clearTimeout(progressTimer);
  flowTimer = null;
  flyerTimer = null;
  progressTimer = null;
}

function playTransition() {
  if (!transitionOverlay) return;
  transitionOverlay.classList.remove("is-active");
  void transitionOverlay.offsetWidth;
  transitionOverlay.classList.add("is-active");
  setTimeout(() => transitionOverlay.classList.remove("is-active"), timings.transition + 40);
}

function showIdle() {
  inVip = false;
  vipReady = false;
  clearTimers();

  vipScreen?.classList.remove("is-active");
  vipScreen?.setAttribute("aria-hidden", "true");

  idleScreen?.classList.add("is-active");
  idleScreen?.classList.remove("fade-out");
  idleScreen?.setAttribute("aria-hidden", "false");

  setStatus("Esperando tarjeta...");
}

function showVip() {
  idleScreen?.classList.remove("is-active");
  idleScreen?.setAttribute("aria-hidden", "true");

  vipScreen?.classList.add("is-active");
  vipScreen?.setAttribute("aria-hidden", "false");

  inVip = true;
  vipReady = true;
}

function naturalFlyerSort(a, b) {
  // Ordena flyer2 antes que flyer10
  const ax = a.match(/(\d+)/);
  const bx = b.match(/(\d+)/);
  const an = ax ? Number(ax[1]) : Number.POSITIVE_INFINITY;
  const bn = bx ? Number(bx[1]) : Number.POSITIVE_INFINITY;
  if (an !== bn) return an - bn;
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" });
}

async function loadFlyersTauri() {
  try {
    // eslint-disable-next-line no-undef
    const { invoke } = window.__TAURI__;
    const list = await invoke('list_flyers');
    if (Array.isArray(list)) {
      return list;
    }
  } catch (e) {
    // ignore
  }
  return null;
}

function canLoadImage(src, timeoutMs = 2500) {
  return new Promise((resolve) => {
    const img = new Image();
    let done = false;
    const finish = (ok) => {
      if (done) return;
      done = true;
      resolve(ok);
    };

    const timer = setTimeout(() => finish(false), timeoutMs);

    img.onload = () => {
      clearTimeout(timer);
      finish(true);
    };
    img.onerror = () => {
      clearTimeout(timer);
      finish(false);
    };
    // No añadir cache-buster a data URIs, las rompe
    if (src && src.startsWith('data:')) {
      img.src = src;
    } else {
      img.src = `${src}${src.includes("?") ? "&" : "?"}v=${Date.now()}`;
    }
  });
}

async function verifyFlyers(list) {
  const results = [];
  for (const p of list) {
    // eslint-disable-next-line no-await-in-loop
    const ok = await canLoadImage(p, 4000);
    results.push({ p, ok });
  }
  results.forEach((r) => logDebug(`Flyer ${r.ok ? "OK" : "FAIL"}: ${r.p}`, r.ok ? "info" : "warn"));
}

async function loadFlyers() {
  // En TAURI: la fuente de verdad es SIEMPRE list_flyers() (carpeta externa en AppData).
  // No hacemos fallback a assets internos, porque eso confunde cuando quisiste dejar solo 1-2 flyers.
  if (isTauri) {
    logDebug("Modo Tauri detectado");
    await logFlyersPathIfTauri();

    const tauriList = await loadFlyersTauri();
    const clean = Array.isArray(tauriList) ? tauriList.filter(Boolean) : [];
    logDebug(`list_flyers() devolvio ${clean.length} item(s)`);

    // Si el backend devuelve data URIs (base64), usarlas directamente SIN convertFileSrc
    const allAreDataUris = clean.length > 0 && clean.every((p) => p.startsWith('data:'));
    let converted = clean;
    if (!allAreDataUris) {
      try {
        // eslint-disable-next-line no-undef
        const tauriApi = window.__TAURI__ && window.__TAURI__.tauri;
        const convert = tauriApi && tauriApi.convertFileSrc;
        if (typeof convert === "function") {
          converted = clean.map((p) => convert(p));
          logDebug("convertFileSrc aplicado a rutas locales");
        } else {
          logDebug("convertFileSrc no disponible, usando rutas directas", "warn");
        }
      } catch (err) {
        logDebug(`Error en convertFileSrc: ${err}`, "error");
      }
    } else {
      logDebug("Flyers son data URIs, usando directamente sin convertFileSrc");
    }

    // Maximo 5
    flyers = converted.slice(0, 5);

    logDebug(`Flyers finales: ${flyers.length}`);
    await verifyFlyers(flyers);

    return flyers;
  }

  logDebug("Modo navegador (no Tauri)");

  // Sin backend no podemos “listar” carpetas en el navegador.
  // Solución robusta: intenta un manifest generado (flyers.json). Si no existe,
  // cae a un set por defecto (flyer1..flyerN) y se queda con los que de verdad cargan.

  const candidatesFromJson = await fetch("assets/flyers/flyers.json", { cache: "no-store" })
    .then((r) => (r.ok ? r.json() : null))
    .catch(() => null);

  if (Array.isArray(candidatesFromJson) && candidatesFromJson.length) {
    const normalized = candidatesFromJson
      .map((p) => String(p).trim())
      .filter(Boolean)
      .map((p) => (p.startsWith("assets/") ? p : `assets/flyers/${p}`));

    const filtered = [];
    for (const path of normalized.sort(naturalFlyerSort)) {
      // eslint-disable-next-line no-await-in-loop
      if (await canLoadImage(path)) filtered.push(path);
    }

    return filtered;
  }

  // Fallback: prueba nombres comunes hasta max.
  const exts = ["jpg", "jpeg", "png", "webp"];
  const max = 12;
  const candidates = [];
  for (let i = 1; i <= max; i += 1) {
    for (const ext of exts) candidates.push(`assets/flyers/flyer${i}.${ext}`);
  }

  const existing = [];
  for (const path of candidates) {
    // eslint-disable-next-line no-await-in-loop
    const ok = await canLoadImage(path);
    if (ok) existing.push(path);
  }

  // Si no encuentra nada, como mínimo intenta flyer2.jpg
  if (!existing.length) {
    const fallback = "assets/flyers/flyer2.jpg";
    if (await canLoadImage(fallback)) return [fallback];
  }

  return existing.sort(naturalFlyerSort);
}

function buildProgress() {
  if (!vipProgress) return;
  vipProgress.innerHTML = "";
  const sections = totalSections();
  vipProgress.classList.toggle("single", sections === 1);

  for (let i = 0; i < sections; i++) {
    const segment = document.createElement("div");
    segment.className = "vip-progress-segment";
    segment.style.setProperty("--segment-duration", `${timings.flyerDuration}ms`);
    segment.dataset.index = String(i);
    vipProgress.appendChild(segment);
  }
}

function paintProgress() {
  if (!vipProgress) return;
  const segments = Array.from(vipProgress.querySelectorAll(".vip-progress-segment"));
  segments.forEach((segment, index) => {
    segment.classList.remove("is-active", "is-done");
    if (index < flyerIndex) segment.classList.add("is-done");
    if (index === flyerIndex) segment.classList.add("is-active");
  });
}

function totalSections() {
  return Math.ceil(flyers.length / 2);
}

function setFlyer(index, animate = true) {
  if (!flyers.length || !flyerImage) return;
  flyerIndex = Math.max(0, Math.min(index, totalSections() - 1));

  const url1 = flyers[flyerIndex * 2] || null;
  const url2 = flyers[flyerIndex * 2 + 1] || null;

  const applyPair = () => {
    // imagen 1 siempre visible si existe
    if (url1) {
      flyerImage.src = url1;
      flyerImage.classList.remove('flyer-pair-hidden');
    } else {
      flyerImage.classList.add('flyer-pair-hidden');
    }
    // imagen 2 solo si hay par
    if (url2) {
      flyerImage2.src = url2;
      flyerImage2.classList.remove('flyer-pair-hidden');
    } else {
      flyerImage2.classList.add('flyer-pair-hidden');
    }
  };

  if (!animate) {
    applyPair();
    return;
  }

  flyerFrame?.classList.remove('is-transitioning');
  flyerImage.classList.remove('is-transitioning');
  flyerImage2.classList.remove('is-transitioning');
  void flyerImage.offsetWidth;
  flyerFrame?.classList.add('is-transitioning');
  flyerImage.classList.add('is-transitioning');
  flyerImage2.classList.add('is-transitioning');

  setTimeout(() => {
    applyPair();
  }, 220);

  setTimeout(() => {
    flyerFrame?.classList.remove('is-transitioning');
    flyerImage.classList.remove('is-transitioning');
    flyerImage2.classList.remove('is-transitioning');
  }, timings.flyerSwitch);
}

function clearFlyerImage() {
  if (flyerImage) {
    flyerImage.removeAttribute("src");
  }
}

function scheduleProgressPaint() {
  if (progressTimer) clearTimeout(progressTimer);
  progressTimer = setTimeout(() => {
    paintProgress();
  }, Math.floor(timings.flyerSwitch * 0.32));
}

function scheduleFlyerAuto() {
  if (flyerTimer) clearTimeout(flyerTimer);
  flyerTimer = setTimeout(() => {
    if (vipReady) advanceFlyer(false);
  }, timings.flyerDuration);
}

function advanceFlyer(manual = false) {
  if (!inVip || !vipReady) return;

  if (totalSections() <= 1) {
    endVipCycle();
    return;
  }

  if (flyerIndex < totalSections() - 1) {
    setFlyer(flyerIndex + 1, true);
    scheduleProgressPaint();
    scheduleFlyerAuto();
  } else {
    endVipCycle();
  }

  if (manual) setStatus("Navegación VIP manual");
}

function endVipCycle() {
  vipReady = false;
  clearTimers();
  playTransition();
  setTimeout(() => {
    showIdle();
  }, timings.transition - 80);
}

function updateVipHintVisibility() {
  if (!vipHint) return;
  vipHint.style.display = totalSections() > 1 ? "block" : "none";
}

async function startVipSequence() {
  flyers = await loadFlyers();
  updateVipHintVisibility();

  if (!flyers.length) {
    buildProgress();
    paintProgress();
    clearFlyerImage();
    scheduleFlyerAuto();
    return;
  }

  buildProgress();
  setFlyer(0, false);
  paintProgress();
  scheduleFlyerAuto();
}

function goVipNow() {
  clearTimers();
  setStatus("TARJETA DETECTADA");

  flowTimer = setTimeout(() => {
    setStatus("VALIDANDO ACCESO...");

    flowTimer = setTimeout(() => {
      setStatus("ACCESO VIP CONFIRMADO");
      idleScreen?.classList.add("fade-out");
      playTransition();

      flowTimer = setTimeout(() => {
        showVip();
        startVipSequence();
      }, timings.transition - 80);
    }, timings.validating);
  }, timings.detected);
}

function handleNfcValue(value) {
  if (value === " ") {
    goVipNow();
  }
}

function forceBackToIdle() {
  clearTimers();
  playTransition();
  setTimeout(() => {
    showIdle();
  }, timings.transition - 80);
}

function startFlow() {
  showIdle();
}

window.addEventListener("keydown", (event) => {
  if ((event.ctrlKey || event.metaKey) && (event.key === "+" || event.key === "=")) {
    event.preventDefault();
    adjustZoom(zoomConfig.step);
    return;
  }

  if ((event.ctrlKey || event.metaKey) && event.key === "-") {
    event.preventDefault();
    adjustZoom(-zoomConfig.step);
    return;
  }

  if ((event.ctrlKey || event.metaKey) && (event.key === "0" || event.code === "Digit0")) {
    event.preventDefault();
    resetZoom();
    return;
  }

  if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key.toLowerCase() === "d") {
    event.preventDefault();
    setDebugVisible(!debugVisible);
    return;
  }

  if (event.key === "Enter" || event.code === "Enter" || event.code === "NumpadEnter") {
    event.preventDefault();
    if (!inVip) {
      handleNfcValue(" ");
    } else {
      advanceFlyer(true);
    }
  }

  if (event.code === "Escape") {
    event.preventDefault();
    forceBackToIdle();
  }
});

window.addEventListener("wheel", (event) => {
  if (event.ctrlKey || event.metaKey) {
    event.preventDefault();
    const direction = event.deltaY > 0 ? -1 : 1;
    adjustZoom(direction * zoomConfig.step);
  }
}, { passive: false });

window.addEventListener("load", () => {
  initDebugPanel();
  logDebug("Debug panel listo (Ctrl+Shift+D para mostrar/ocultar)");
  resetZoom();
  startFlow();
});
window.addEventListener("beforeunload", clearTimers);