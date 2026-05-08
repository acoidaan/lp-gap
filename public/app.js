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
  tab.addEventListener("click", () => setActiveView(tab.dataset.view));
});

function setActiveView(view) {
  $viewTabs.forEach((tab) => {
    tab.className = tab.dataset.view === view ? "active" : "";
  });
  $views.forEach((section) => {
    section.hidden = section.id !== `${view}-view`;
  });
  if (view === "challenge") refreshChallenge();
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

async function fetchRank(name, tag, reg) {
  const res = await fetch(
    `/api/rank?name=${encodeURIComponent(name)}&tag=${encodeURIComponent(tag)}&region=${reg}`,
  );
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
  "cal destroyersit#EUW": "destr0lol",
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

  return `<a href="${url}" target="_blank" rel="noopener" class="${cls}" title="Twitch: ${esc(handle)}">${label}</a>`;
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

  return `<div class="challenge-player ${leader ? "leading" : ""}">
    <div class="challenge-player-main">
      <div class="challenge-avatar" style="border-color:${tc.bg}">
        <img src="${iconUrl(player.iconId || 29)}" alt="${esc(info.name)}" />
      </div>
      <div class="challenge-player-copy">
        <a href="${opggUrl}" target="_blank" rel="noopener">${esc(info.name)}</a>
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
  const p1Pct = Math.max(8, Math.round((p1.totalLp / maxLp) * 100));
  const p2Pct = Math.max(8, Math.round((p2.totalLp / maxLp) * 100));
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
        return `<div class="ladder-row">
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

      return `<div class="ladder-row">
<span class="ladder-pos" style="color:${posColors[i] || "var(--dim)"}">#${i + 1}</span>
<div class="ladder-avatar" style="border-color:${tc.bg}">
  <img src="${iconUrl(p.iconId || 29)}" alt="${esc(name)}" loading="lazy" />
</div>
<div class="ladder-info">
  <div class="ladder-name"><a href="${opggUrl}" target="_blank" rel="noopener">${esc(name)}</a>${twitchLink}</div>
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
      ladderLastUpdated = cached.timestamp;
      updateLadderTime();
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

  // Cacheamos siempre, aunque algun jugador venga con error. El TTL de
  // 5 min limita lo "rancia" que puede quedar la informacion, y a cambio
  // evitamos el circulo vicioso anterior: si nunca se cacheaba, cada
  // recarga volvia a disparar todas las peticiones contra Riot.
  saveLadderCache(players, cutoffs);

  ladderLastUpdated = Date.now();
  updateLadderTime();

  btn.classList.remove("spinning");
  btn.disabled = false;
  ladderRefreshing = false;
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
    if ($p1.value.includes("#") && $p2.value.includes("#")) compare();
  } catch {}
})();
