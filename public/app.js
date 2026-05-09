const REGIONS = [
  { v: "euw", l: "EUW" },
  { v: "eune", l: "EUNE" },
  { v: "na", l: "NA" },
  { v: "kr", l: "KR" },
  { v: "jp", l: "JP" },
  { v: "br", l: "BR" },
  { v: "las", l: "LAS" },
  { v: "lan", l: "LAN" },
  { v: "oce", l: "OCE" },
  { v: "tr", l: "TR" },
];
const TIERS = [
  "IRON",
  "BRONZE",
  "SILVER",
  "GOLD",
  "PLATINUM",
  "EMERALD",
  "DIAMOND",
  "MASTER",
  "GRANDMASTER",
  "CHALLENGER",
];
const DIVS = ["IV", "III", "II", "I"];
const TIER_COLORS = {
  IRON: { bg: "#8B8589", text: "#fff" },
  BRONZE: { bg: "#CD7F32", text: "#fff" },
  SILVER: { bg: "#9ca3af", text: "#000" },
  GOLD: { bg: "#f0b232", text: "#000" },
  PLATINUM: { bg: "#47C9AF", text: "#000" },
  EMERALD: { bg: "#50C878", text: "#000" },
  DIAMOND: { bg: "#B9F2FF", text: "#000" },
  MASTER: { bg: "#9B59B6", text: "#fff" },
  GRANDMASTER: { bg: "#E74C3C", text: "#fff" },
  CHALLENGER: { bg: "#F1C40F", text: "#000" },
  UNRANKED: { bg: "#3a3b47", text: "#fff" },
};

let region = "euw";
let ddragonVersion = "15.7.1";
const $p1 = document.getElementById("p1");
const $p2 = document.getElementById("p2");
const $btn = document.getElementById("btn");
const $viewTabs = document.querySelectorAll("[data-view]");
const $views = document.querySelectorAll(".app-view");

fetch("https://ddragon.leagueoflegends.com/api/versions.json")
  .then((r) => r.json())
  .then((v) => {
    if (v && v[0]) ddragonVersion = v[0];
  })
  .catch(() => {});

function iconUrl(id) {
  return `https://ddragon.leagueoflegends.com/cdn/${ddragonVersion}/img/profileicon/${id}.png`;
}

// Regions
const $reg = document.getElementById("regions");
REGIONS.forEach((r) => {
  const b = document.createElement("button");
  b.textContent = r.l;
  b.dataset.region = r.v;
  if (r.v === region) b.className = "active";
  b.onclick = () => {
    region = r.v;
    $reg.querySelectorAll("button").forEach((x) => (x.className = ""));
    b.className = "active";
  };
  $reg.appendChild(b);
});

function setRegion(reg) {
  if (!REGIONS.some((r) => r.v === reg)) return;
  region = reg;
  $reg.querySelectorAll("button").forEach((b) => {
    b.className = b.dataset.region === reg ? "active" : "";
  });
}

function emblemUrl(tier) {
  if (!tier || tier === "Unranked") return null;
  return `https://opgg-static.akamaized.net/images/medals_new/${tier.toLowerCase()}.png`;
}
function emblemFallback(tier) {
  return `https://raw.communitydragon.org/latest/plugins/rcp-fe-lol-static-assets/global/default/images/ranked-emblem/emblem-${tier.toLowerCase()}.png`;
}

function animateNumber(el, target, prefix = "", duration = 900) {
  if (!el) return;
  if (target === 0) {
    el.textContent = prefix + "0";
    return;
  }
  const start = performance.now();
  function tick(now) {
    const t = Math.min(1, (now - start) / duration);
    const eased = 1 - Math.pow(1 - t, 3);
    el.textContent = prefix + Math.round(target * eased);
    if (t < 1) requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
}

function check() {
  $btn.disabled = !($p1.value.includes("#") && $p2.value.includes("#"));
}
$p1.addEventListener("input", check);
$p2.addEventListener("input", check);
[$p1, $p2].forEach((el) =>
  el.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !$btn.disabled) compare();
  }),
);
$btn.addEventListener("click", compare);
$viewTabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    setActiveView(tab.dataset.view);
    syncViewUrl(tab.dataset.view);
  });
});

function setActiveView(view) {
  if (!view || !document.getElementById(`${view}-view`)) view = "compare";
  $viewTabs.forEach((tab) => {
    tab.className = tab.dataset.view === view ? "active" : "";
  });
  $views.forEach((section) => {
    section.hidden = section.id !== `${view}-view`;
  });
  document.body.classList.toggle("view-challenge", view === "challenge");
  if (view === "challenge") {
    refreshChallenge();
    startCountdown();
  } else {
    stopCountdown();
    if (view === "stream") initializeStreamTools();
    if (typeof refreshLiveStatus === "function" && lastLadderPlayers.length)
      refreshLiveStatus();
  }
}

function syncViewUrl(view) {
  try {
    const url = new URL(location.href);
    if (view && view !== "compare") url.searchParams.set("view", view);
    else url.searchParams.delete("view");
    history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
  } catch {}
}

// Fechas en hora de Canarias (WEST = UTC+1 en agosto). Empieza el 1 de
// agosto a las 00:00, termina el 1 de septiembre a las 00:00 (no incluido).
const CHALLENGE_START = new Date("2026-08-01T00:00:00+01:00");
const CHALLENGE_END = new Date("2026-09-01T00:00:00+01:00");
let countdownTimer = null;

function challengeState() {
  const now = Date.now();
  if (now < CHALLENGE_START.getTime()) return "upcoming";
  if (now < CHALLENGE_END.getTime()) return "active";
  return "ended";
}

function updateCountdown() {
  const statusEl = document.getElementById("countdown-status");
  const labelEl = document.getElementById("countdown-label");
  const unitsEl = document.getElementById("countdown-units");
  if (!statusEl || !labelEl || !unitsEl) return;

  const state = challengeState();
  statusEl.classList.remove("active", "ended");

  let target = null;
  if (state === "upcoming") {
    statusEl.textContent = "Próximamente";
    labelEl.textContent = "Empieza en";
    target = CHALLENGE_START.getTime();
  } else if (state === "active") {
    statusEl.textContent = "🔴 EN MARCHA";
    statusEl.classList.add("active");
    labelEl.textContent = "Termina en";
    target = CHALLENGE_END.getTime();
  } else {
    statusEl.textContent = "Reto terminado";
    statusEl.classList.add("ended");
    labelEl.textContent = "Cerrado el 1 sep 2026";
  }

  if (target === null) {
    unitsEl.style.display = "none";
    return;
  }
  unitsEl.style.display = "flex";

  const diff = Math.max(0, target - Date.now());
  const total = Math.floor(diff / 1000);
  const days = Math.floor(total / 86400);
  const hours = Math.floor((total % 86400) / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;

  document.getElementById("cd-days").textContent = String(days);
  document.getElementById("cd-hours").textContent = String(hours).padStart(
    2,
    "0",
  );
  document.getElementById("cd-minutes").textContent = String(minutes).padStart(
    2,
    "0",
  );
  document.getElementById("cd-seconds").textContent = String(seconds).padStart(
    2,
    "0",
  );
}

function startCountdown() {
  if (countdownTimer) return;
  updateCountdown();
  countdownTimer = setInterval(updateCountdown, 1000);
}

function stopCountdown() {
  if (countdownTimer) {
    clearInterval(countdownTimer);
    countdownTimer = null;
  }
}

function toLP(tier, div, lp) {
  const i = TIERS.indexOf((tier || "").toUpperCase());
  if (i < 0) return 0;
  if (i >= 7) return 2800 + (lp || 0);
  const d = DIVS.indexOf((div || "").toUpperCase());
  return i * 400 + Math.max(d, 0) * 100 + (lp || 0);
}

function fmtRank(r) {
  if (!r || r.tier === "Unranked") return "UNRANKED";
  const t = r.tier.toUpperCase();
  if (TIERS.indexOf(t) >= 7) return `${r.tier} ${r.lp} LP`;
  return `${r.tier} ${r.division}`;
}

function tierKey(r) {
  return r && r.tier !== "Unranked" ? r.tier.toUpperCase() : "UNRANKED";
}

function getProgressInfo(r) {
  if (!r || r.tier === "Unranked")
    return {
      label: "UNRANKED",
      pct: 0,
      left: "\u2014",
      right: "\u2014",
      valueTxt: "0 LP",
    };
  const t = r.tier.toUpperCase();
  const idx = TIERS.indexOf(t);

  if (idx >= 7) {
    const lpInTier = r.lp;
    if (idx === 7) {
      return {
        label: "MASTER \u2192 CHALLENGER",
        pct: Math.min((lpInTier / 1600) * 100, 100),
        left: "M 0 LP",
        right: "C",
        valueTxt: `${lpInTier} LP`,
      };
    }
    if (idx === 8) {
      return {
        label: "GRANDMASTER",
        pct: Math.min((lpInTier / 1800) * 100, 100),
        left: "GM 0 LP",
        right: "C",
        valueTxt: `${lpInTier} LP`,
      };
    }
    return {
      label: "CHALLENGER",
      pct: 100,
      left: "C",
      right: `${lpInTier} LP`,
      valueTxt: `${lpInTier} LP`,
    };
  }

  const divIdx = DIVS.indexOf((r.division || "").toUpperCase());
  const divLabel = r.division || "IV";
  const pct = Math.min(r.lp, 100);
  return {
    label: `${r.tier} ${divLabel}`,
    pct: pct,
    left: "0 LP",
    right:
      divIdx < 3
        ? `${r.tier} ${DIVS[divIdx + 1]}`
        : TIERS.indexOf(t) < 9
          ? TIERS[TIERS.indexOf(t) + 1].charAt(0) +
            TIERS[TIERS.indexOf(t) + 1].slice(1).toLowerCase()
          : "\u2014",
    valueTxt: `${r.lp} LP`,
  };
}

function esc(s) {
  const d = document.createElement("div");
  d.textContent = s;
  return d.innerHTML;
}

async function fetchRank(name, tag, reg, opts = {}) {
  const url = new URL("/api/rank", location.origin);
  url.searchParams.set("name", name);
  url.searchParams.set("tag", tag);
  url.searchParams.set("region", reg);
  if (opts.fresh) url.searchParams.set("_", String(Date.now()));
  const res = await fetch(`${url.pathname}${url.search}`);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Error");
  return data;
}

const MSGS = [
  "Buscando invocadores...",
  "Consultando rangos...",
  "Calculando gap...",
];
let loadIv;
let lastComparison = null;
let shareStatusTimer;

function setLoading(on) {
  document.getElementById("loading").hidden = !on;
  clearInterval(loadIv);
  if (on) {
    $btn.disabled = true;
    let i = 0;
    loadIv = setInterval(() => {
      i = (i + 1) % MSGS.length;
      document.getElementById("load-msg").textContent = MSGS[i];
    }, 1500);
  } else check();
}
function showError(msg) {
  const e = document.getElementById("error");
  e.textContent = msg;
  e.hidden = false;
}
function hideError() {
  document.getElementById("error").hidden = true;
}

function parseRiotId(riotId) {
  const idx = riotId.indexOf("#");
  if (idx < 0) return { name: riotId.trim(), tag: "" };
  return {
    name: riotId.slice(0, idx).trim(),
    tag: riotId.slice(idx + 1).trim(),
  };
}

const TWITCH_CHANNELS = {
  "koldoabalos#psoe": "Votillas",
  "stellar#aco": "xstellar_",
  "sevillanaenjoyer#carla": "xstellar_",
  "cal destroyersit#euw": "destr0lol",
  "elmiillor11#gordo": "elmiillor",
};

function twitchChannelForRiotId(riotId) {
  const id = parseRiotId(riotId);
  return TWITCH_CHANNELS[`${id.name}#${id.tag}`.toLowerCase()] || null;
}

function buildTwitchLink(riotId, variant = "player") {
  const handle = twitchChannelForRiotId(riotId);
  if (!handle) return "";

  const url = `https://www.twitch.tv/${encodeURIComponent(handle)}`;
  const label = variant === "ladder" ? "TW" : "Twitch";
  const cls =
    variant === "ladder"
      ? "stream-link stream-link-ladder"
      : "ext-link stream-link";

  return `<a href="${url}" target="_blank" rel="noopener" class="${cls}" data-twitch-channel="${esc(handle.toLowerCase())}" title="Twitch: ${esc(handle)}">${label}</a>`;
}

function rankLP(r) {
  return r && typeof r.lp === "number" ? r.lp : 0;
}

function totalGames(r) {
  return (r.wins || 0) + (r.losses || 0);
}

function winRate(r) {
  const total = totalGames(r);
  return total ? Math.round((r.wins / total) * 100) : 0;
}

function buildComparisonUrl() {
  const url = new URL(location.href);
  url.search = "";
  url.searchParams.set("p1", $p1.value.trim());
  url.searchParams.set("p2", $p2.value.trim());
  url.searchParams.set("region", region);
  return url.toString();
}

function setShareStatus(msg) {
  const el = document.getElementById("share-status");
  if (!el) return;
  clearTimeout(shareStatusTimer);
  el.textContent = msg;
  if (msg) {
    shareStatusTimer = setTimeout(() => {
      el.textContent = "";
    }, 3000);
  }
}

async function copyText(text) {
  if (navigator.clipboard && navigator.clipboard.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return;
    } catch {}
  }

  const ta = document.createElement("textarea");
  ta.value = text;
  ta.setAttribute("readonly", "");
  ta.style.position = "fixed";
  ta.style.left = "-9999px";
  document.body.appendChild(ta);
  ta.select();
  const ok = document.execCommand("copy");
  document.body.removeChild(ta);
  if (!ok) throw new Error("copy failed");
}

async function copyShareLink() {
  if (!lastComparison) return;
  try {
    await copyText(lastComparison.shareUrl);
    setShareStatus("Enlace copiado");
  } catch {
    setShareStatus("No se pudo copiar el enlace");
  }
}

function roundRectPath(ctx, x, y, w, h, r) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

function fillRoundRect(ctx, x, y, w, h, r, fill) {
  roundRectPath(ctx, x, y, w, h, r);
  ctx.fillStyle = fill;
  ctx.fill();
}

function strokeRoundRect(ctx, x, y, w, h, r, stroke, width = 2) {
  roundRectPath(ctx, x, y, w, h, r);
  ctx.strokeStyle = stroke;
  ctx.lineWidth = width;
  ctx.stroke();
}

function drawFittedText(ctx, text, x, y, maxWidth, maxSize, minSize, weight) {
  let size = maxSize;
  const fontWeight = weight || 700;
  do {
    ctx.font = `${fontWeight} ${size}px Inter, Arial, sans-serif`;
    if (ctx.measureText(text).width <= maxWidth || size <= minSize) break;
    size -= 2;
  } while (size > minSize);
  ctx.fillText(text, x, y, maxWidth);
}

function drawShareStat(ctx, label, value, x, y, w) {
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = "#6b6d7b";
  ctx.font = "800 16px Inter, Arial, sans-serif";
  ctx.fillText(label, x + w / 2, y);

  ctx.fillStyle = "#e8e8e8";
  drawFittedText(ctx, value, x + w / 2, y + 38, w - 10, 34, 22, 900);
}

function loadCanvasImage(src) {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

function drawClippedImage(ctx, img, x, y, w, h, r) {
  ctx.save();
  roundRectPath(ctx, x, y, w, h, r);
  ctx.clip();

  const scale = Math.max(w / img.width, h / img.height);
  const dw = img.width * scale;
  const dh = img.height * scale;
  ctx.drawImage(img, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);

  ctx.restore();
}

function drawPlayerSharePanel(ctx, player, x, y, w, h) {
  const tk = tierKey(player.rank);
  const tc = TIER_COLORS[tk] || TIER_COLORS.UNRANKED;
  const wr = winRate(player.rank);
  const total = totalGames(player.rank);
  const avatarX = x + 30;
  const avatarY = y + 34;
  const avatarSize = 64;

  fillRoundRect(ctx, x, y, w, h, 22, "#16171e");
  strokeRoundRect(ctx, x, y, w, h, 22, "#2a2b35", 2);
  fillRoundRect(ctx, x, y, w, 6, 22, tc.bg);

  fillRoundRect(ctx, avatarX, avatarY, avatarSize, avatarSize, 16, tc.bg);
  if (player.iconImage) {
    drawClippedImage(
      ctx,
      player.iconImage,
      avatarX,
      avatarY,
      avatarSize,
      avatarSize,
      16,
    );
  } else {
    ctx.fillStyle = tc.text;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    drawFittedText(
      ctx,
      player.name.slice(0, 1).toUpperCase() || "?",
      x + 62,
      y + 67,
      46,
      38,
      24,
      900,
    );
  }
  strokeRoundRect(ctx, avatarX, avatarY, avatarSize, avatarSize, 16, tc.bg, 4);

  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = "#e8e8e8";
  drawFittedText(ctx, player.name, x + 116, y + 62, w - 260, 34, 22, 800);
  ctx.fillStyle = "#6b6d7b";
  drawFittedText(
    ctx,
    `#${player.tag || "-"}`,
    x + 116,
    y + 91,
    w - 260,
    22,
    18,
    700,
  );

  ctx.textAlign = "right";
  ctx.fillStyle = "#3a3b47";
  ctx.font = "800 16px Inter, Arial, sans-serif";
  ctx.fillText(`${total} PARTIDAS`, x + w - 30, y + 70);

  fillRoundRect(ctx, x + 30, y + 122, w - 60, 48, 14, tc.bg);
  ctx.fillStyle = tc.text;
  ctx.textAlign = "center";
  drawFittedText(
    ctx,
    fmtRank(player.rank),
    x + w / 2,
    y + 153,
    w - 90,
    26,
    16,
    900,
  );

  const statY = y + 194;
  const statW = (w - 72) / 3;
  drawShareStat(ctx, "LP", String(rankLP(player.rank)), x + 26, statY, statW);
  drawShareStat(ctx, "WR", `${wr}%`, x + 36 + statW, statY, statW);
  drawShareStat(
    ctx,
    "W / L",
    `${player.rank.wins || 0} / ${player.rank.losses || 0}`,
    x + 46 + statW * 2,
    statY,
    statW,
  );
}

async function makeShareCanvas(data) {
  const canvas = document.createElement("canvas");
  canvas.width = 1200;
  canvas.height = 675;
  const ctx = canvas.getContext("2d");
  const players = await Promise.all(
    data.players.map(async (player) => ({
      ...player,
      iconImage: await loadCanvasImage(iconUrl(player.rank.iconId || 29)),
    })),
  );

  ctx.fillStyle = "#0d0e13";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const grd = ctx.createLinearGradient(0, 0, canvas.width, 0);
  grd.addColorStop(0, "#d946ef");
  grd.addColorStop(0.5, "#f0b232");
  grd.addColorStop(1, "#49b26c");
  ctx.fillStyle = grd;
  ctx.fillRect(0, 0, canvas.width, 10);

  ctx.textBaseline = "alphabetic";
  ctx.textAlign = "left";
  ctx.fillStyle = "#f0b232";
  ctx.font = "900 48px Inter, Arial, sans-serif";
  ctx.fillText("LP GAP", 72, 82);
  ctx.fillStyle = "#6b6d7b";
  ctx.font = "700 22px Inter, Arial, sans-serif";
  ctx.fillText(`${data.regionLabel} SOLOQ COMPARISON`, 72, 118);

  ctx.textAlign = "right";
  ctx.fillStyle = "#3a3b47";
  ctx.font = "700 22px Inter, Arial, sans-serif";
  ctx.fillText("lpgap", canvas.width - 72, 82);

  fillRoundRect(ctx, 376, 138, 448, 194, 28, "#16171e");
  strokeRoundRect(ctx, 376, 138, 448, 194, 28, "#2a2b35", 2);

  ctx.textAlign = "center";
  ctx.fillStyle = "#e8e8e8";
  ctx.font = "800 24px Inter, Arial, sans-serif";
  ctx.fillText("LP GAP", canvas.width / 2, 184);
  ctx.fillStyle = "#f0b232";
  ctx.font = "900 96px Inter, Arial, sans-serif";
  ctx.fillText(
    `${data.diff > 0 ? "+" : ""}${data.diff}`,
    canvas.width / 2,
    268,
  );
  ctx.fillStyle = "#6b6d7b";
  ctx.font = "700 24px Inter, Arial, sans-serif";
  drawFittedText(ctx, data.leaderText, canvas.width / 2, 306, 360, 24, 16, 800);

  drawPlayerSharePanel(ctx, players[0], 72, 370, 500, 245);
  drawPlayerSharePanel(ctx, players[1], 628, 370, 500, 245);

  return canvas;
}

function canvasToBlob(canvas) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("canvas blob failed"));
    }, "image/png");
  });
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function shareFilename(data) {
  const names = data.players
    .map((p) => p.name.toLowerCase().replace(/[^a-z0-9]+/g, "-"))
    .map((p) => p.replace(/^-+|-+$/g, "") || "player")
    .join("-vs-");
  return `lp-gap-${names}.png`;
}

async function copyShareCard() {
  if (!lastComparison) return;
  const btn = document.querySelector('[data-share="card"]');
  if (btn) btn.disabled = true;
  setShareStatus("Generando tarjeta...");

  try {
    const canvas = await makeShareCanvas(lastComparison);
    const blob = await canvasToBlob(canvas);

    if (navigator.clipboard && window.ClipboardItem) {
      await navigator.clipboard.write([
        new ClipboardItem({ "image/png": blob }),
      ]);
      setShareStatus("Tarjeta copiada");
    } else {
      downloadBlob(blob, shareFilename(lastComparison));
      setShareStatus("PNG descargado");
    }
  } catch {
    try {
      const canvas = await makeShareCanvas(lastComparison);
      const blob = await canvasToBlob(canvas);
      downloadBlob(blob, shareFilename(lastComparison));
      setShareStatus("PNG descargado");
    } catch {
      setShareStatus("No se pudo generar la tarjeta");
    }
  } finally {
    if (btn) btn.disabled = false;
  }
}

function bindShareActions(box) {
  box
    .querySelector('[data-share="link"]')
    ?.addEventListener("click", copyShareLink);
  box
    .querySelector('[data-share="card"]')
    ?.addEventListener("click", copyShareCard);
}

function buildPlayerCard(riotId, r) {
  const parts = riotId.split("#");
  const name = esc(parts[0]);
  const tag = esc(parts[1] || "");
  const tk = tierKey(r);
  const tc = TIER_COLORS[tk] || TIER_COLORS.UNRANKED;
  const total = r.wins + r.losses;
  const wrPct = total ? Math.round((r.wins / total) * 100) : 0;
  const wrColor =
    wrPct >= 55 ? "var(--green)" : wrPct >= 50 ? "var(--text)" : "var(--red)";
  const prog = getProgressInfo(r);
  const icon = r.iconId || 29;

  const rawName = parts[0];
  const rawTag = parts[1] || "";
  const opggUrl = `https://www.op.gg/summoners/${region}/${encodeURIComponent(rawName)}-${encodeURIComponent(rawTag)}`;
  const deeplolUrl = `https://www.deeplol.gg/summoner/${region}/${encodeURIComponent(rawName)}-${encodeURIComponent(rawTag)}`;
  const twitchLink = buildTwitchLink(riotId);

  return `
    <div class="player-card">
<div class="player-top">
  <div class="player-name-section">
    <div class="player-avatar" style="border-color:${tc.bg}">
      <img src="${iconUrl(icon)}" alt="${name}" />
    </div>
    <div>
      <div class="player-name">
        ${name}<span class="player-tag"> #${tag}</span>
        <a href="${opggUrl}" target="_blank" class="ext-link">OP.GG</a>
        <a href="${deeplolUrl}" target="_blank" class="ext-link">DeepLoL</a>
        ${twitchLink}
      </div>
    </div>
  </div>
  <div class="player-rank-wrap">
    ${
      r.tier && r.tier !== "Unranked"
        ? `<img class="player-rank-emblem" src="${emblemUrl(r.tier)}" alt="${esc(r.tier)}" onerror="this.onerror=null;this.src='${emblemFallback(r.tier)}';" />`
        : ""
    }
    <div class="player-rank-badge" style="background:${tc.bg};color:${tc.text}">
      ${fmtRank(r)}
    </div>
  </div>
</div>

<div class="stats-row">
  <div class="stat">
    <div class="stat-value">${total}</div>
    <div class="stat-label">Partidas</div>
  </div>
  <div class="stat">
    <div class="stat-value" style="color:${wrColor}">${wrPct}%</div>
    <div class="stat-label">Win Rate</div>
  </div>
  <div class="stat">
    <div class="stat-value" style="color:var(--green)">${r.wins}</div>
    <div class="stat-label">Wins</div>
  </div>
  <div class="stat">
    <div class="stat-value" style="color:var(--red)">${r.losses}</div>
    <div class="stat-label">Losses</div>
  </div>
</div>

<div class="lp-progress">
  <div class="lp-progress-header">
    <span class="lp-progress-title">${prog.label}</span>
    <span class="lp-progress-value" style="color:${tc.bg}">${prog.valueTxt}</span>
  </div>
  <div class="lp-track">
    <div class="lp-fill" style="width:0%;background:${tc.bg}" data-target="${prog.pct}"></div>
  </div>
  <div class="lp-markers">
    <span class="lp-marker">${prog.left}</span>
    <span class="lp-marker">${prog.right}</span>
  </div>
</div>
    </div>`;
}

async function compare() {
  const id1 = $p1.value.trim().split("#");
  const id2 = $p2.value.trim().split("#");
  if (id1.length !== 2 || id2.length !== 2)
    return showError("Formato: Nombre#Tag");

  try {
    const params = new URLSearchParams({
      p1: $p1.value.trim(),
      p2: $p2.value.trim(),
      region,
    });
    history.replaceState(null, "", "?" + params.toString());
  } catch {}

  hideError();
  document.getElementById("results").hidden = true;
  setLoading(true);

  try {
    const [r1, r2] = await Promise.all([
      fetchRank(id1[0], id1[1], region),
      fetchRank(id2[0], id2[1], region),
    ]);

    const p1Id = $p1.value.trim();
    const p2Id = $p2.value.trim();
    const p1Info = parseRiotId(p1Id);
    const p2Info = parseRiotId(p2Id);
    const lp1 = toLP(r1.tier, r1.division, r1.lp);
    const lp2 = toLP(r2.tier, r2.division, r2.lp);
    const diff = Math.abs(lp1 - lp2);
    const leader = lp1 >= lp2 ? 1 : 2;
    const leaderName = leader === 1 ? p1Info.name : p2Info.name;
    const leaderText =
      diff === 0 ? "Mismo rango" : `${leaderName} va por delante`;

    lastComparison = {
      diff,
      leader,
      leaderText,
      regionLabel: region.toUpperCase(),
      shareUrl: buildComparisonUrl(),
      players: [
        { ...p1Info, rank: r1, lp: lp1 },
        { ...p2Info, rank: r2, lp: lp2 },
      ],
    };

    const box = document.getElementById("results");
    box.innerHTML = `
<div class="gap-card">
  <div class="label">LP Gap</div>
  <div class="value">0</div>
  <div class="leader">${
    diff === 0
      ? "Mismo rango"
      : `<strong>${esc(leaderName)}</strong> va por delante`
  }</div>
  <div class="share-panel">
    <div class="share-actions">
      <button type="button" class="share-btn" data-share="link" title="Copia el enlace de esta comparacion">Copiar enlace</button>
      <button type="button" class="share-btn share-btn-primary" data-share="card" title="Copia una imagen PNG; si el navegador no lo permite, la descarga">Copiar tarjeta</button>
    </div>
    <div class="share-status" id="share-status" aria-live="polite"></div>
  </div>
</div>
${buildPlayerCard(p1Id, r1)}
${buildPlayerCard(p2Id, r2)}
    `;
    box.hidden = false;
    bindShareActions(box);

    requestAnimationFrame(() => {
      setTimeout(() => {
        box.querySelectorAll(".lp-fill").forEach((bar) => {
          bar.style.width = bar.dataset.target + "%";
        });
        animateNumber(
          box.querySelector(".gap-card .value"),
          diff,
          diff > 0 ? "+" : "",
        );
      }, 80);
    });
  } catch (e) {
    showError(e.message || "Error al buscar datos");
  }
  setLoading(false);
}

// Stream tools

let streamToolsReady = false;
let obsType = "solo";
let streamCopyTimer = null;

function absoluteUrl(path) {
  return new URL(path, location.origin).toString();
}

function uniqueRiotIds(ids) {
  const seen = new Set();
  return ids.filter((id) => {
    const key = id.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function streamToolPlayers() {
  return uniqueRiotIds([...CHALLENGE_PLAYERS, ...LADDER_PLAYERS]);
}

function setStreamCopyStatus(msg) {
  const el = document.getElementById("stream-copy-status");
  if (!el) return;
  clearTimeout(streamCopyTimer);
  el.textContent = msg;
  if (msg) {
    streamCopyTimer = setTimeout(() => {
      el.textContent = "";
    }, 2600);
  }
}

function clampNumber(value, fallback, min, max) {
  const n = Number.parseInt(value, 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

function buildObsOverlayUrl() {
  const refresh = clampNumber(
    document.getElementById("obs-refresh")?.value,
    60,
    30,
    300,
  );

  if (obsType === "challenge") {
    const cycle = clampNumber(
      document.getElementById("obs-cycle")?.value,
      10,
      3,
      60,
    );
    return absoluteUrl(`/overlay/challenge.html?refresh=${refresh}&cycle=${cycle}`);
  }

  if (obsType === "alerts") {
    const duration = clampNumber(
      document.getElementById("obs-duration")?.value,
      6,
      3,
      20,
    );
    const sound = document.getElementById("obs-sound")?.value === "1" ? "1" : "0";
    const test = document.getElementById("obs-test")?.value === "1" ? "1" : "0";
    return absoluteUrl(
      `/overlay/alerts.html?refresh=${refresh}&duration=${duration}&sound=${sound}&test=${test}`,
    );
  }

  const player = document.getElementById("obs-player")?.value || CHALLENGE_PLAYERS[0];
  return absoluteUrl(
    `/overlay/solo.html?riot=${encodeURIComponent(player)}&region=${CHALLENGE_REGION}&refresh=${refresh}`,
  );
}

function updateObsControls() {
  const playerField = document.getElementById("obs-player-field");
  const cycleField = document.getElementById("obs-cycle-field");
  const durationField = document.getElementById("obs-duration-field");
  const soundField = document.getElementById("obs-sound-field");
  const testField = document.getElementById("obs-test-field");
  if (playerField) playerField.hidden = obsType !== "solo";
  if (cycleField) cycleField.hidden = obsType !== "challenge";
  if (durationField) durationField.hidden = obsType !== "alerts";
  if (soundField) soundField.hidden = obsType !== "alerts";
  if (testField) testField.hidden = obsType !== "alerts";

  document.querySelectorAll("[data-obs-type]").forEach((btn) => {
    btn.className = btn.dataset.obsType === obsType ? "active" : "";
  });

  const out = document.getElementById("obs-url");
  if (out) out.value = buildObsOverlayUrl();
}

function updateCommandSnippets() {
  document.querySelectorAll("[data-command-path]").forEach((input) => {
    input.value = `$(urlfetch ${absoluteUrl(input.dataset.commandPath)})`;
  });
}

function initializeStreamTools() {
  const playerSelect = document.getElementById("obs-player");
  if (!playerSelect) return;

  if (!streamToolsReady) {
    playerSelect.innerHTML = streamToolPlayers()
      .map((riotId) => `<option value="${esc(riotId)}">${esc(riotId)}</option>`)
      .join("");

    document.querySelectorAll("[data-obs-type]").forEach((btn) => {
      btn.addEventListener("click", () => {
        obsType = btn.dataset.obsType || "solo";
        updateObsControls();
      });
    });

    [
      "obs-player",
      "obs-refresh",
      "obs-cycle",
      "obs-duration",
      "obs-sound",
      "obs-test",
    ].forEach((id) => {
      document.getElementById(id)?.addEventListener("input", updateObsControls);
      document.getElementById(id)?.addEventListener("change", updateObsControls);
    });

    document.querySelectorAll("[data-copy-target]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const target = document.getElementById(btn.dataset.copyTarget);
        if (!target) return;
        try {
          await copyText(target.value);
          setStreamCopyStatus("Copiado");
        } catch {
          setStreamCopyStatus("No se pudo copiar");
        }
      });
    });

    document.querySelectorAll("[data-command-copy]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const input = btn.parentElement?.querySelector("input");
        if (!input) return;
        try {
          await copyText(input.value);
          setStreamCopyStatus("Comando copiado");
        } catch {
          setStreamCopyStatus("No se pudo copiar");
        }
      });
    });

    document.getElementById("session-reset")?.addEventListener("click", () => {
      resetStreamSession(lastLadderPlayers);
    });

    streamToolsReady = true;
  }

  updateCommandSnippets();
  updateObsControls();
  renderStreamSession();
}

// Stream session + post-game recaps

const STREAM_SESSION_KEY = "lpgap_stream_session_v1";
const ACTIVE_GAME_KEY = "lpgap_active_games_v1";
const POST_GAME_SEEN_KEY = "lpgap_post_game_seen_v1";

let streamSession = loadJson(STREAM_SESSION_KEY, null);
let activeGames = loadJson(ACTIVE_GAME_KEY, {});
let postGameSeen = loadJson(POST_GAME_SEEN_KEY, {});

function loadJson(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function saveJson(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {}
}

function streamTrackedPlayers(players) {
  const wanted = new Set(CHALLENGE_PLAYERS.map((id) => id.toLowerCase()));
  return (players || []).filter(
    (p) => p && !p.error && p.riotId && wanted.has(p.riotId.toLowerCase()),
  );
}

function playerTotalLp(player) {
  return toLP(player.tier, player.division, player.lp);
}

function playerSnapshot(player) {
  return {
    riotId: player.riotId,
    tier: player.tier,
    division: player.division,
    lp: player.lp || 0,
    wins: player.wins || 0,
    losses: player.losses || 0,
    totalLp:
      typeof player.totalLp === "number" ? player.totalLp : playerTotalLp(player),
    puuid: player.puuid || null,
    ts: Date.now(),
  };
}

function ensureStreamSession() {
  if (!streamSession || !streamSession.startedAt) {
    streamSession = {
      startedAt: Date.now(),
      baselines: {},
      current: {},
    };
  }
  streamSession.baselines = streamSession.baselines || {};
  streamSession.current = streamSession.current || {};
  return streamSession;
}

function resetStreamSession(players = []) {
  streamSession = {
    startedAt: Date.now(),
    baselines: {},
    current: {},
  };
  updateStreamSessionFromPlayers(players);
}

function updateStreamSessionFromPlayers(players) {
  const session = ensureStreamSession();
  streamTrackedPlayers(players).forEach((player) => {
    const snap = playerSnapshot(player);
    if (!session.baselines[player.riotId]) session.baselines[player.riotId] = snap;
    session.current[player.riotId] = snap;
  });
  saveJson(STREAM_SESSION_KEY, session);
  renderStreamSession();
}

function updateStreamSessionPlayer(player) {
  const session = ensureStreamSession();
  const snap = playerSnapshot(player);
  if (!session.baselines[player.riotId]) session.baselines[player.riotId] = snap;
  session.current[player.riotId] = snap;
  saveJson(STREAM_SESSION_KEY, session);
  renderStreamSession();
}

function sessionDelta(current, base) {
  const wins = (current.wins || 0) - (base.wins || 0);
  const losses = (current.losses || 0) - (base.losses || 0);
  const games = wins + losses;
  return {
    lp: (current.totalLp || 0) - (base.totalLp || 0),
    wins,
    losses,
    games,
    wr: games > 0 ? Math.round((wins / games) * 100) : 0,
  };
}

function signedValue(value) {
  return value > 0 ? `+${value}` : String(value);
}

function renderStreamSession() {
  const grid = document.getElementById("session-grid");
  if (!grid) return;

  const session = ensureStreamSession();
  const cards = CHALLENGE_PLAYERS.map((riotId) => {
    const current = session.current[riotId];
    const base = session.baselines[riotId];
    if (!current || !base) return "";
    const info = parseRiotId(riotId);
    const delta = sessionDelta(current, base);
    const lpColor =
      delta.lp > 0
        ? "var(--green)"
        : delta.lp < 0
          ? "var(--red)"
          : "var(--dim)";
    return `<div class="session-player">
      <div class="session-player-head">
        <div class="session-player-name">${esc(info.name)}</div>
        <div class="session-player-rank">${esc(fmtRank(current))}</div>
      </div>
      <div class="session-metrics">
        <div class="session-metric"><strong style="color:${lpColor}">${signedValue(delta.lp)}</strong><span>LP</span></div>
        <div class="session-metric"><strong>${delta.games}</strong><span>Games</span></div>
        <div class="session-metric"><strong>${delta.wins}/${delta.losses}</strong><span>W/L</span></div>
        <div class="session-metric"><strong>${delta.wr}%</strong><span>WR</span></div>
      </div>
    </div>`;
  }).filter(Boolean);

  grid.innerHTML = cards.length
    ? cards.join("")
    : '<div class="session-empty">Cargando sesion...</div>';
}

function rankSummaryForEvent(player) {
  if (!player || player.error) return "rank no disponible";
  return fmtRank(player);
}

function findLadderPlayer(riotId) {
  return (lastLadderPlayers || []).find((p) => p.riotId === riotId);
}

function mergeLadderPlayer(player) {
  const idx = (lastLadderPlayers || []).findIndex((p) => p.riotId === player.riotId);
  if (idx >= 0) lastLadderPlayers[idx] = { ...lastLadderPlayers[idx], ...player };
}

function isStreamRelevantRiotId(riotId) {
  if (!riotId) return false;
  const key = riotId.toLowerCase();
  return (
    CHALLENGE_PLAYERS.some((id) => id.toLowerCase() === key) ||
    Boolean(twitchChannelForRiotId(riotId))
  );
}

async function fetchLatestMatch(player, live) {
  if (!player || !player.puuid) return null;
  const url = new URL("/api/latest-match", location.origin);
  url.searchParams.set("puuid", player.puuid);
  url.searchParams.set("region", LADDER_REGION);
  if (live && live.gameStartTime) {
    url.searchParams.set("startedAfter", String(live.gameStartTime));
  }
  const res = await fetch(`${url.pathname}${url.search}`);
  if (!res.ok) return null;
  return res.json();
}

async function fetchFreshRankForRiotId(riotId) {
  const { name, tag } = parseRiotId(riotId);
  const rank = await fetchRank(name, tag, LADDER_REGION, { fresh: true });
  return {
    riotId,
    ...rank,
    totalLp: toLP(rank.tier, rank.division, rank.lp),
  };
}

function postGameBody(match, lpDelta, rank) {
  const result = match ? (match.win ? "Victoria" : "Derrota") : "Resultado pendiente";
  const champ = match && match.championName ? match.championName : "partida";
  const kda =
    match && typeof match.kills === "number"
      ? `${match.kills}/${match.deaths}/${match.assists} (${match.kda} KDA)`
      : "KDA no disponible";
  return `${result} con ${champ} - ${kda} - ${signedValue(lpDelta)} LP - ${rankSummaryForEvent(rank)}`;
}

async function buildPostGameRecap(riotId, before) {
  const basePlayer = findLadderPlayer(riotId) || before.rank;
  if (!basePlayer) return;

  const match = await fetchLatestMatch(basePlayer, before.live);
  const seenKey = match && match.matchId ? `match:${riotId}:${match.matchId}` : "";
  if (seenKey && postGameSeen[seenKey]) return;

  const after = await fetchFreshRankForRiotId(riotId);
  mergeLadderPlayer(after);
  updateStreamSessionPlayer(after);

  const beforeTotal =
    before.rank && typeof before.rank.totalLp === "number"
      ? before.rank.totalLp
      : playerTotalLp(before.rank || after);
  const lpDelta = after.totalLp - beforeTotal;
  window.dispatchEvent(
    new CustomEvent("lpgap:postgame", {
      detail: {
        riotId,
        match,
        lpDelta,
        rank: after,
        text: postGameBody(match, lpDelta, after),
      },
    }),
  );

  if (seenKey) {
    postGameSeen[seenKey] = Date.now();
    saveJson(POST_GAME_SEEN_KEY, postGameSeen);
  }
}

function handleGameStart(riotId, live) {
  if (activeGames[riotId]) return;
  const player = findLadderPlayer(riotId);
  const rank = player ? playerSnapshot(player) : null;
  activeGames[riotId] = {
    live,
    rank,
    ts: Date.now(),
  };
  saveJson(ACTIVE_GAME_KEY, activeGames);

  const champ = championById && championById[live.championId];
  window.dispatchEvent(
    new CustomEvent("lpgap:game-start", {
      detail: {
        riotId,
        championName: champ ? champ.name : null,
      },
    }),
  );
}

function handleGameEnd(riotId) {
  const before = activeGames[riotId];
  if (!before) return;
  delete activeGames[riotId];
  saveJson(ACTIVE_GAME_KEY, activeGames);

  setTimeout(() => {
    buildPostGameRecap(riotId, before).catch((e) => {
      console.warn("[post-game]", e.message);
    });
  }, 75_000);
}

function processLiveTransitions(prevInGame, nextInGame, prevTwitch, nextTwitch) {
  Object.entries(nextInGame || {}).forEach(([riotId, live]) => {
    if (!isStreamRelevantRiotId(riotId)) return;
    if (prevInGame && prevInGame[riotId]) return;
    handleGameStart(riotId, live);
  });

  Object.keys(prevInGame || {}).forEach((riotId) => {
    if (!isStreamRelevantRiotId(riotId)) return;
    if (nextInGame && nextInGame[riotId]) return;
    handleGameEnd(riotId);
  });

  Object.keys(activeGames || {}).forEach((riotId) => {
    if (!isStreamRelevantRiotId(riotId)) return;
    if (nextInGame && nextInGame[riotId]) return;
    handleGameEnd(riotId);
  });
}

// Challenge

const CHALLENGE_PLAYERS = ["SevillanaEnjoyer#CARLA", "CAL Destroyersit#EUW"];
const CHALLENGE_REGION = "euw";
const CHALLENGE_HISTORY_KEY = "lpgap_challenge_history_v1";
const CHALLENGE_HISTORY_MAX = 90;
let challengeRefreshing = false;

function loadChallengeHistory() {
  try {
    const raw = localStorage.getItem(CHALLENGE_HISTORY_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

async function fetchChallengeHistory() {
  try {
    const res = await fetch("/api/challenge-history");
    const data = await res.json();
    if (!res.ok || !data.configured || !Array.isArray(data.snapshots)) {
      return null;
    }
    return data.snapshots;
  } catch {
    return null;
  }
}

function saveChallengeSnapshot(players) {
  try {
    const history = loadChallengeHistory();
    const lps = {};
    players.forEach((p) => {
      if (!p.error) lps[p.riotId] = p.totalLp;
    });
    const last = history[history.length - 1];
    const snapshot = { ts: Date.now(), lps };

    if (last && snapshot.ts - last.ts < 5 * 60 * 1000) {
      history[history.length - 1] = snapshot;
    } else {
      history.push(snapshot);
    }

    while (history.length > CHALLENGE_HISTORY_MAX) history.shift();
    localStorage.setItem(CHALLENGE_HISTORY_KEY, JSON.stringify(history));
    return history;
  } catch {
    return [];
  }
}

function challengePlayerCard(player, leader) {
  const info = parseRiotId(player.riotId);
  const tk = tierKey(player);
  const tc = TIER_COLORS[tk] || TIER_COLORS.UNRANKED;
  const total = totalGames(player);
  const wr = winRate(player);
  const rankText = fmtRank(player);
  const opggUrl = `https://www.op.gg/summoners/${CHALLENGE_REGION}/${encodeURIComponent(info.name)}-${encodeURIComponent(info.tag || "")}`;

  const twitchLink = buildTwitchLink(player.riotId, "ladder");

  return `<div class="challenge-player ${leader ? "leading" : ""}" data-riot-id="${esc(player.riotId)}">
    <div class="challenge-player-main">
      <div class="challenge-avatar-wrap">
        <div class="challenge-avatar" style="border-color:${tc.bg}">
          <img src="${iconUrl(player.iconId || 29)}" alt="${esc(info.name)}" />
        </div>
        <span class="live-pip" hidden></span>
      </div>
      <div class="challenge-player-copy">
        <div class="challenge-player-namerow">
          <a href="${opggUrl}" target="_blank" rel="noopener">${esc(info.name)}</a>
          ${twitchLink}
          <span class="ladder-live-champ" hidden></span>
        </div>
        <span>#${esc(info.tag || "")}</span>
      </div>
    </div>
    <div class="challenge-rank" style="background:${tc.bg};color:${tc.text}">
      ${rankText}
    </div>
    <div class="challenge-player-stats">
      <div><strong>${player.lp || 0}</strong><span>LP</span></div>
      <div><strong>${wr}%</strong><span>WR</span></div>
      <div><strong>${player.wins || 0}/${player.losses || 0}</strong><span>W/L</span></div>
      <div><strong>${total}</strong><span>Games</span></div>
    </div>
  </div>`;
}

function challengeGraphSvg(history, p1Id, p2Id) {
  const points = history.filter(
    (h) => typeof h.lps[p1Id] === "number" && typeof h.lps[p2Id] === "number",
  );

  if (points.length < 2) {
    return `<div class="challenge-empty">Actualiza varias veces para empezar la grafica.</div>`;
  }

  const width = 520;
  const height = 190;
  const pad = 18;
  const values = points.flatMap((h) => [h.lps[p1Id], h.lps[p2Id]]);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = Math.max(1, max - min);
  const xFor = (i) => pad + (i / (points.length - 1)) * (width - pad * 2);
  const yFor = (v) => height - pad - ((v - min) / range) * (height - pad * 2);
  const lineFor = (id) =>
    points
      .map((h, i) => `${xFor(i).toFixed(1)},${yFor(h.lps[id]).toFixed(1)}`)
      .join(" ");

  return `<svg class="challenge-graph" viewBox="0 0 ${width} ${height}" role="img" aria-label="Evolucion de LP">
    <line x1="${pad}" y1="${height - pad}" x2="${width - pad}" y2="${height - pad}" />
    <line x1="${pad}" y1="${pad}" x2="${pad}" y2="${height - pad}" />
    <polyline class="line-a" points="${lineFor(p1Id)}" />
    <polyline class="line-b" points="${lineFor(p2Id)}" />
  </svg>`;
}

function renderChallenge(players, history, historySource = "local") {
  const body = document.getElementById("challenge-body");
  if (!body) return;

  const [p1, p2] = players;
  if (p1.error || p2.error) {
    body.innerHTML = `<div class="challenge-empty">No se pudo cargar el challenge ahora mismo.</div>`;
    return;
  }

  const diff = Math.abs(p1.totalLp - p2.totalLp);
  const leader = p1.totalLp >= p2.totalLp ? p1 : p2;
  const trailing = leader === p1 ? p2 : p1;
  const leaderName = parseRiotId(leader.riotId).name;
  const trailingName = parseRiotId(trailing.riotId).name;
  const maxLp = Math.max(p1.totalLp, p2.totalLp, 1);
  const p1Pct =
    p1.totalLp === 0 ? 0 : Math.max(8, Math.round((p1.totalLp / maxLp) * 100));
  const p2Pct =
    p2.totalLp === 0 ? 0 : Math.max(8, Math.round((p2.totalLp / maxLp) * 100));
  const verdict =
    diff === 0
      ? "Empate absoluto"
      : `${leaderName} lidera por ${diff} LP sobre ${trailingName}`;

  body.innerHTML = `
    <div class="challenge-score">
      <div class="challenge-score-label">Diferencia actual</div>
      <div class="challenge-score-value">${diff}</div>
      <div class="challenge-score-copy">${esc(verdict)}</div>
    </div>

    <div class="challenge-players">
      ${challengePlayerCard(p1, leader === p1)}
      ${challengePlayerCard(p2, leader === p2)}
    </div>

    <div class="challenge-race">
      <div class="challenge-race-row">
        <span>${esc(parseRiotId(p1.riotId).name)}</span>
        <div class="challenge-race-track">
          <div style="width:${p1Pct}%"></div>
        </div>
        <strong>${p1.totalLp} LP</strong>
      </div>
      <div class="challenge-race-row">
        <span>${esc(parseRiotId(p2.riotId).name)}</span>
        <div class="challenge-race-track">
          <div style="width:${p2Pct}%"></div>
        </div>
        <strong>${p2.totalLp} LP</strong>
      </div>
    </div>

    <div class="challenge-chart-card">
      <div class="challenge-chart-head">
        <span>Evolucion ${historySource}</span>
        <strong>${history.length} snapshots</strong>
      </div>
      ${challengeGraphSvg(history, p1.riotId, p2.riotId)}
      <div class="challenge-legend">
        <span><i class="legend-a"></i>SevillanaEnjoyer</span>
        <span><i class="legend-b"></i>CAL Destroyersit</span>
      </div>
    </div>
  `;

  // Pintar indicadores live en las tarjetas recién creadas. Si la última
  // poll del ranking todavía no ha corrido, simplemente no habrá nada que
  // aplicar — el siguiente tick de polling lo refrescará.
  if (typeof applyLiveIndicators === "function") applyLiveIndicators();
}

async function refreshChallenge(force = false) {
  if (challengeRefreshing) return;
  const view = document.getElementById("challenge-view");
  if (!view || view.hidden) return;

  const body = document.getElementById("challenge-body");
  const btn = document.getElementById("challenge-refresh");
  challengeRefreshing = true;
  if (btn) {
    btn.disabled = true;
    btn.classList.add("spinning");
  }
  if (body && force) {
    body.innerHTML =
      '<div class="ladder-skeleton"></div><div class="ladder-skeleton"></div>';
  }

  try {
    const remoteHistoryPromise = fetchChallengeHistory();
    const players = await Promise.all(
      CHALLENGE_PLAYERS.map(async (riotId) => {
        const { name, tag } = parseRiotId(riotId);
        try {
          const rank = await fetchRank(name, tag, CHALLENGE_REGION);
          return {
            riotId,
            ...rank,
            totalLp: toLP(rank.tier, rank.division, rank.lp),
          };
        } catch (e) {
          return { riotId, error: e.message || "Error" };
        }
      }),
    );
    const remoteHistory = await remoteHistoryPromise;
    const historySource = remoteHistory ? "remota" : "local";
    const history = remoteHistory
      ? remoteHistory
      : players.some((p) => p.error)
        ? loadChallengeHistory()
        : saveChallengeSnapshot(players);
    renderChallenge(players, history, historySource);
  } finally {
    challengeRefreshing = false;
    if (btn) {
      btn.disabled = false;
      btn.classList.remove("spinning");
    }
  }
}

document
  .getElementById("challenge-refresh")
  ?.addEventListener("click", () => refreshChallenge(true));

// Ladder

const LADDER_PLAYERS = [
  "KoldoAbalos#PSOE",
  "ElBachu#123",
  "stellar#ACO",
  "XdestroyersitoX#EUW",
  "MMIAUUU#EUW",
  "xSalva375#EUW",
  "ElPidroIMAX#2538",
  "aco#waifu",
  "LosCocos al aire#wasap",
  "ElmiilloR11#GORDO",
  "SevillanaEnjoyer#CARLA",
  "CAL Destroyersit#EUW",
];
const LADDER_REGION = "euw";
const LADDER_CACHE_KEY = "lpgap_ladder_v1";
const LADDER_CACHE_TTL = 5 * 60 * 1000; // 5 min
const LADDER_HISTORY_KEY = "lpgap_ladder_history_v1";
const LADDER_HISTORY_MAX = 30;

function appendLadderHistory(players) {
  try {
    const raw = localStorage.getItem(LADDER_HISTORY_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    const lps = {};
    for (const p of players) {
      if (!p.error) lps[p.riotId] = toLP(p.tier, p.division, p.lp);
    }
    arr.push({ ts: Date.now(), lps });
    while (arr.length > LADDER_HISTORY_MAX) arr.shift();
    localStorage.setItem(LADDER_HISTORY_KEY, JSON.stringify(arr));
  } catch {}
}

function getPlayerHistory(riotId) {
  try {
    const raw = localStorage.getItem(LADDER_HISTORY_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return arr
      .filter((s) => typeof s.lps[riotId] === "number")
      .map((s) => ({ ts: s.ts, lp: s.lps[riotId] }));
  } catch {
    return [];
  }
}

function lpDelta(history, hours = 24) {
  if (history.length < 2) return null;
  const target = Date.now() - hours * 3600 * 1000;
  const latest = history[history.length - 1];
  // Snapshot mas reciente que sea anterior al objetivo (24h atras).
  // Si no hay ninguno tan antiguo, usamos el mas viejo disponible.
  let reference = history[0];
  for (let i = history.length - 1; i >= 0; i--) {
    if (history[i].ts <= target) {
      reference = history[i];
      break;
    }
  }
  return {
    delta: latest.lp - reference.lp,
    spanMs: latest.ts - reference.ts,
  };
}

function fmtSpan(ms) {
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}min`;
  const h = Math.floor(m / 60);
  if (h < 48) return `${h}h`;
  const d = Math.floor(h / 24);
  return `${d}d`;
}

function sparklineSvg(history, width = 56, height = 14) {
  if (history.length < 2) return "";
  const values = history.map((h) => h.lp);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min;
  const trend = values[values.length - 1] - values[0];
  const color =
    range === 0
      ? "var(--dim)"
      : trend > 0
        ? "var(--green)"
        : trend < 0
          ? "var(--red)"
          : "var(--dim)";
  const stepX = width / (values.length - 1);
  const points = values
    .map((v, i) => {
      const x = i * stepX;
      const y =
        range === 0
          ? height / 2
          : height - 1 - ((v - min) / range) * (height - 2);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  const flatClass = range === 0 ? " flat" : "";
  return `<svg class="ladder-spark${flatClass}" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" aria-hidden="true"><polyline fill="none" stroke="${color}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" points="${points}" /></svg>`;
}

// Tamano de tanda y pausa entre tandas. Cada jugador implica 3 llamadas a
// Riot internamente (account, summoner, league), asi que con BATCH_SIZE=4
// disparamos como mucho 12 peticiones simultaneas. La pausa de ~1.1s deja
// margen frente a los 20 req/s y, sumando todas las tandas, tambien frente
// al limite de 100 req cada 2 minutos de la dev key.
const LADDER_BATCH_SIZE = 4;
const LADDER_BATCH_DELAY_MS = 1100;

let ladderLastUpdated = null;
let ladderRefreshing = false;

function loadLadderCache() {
  try {
    const raw = localStorage.getItem(LADDER_CACHE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data.timestamp || Date.now() - data.timestamp > LADDER_CACHE_TTL)
      return null;
    return data;
  } catch {
    return null;
  }
}

function saveLadderCache(players, cutoffs) {
  try {
    localStorage.setItem(
      LADDER_CACHE_KEY,
      JSON.stringify({
        players,
        cutoffs,
        timestamp: Date.now(),
      }),
    );
  } catch {}
}

async function fetchLadderRank(riotId) {
  const [name, tag] = riotId.split("#");
  try {
    const res = await fetch(
      `/api/rank?name=${encodeURIComponent(name)}&tag=${encodeURIComponent(tag)}&region=${LADDER_REGION}`,
    );
    const data = await res.json();
    if (!res.ok) {
      const isRate = res.status === 429 || /429/.test(data.error || "");
      return {
        riotId,
        error: isRate
          ? "Rate limit (espera 1-2 min)"
          : data.error || `Error ${res.status}`,
      };
    }
    return { riotId, ...data };
  } catch (e) {
    return { riotId, error: "Sin conexi\u00f3n" };
  }
}

// Procesa la lista de jugadores en tandas pequenas con una pausa entre
// ellas para no saturar la API de Riot. Devuelve los resultados en el
// mismo orden que la lista original.
async function fetchLadderInBatches(
  players,
  batchSize = LADDER_BATCH_SIZE,
  delayMs = LADDER_BATCH_DELAY_MS,
) {
  const results = [];
  for (let i = 0; i < players.length; i += batchSize) {
    const batch = players.slice(i, i + batchSize);
    const batchResults = await Promise.all(batch.map(fetchLadderRank));
    results.push(...batchResults);
    // Solo pausamos si quedan tandas por delante; evita la espera final.
    if (i + batchSize < players.length) {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
  return results;
}

async function fetchCutoffs() {
  try {
    const res = await fetch(`/api/cutoff?region=${LADDER_REGION}`);
    const data = await res.json();
    if (!res.ok) {
      console.warn("[cutoff]", res.status, data);
      return { challengerMin: null, grandmasterMin: null };
    }
    return data;
  } catch (e) {
    console.warn("[cutoff] fetch failed:", e.message);
    return { challengerMin: null, grandmasterMin: null };
  }
}

function fmtCutoffLP(v) {
  return typeof v === "number" && v > 0 ? `${v} LP` : "\u2014 LP";
}

function ladderRankStr(p) {
  if (!p || p.tier === "Unranked") return "Unranked";
  const idx = TIERS.indexOf(p.tier.toUpperCase());
  if (idx >= 7) return `${p.tier} \u00b7 ${p.lp} LP`;
  return `${p.tier} ${p.division} \u00b7 ${p.lp} LP`;
}

function renderLadder(players, cutoffs) {
  const sorted = [...players].sort((a, b) => {
    if (a.error && b.error) return 0;
    if (a.error) return 1;
    if (b.error) return -1;
    return toLP(b.tier, b.division, b.lp) - toLP(a.tier, a.division, a.lp);
  });

  const posColors = ["var(--gold)", "#9ca3af", "#CD7F32"];

  const listEl = document.getElementById("ladder-list");
  listEl.innerHTML = sorted
    .map((p, i) => {
      if (p.error) {
        const errMsg =
          typeof p.error === "string" ? p.error : "Error al cargar";
        const [errName, errTag] = p.riotId.split("#");
        const errOpgg = `https://www.op.gg/summoners/${LADDER_REGION}/${encodeURIComponent(errName)}-${encodeURIComponent(errTag || "")}`;
        const errTwitchLink = buildTwitchLink(p.riotId, "ladder");
        return `<div class="ladder-row" data-riot-id="${esc(p.riotId)}">
  <span class="ladder-pos" style="color:${posColors[i] || "var(--dim)"}">#${i + 1}</span>
  <div class="ladder-info" style="margin-left:46px">
    <div class="ladder-name"><a href="${errOpgg}" target="_blank" rel="noopener">${esc(errName)}</a>${errTwitchLink}</div>
    <div class="ladder-rank-str" style="color:var(--red)">${esc(errMsg)}</div>
  </div>
</div>`;
      }

      const tk = tierKey(p);
      const tc = TIER_COLORS[tk] || TIER_COLORS.UNRANKED;
      const total = p.wins + p.losses;
      const wrPct = total ? Math.round((p.wins / total) * 100) : 0;
      const wrColor =
        wrPct >= 55
          ? "var(--green)"
          : wrPct >= 50
            ? "var(--text)"
            : "var(--red)";
      const [name, tag] = p.riotId.split("#");
      const opggUrl = `https://www.op.gg/summoners/${LADDER_REGION}/${encodeURIComponent(name)}-${encodeURIComponent(tag || "")}`;
      const twitchLink = buildTwitchLink(p.riotId, "ladder");
      const history = getPlayerHistory(p.riotId);
      const sparkSvg = sparklineSvg(history);
      let sparkBlockHtml = "";
      if (sparkSvg) {
        const d = lpDelta(history, 24);
        let tipHtml = "";
        if (d) {
          const sign = d.delta > 0 ? "+" : "";
          const dColor =
            d.delta > 0
              ? "var(--green)"
              : d.delta < 0
                ? "var(--red)"
                : "var(--dim)";
          tipHtml = `<span class="spark-tooltip"><span style="color:${dColor}">${sign}${d.delta} LP</span> \u00b7 ${fmtSpan(d.spanMs)}</span>`;
        }
        sparkBlockHtml = `<div class="spark-wrap">${sparkSvg}${tipHtml}</div>`;
      }

      return `<div class="ladder-row" data-riot-id="${esc(p.riotId)}">
<span class="ladder-pos" style="color:${posColors[i] || "var(--dim)"}">#${i + 1}</span>
<div class="ladder-avatar-wrap">
  <div class="ladder-avatar" style="border-color:${tc.bg}">
    <img src="${iconUrl(p.iconId || 29)}" alt="${esc(name)}" loading="lazy" />
  </div>
  <span class="live-pip" hidden></span>
</div>
<div class="ladder-info">
  <div class="ladder-name"><a href="${opggUrl}" target="_blank" rel="noopener">${esc(name)}</a>${twitchLink}<span class="ladder-live-champ" hidden></span></div>
  <div class="ladder-rank-str">
    <span class="ladder-tier-dot" style="background:${tc.bg}"></span>${ladderRankStr(p)}
  </div>
</div>
<div class="ladder-stats">
  <div class="ladder-wl">
    <span class="ladder-w">${p.wins}W</span><span class="ladder-sep">/</span><span class="ladder-l">${p.losses}L</span>
  </div>
  <div class="ladder-wr-val" style="color:${wrColor}">${wrPct}% WR</div>
  ${sparkBlockHtml}
</div>
    </div>`;
    })
    .join("");

  // Update cutoff display
  const gmEl = document.getElementById("cutoff-gm-lp");
  const chalEl = document.getElementById("cutoff-chal-lp");
  if (gmEl) gmEl.textContent = fmtCutoffLP(cutoffs && cutoffs.grandmasterMin);
  if (chalEl)
    chalEl.textContent = fmtCutoffLP(cutoffs && cutoffs.challengerMin);
}

function updateLadderTime() {
  const el = document.getElementById("ladder-updated");
  if (!el) return;
  if (!ladderLastUpdated) {
    el.textContent = "No actualizado";
    return;
  }
  const diff = Math.floor((Date.now() - ladderLastUpdated) / 1000);
  if (diff < 5) el.textContent = "Actualizado ahora";
  else if (diff < 60) el.textContent = `Actualizado hace ${diff}s`;
  else if (diff < 3600)
    el.textContent = `Actualizado hace ${Math.floor(diff / 60)}min`;
  else el.textContent = `Actualizado hace ${Math.floor(diff / 3600)}h`;
}

async function refreshLadder(force = false) {
  if (ladderRefreshing) return;

  // Use cache on initial load if fresh - avoids hammering Riot on every F5
  if (!force) {
    const cached = loadLadderCache();
    if (cached) {
      renderLadder(cached.players, cached.cutoffs);
      updateStreamSessionFromPlayers(cached.players);
      ladderLastUpdated = cached.timestamp;
      updateLadderTime();
      startLivePolling(cached.players);
      return;
    }
  }

  ladderRefreshing = true;

  const btn = document.getElementById("refresh-btn");
  btn.classList.add("spinning");
  btn.disabled = true;

  document.getElementById("ladder-list").innerHTML =
    '<div class="ladder-skeleton"></div>' +
    '<div class="ladder-skeleton"></div>' +
    '<div class="ladder-skeleton"></div>';

  // Cargamos los cutoffs en paralelo con la primera tanda. Las peticiones
  // a /api/rank salen escalonadas dentro de fetchLadderInBatches.
  const [players, cutoffs] = await Promise.all([
    fetchLadderInBatches(LADDER_PLAYERS),
    fetchCutoffs(),
  ]);

  // Guardamos el snapshot antes de renderizar para que el sparkline incluya
  // el LP actual (ultimo punto de la linea).
  appendLadderHistory(players);
  renderLadder(players, cutoffs);
  updateStreamSessionFromPlayers(players);

  // Cacheamos siempre, aunque algun jugador venga con error. El TTL de
  // 5 min limita lo "rancia" que puede quedar la informacion, y a cambio
  // evitamos el circulo vicioso anterior: si nunca se cacheaba, cada
  // recarga volvia a disparar todas las peticiones contra Riot.
  saveLadderCache(players, cutoffs);

  ladderLastUpdated = Date.now();
  updateLadderTime();

  startLivePolling(players);

  btn.classList.remove("spinning");
  btn.disabled = false;
  ladderRefreshing = false;
}

// === Live status (in-game + Twitch) ===

const LIVE_POLL_MS = 60_000;
const liveStatus = { inGame: {}, twitch: {} };
let livePollTimer = null;
let lastLadderPlayers = [];
let championById = null;
let championDataPromise = null;

function loadChampionData() {
  if (championById) return Promise.resolve(championById);
  if (championDataPromise) return championDataPromise;
  championDataPromise = fetch(
    `https://ddragon.leagueoflegends.com/cdn/${ddragonVersion}/data/en_US/champion.json`,
  )
    .then((r) => r.json())
    .then((data) => {
      const map = {};
      for (const champ of Object.values(data.data || {})) {
        map[Number(champ.key)] = champ;
      }
      championById = map;
      return map;
    })
    .catch(() => {
      championById = {};
      return championById;
    });
  return championDataPromise;
}

function championIcon(championId) {
  const champ = championById && championById[championId];
  if (!champ) return null;
  return `https://ddragon.leagueoflegends.com/cdn/${ddragonVersion}/img/champion/${champ.id}.png`;
}

async function fetchLiveForPlayer(p) {
  if (!p.puuid) return null;
  try {
    const res = await fetch(
      `/api/live?puuid=${encodeURIComponent(p.puuid)}&region=${LADDER_REGION}`,
    );
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

async function fetchTwitchLive() {
  const channels = [
    ...new Set(
      LADDER_PLAYERS.map((rid) => twitchChannelForRiotId(rid))
        .filter(Boolean)
        .map((c) => c.toLowerCase()),
    ),
  ];
  if (channels.length === 0) return {};
  try {
    const res = await fetch(
      `/api/twitch-live?channels=${encodeURIComponent(channels.join(","))}`,
    );
    if (!res.ok) return {};
    const data = await res.json();
    return data.streams || {};
  } catch {
    return {};
  }
}

function formatViewerCount(count) {
  const n = Number(count) || 0;
  if (n >= 1000) return `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k`;
  return String(n);
}

function twitchThumbnailUrl(stream) {
  const raw = stream && stream.thumbnailUrl;
  if (!raw) return "";
  return raw.replace("{width}", "320").replace("{height}", "180");
}

function renderLiveNowPanel(streams) {
  const panel = document.getElementById("live-now-panel");
  const list = document.getElementById("live-now-list");
  const count = document.getElementById("live-now-count");
  if (!panel || !list || !count) return;

  const entries = Object.entries(streams || {}).sort(
    (a, b) => (b[1].viewerCount || 0) - (a[1].viewerCount || 0),
  );

  if (!entries.length) {
    panel.hidden = true;
    list.innerHTML = "";
    count.textContent = "0 directos";
    return;
  }

  panel.hidden = false;
  count.textContent = entries.length === 1 ? "1 directo" : `${entries.length} directos`;
  list.innerHTML = entries
    .map(([channel, stream]) => {
      const user = stream.userName || channel;
      const url = `https://www.twitch.tv/${encodeURIComponent(channel)}`;
      const thumb = twitchThumbnailUrl(stream);
      const meta = [
        stream.gameName || "Twitch",
        `${formatViewerCount(stream.viewerCount)} viewers`,
      ].join(" - ");
      return `<a class="live-now-item" href="${url}" target="_blank" rel="noopener">
        <div class="live-thumb">${
          thumb ? `<img src="${esc(thumb)}" alt="${esc(user)}" />` : ""
        }</div>
        <div class="live-copy">
          <div class="live-channel">
            <span class="live-badge">LIVE</span>
            <strong>${esc(user)}</strong>
          </div>
          <div class="live-title">${esc(stream.title || "Directo en Twitch")}</div>
          <div class="live-meta">${esc(meta)}</div>
        </div>
      </a>`;
    })
    .join("");
}

async function refreshLiveStatus() {
  if (!lastLadderPlayers.length) return;
  const prevTwitch = liveStatus.twitch || {};
  const prevInGame = liveStatus.inGame || {};

  const [twitchStreams, ...inGameResults] = await Promise.all([
    fetchTwitchLive(),
    ...lastLadderPlayers.map(fetchLiveForPlayer),
  ]);

  liveStatus.twitch = twitchStreams;
  renderLiveNowPanel(twitchStreams);
  const newInGame = {};
  lastLadderPlayers.forEach((p, i) => {
    const r = inGameResults[i];
    if (r && r.inGame) newInGame[p.riotId] = r;
  });
  liveStatus.inGame = newInGame;

  await loadChampionData();
  processLiveTransitions(prevInGame, newInGame, prevTwitch, twitchStreams);
  applyLiveIndicators();
}

function fmtGameLength(seconds) {
  const s = Math.max(0, Math.floor(seconds || 0));
  if (s < 60) return `${s}s`;
  return `${Math.floor(s / 60)}min`;
}

function applyLiveIndicators() {
  // Selector genérico: cualquier elemento con data-riot-id (filas del
  // ranking + tarjetas del challenge) reusa los mismos slots .live-pip,
  // .ladder-live-champ y .stream-link-ladder[data-twitch-channel].
  document.querySelectorAll("[data-riot-id]").forEach((row) => {
    const riotId = row.dataset.riotId;

    // In-game
    const live = liveStatus.inGame[riotId];
    const pip = row.querySelector(".live-pip");
    const champSlot = row.querySelector(".ladder-live-champ");
    if (live) {
      const champ = championById && championById[live.championId];
      const icon = championIcon(live.championId);
      const champName = champ ? champ.name : "Champion";
      const length = fmtGameLength(live.gameLength);
      const tooltip = `🔴 EN PARTIDA · ${champName}${length ? " · " + length : ""}`;
      if (pip) {
        pip.hidden = false;
        pip.title = tooltip;
      }
      if (champSlot) {
        champSlot.hidden = false;
        champSlot.title = tooltip;
        champSlot.innerHTML = icon
          ? `<img src="${icon}" alt="${esc(champName)}" />`
          : "";
      }
      row.classList.add("is-in-game");
    } else {
      if (pip) {
        pip.hidden = true;
        pip.removeAttribute("title");
      }
      if (champSlot) {
        champSlot.hidden = true;
        champSlot.innerHTML = "";
      }
      row.classList.remove("is-in-game");
    }

    // Twitch live
    const twitchLink = row.querySelector(
      ".stream-link-ladder[data-twitch-channel]",
    );
    if (twitchLink) {
      const channel = twitchLink.dataset.twitchChannel;
      const stream = liveStatus.twitch[channel];
      if (stream) {
        twitchLink.classList.add("is-live");
        twitchLink.textContent = "LIVE";
        twitchLink.title =
          `🔴 ${stream.userName || channel} · ${stream.viewerCount} viewers · ${stream.gameName || ""}`.trim();
      } else {
        twitchLink.classList.remove("is-live");
        twitchLink.textContent = "TW";
        twitchLink.title = `Twitch: ${channel}`;
      }
    }
  });
}

function startLivePolling(players) {
  // Polling continuo: el ranking y la vista del challenge comparten estado
  // (liveStatus), así que mantenemos la misma cadencia siempre. Para cada
  // jugador hace 1 request a /api/live cada 60s — bajo coste con el cache
  // edge de Vercel y compatible con la dev key de Riot.
  lastLadderPlayers = players || [];
  stopLivePolling();
  refreshLiveStatus();
  livePollTimer = setInterval(refreshLiveStatus, LIVE_POLL_MS);
}

function stopLivePolling() {
  if (livePollTimer) {
    clearInterval(livePollTimer);
    livePollTimer = null;
  }
}

document.getElementById("refresh-btn").onclick = () => refreshLadder(true);

setInterval(updateLadderTime, 30000);
refreshLadder();

// URL compartible: precarga inputs y dispara comparacion desde query params
(function loadFromUrl() {
  try {
    const url = new URL(location.href);
    const reg = url.searchParams.get("region");
    if (reg) setRegion(reg);
    const p1 = url.searchParams.get("p1");
    const p2 = url.searchParams.get("p2");
    if (p1) $p1.value = p1;
    if (p2) $p2.value = p2;
    check();
    const requestedView =
      url.searchParams.get("view") ||
      (location.hash ? location.hash.slice(1) : "");
    if (requestedView) setActiveView(requestedView);
    if (
      (!requestedView || requestedView === "compare") &&
      $p1.value.includes("#") &&
      $p2.value.includes("#")
    ) {
      compare();
    }
  } catch {}
})();
