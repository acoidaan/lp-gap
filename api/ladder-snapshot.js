const {
  fetchLatestSnapshot,
  fetchRankForRiotId,
  isAuthorized,
  isDatabaseConfigured,
  saveSnapshot,
} = require("./_challenge");
const { postWebhook, isDiscordConfigured } = require("./_discord");

const LADDER_ID = "ladder-euw-main";
const LADDER_REGION = "euw";
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

const TIER_ORDER = [
  "Iron",
  "Bronze",
  "Silver",
  "Gold",
  "Platinum",
  "Emerald",
  "Diamond",
  "Master",
  "Grandmaster",
  "Challenger",
];
const TIER_COLORS = {
  Iron: 0x8b8589,
  Bronze: 0xcd7f32,
  Silver: 0x9ca3af,
  Gold: 0xf0b232,
  Platinum: 0x47c9af,
  Emerald: 0x50c878,
  Diamond: 0xb9f2ff,
  Master: 0x9b59b6,
  Grandmaster: 0xe74c3c,
  Challenger: 0xf1c40f,
};

function tierIndex(tier) {
  if (!tier || tier === "Unranked") return -1;
  return TIER_ORDER.indexOf(tier);
}

function isPromotion(prevTier, newTier) {
  if (newTier === "Unranked") return false;
  if (prevTier === "Unranked") return true; // colocaciones → primer tier
  return tierIndex(newTier) > tierIndex(prevTier);
}

function fmtRank(p) {
  if (!p || p.tier === "Unranked") return "Unranked";
  if (tierIndex(p.tier) >= 7) return `${p.tier} ${p.lp} LP`;
  return `${p.tier} ${p.division} · ${p.lp} LP`;
}

function fmtDelta(delta) {
  if (delta === null || delta === undefined) return "—";
  if (delta > 0) return `🟢 +${delta}`;
  if (delta < 0) return `🔴 ${delta}`;
  return "⚪ 0";
}

function emblemUrl(tier) {
  return `https://opgg-static.akamaized.net/images/medals_new/${tier.toLowerCase()}.png`;
}

function buildEmbeds(rankedPlayers, promotions) {
  const lines = rankedPlayers.map((entry, i) => {
    const { player, delta } = entry;
    return `**#${i + 1}** \`${player.name}\` — ${fmtRank(player)} \`${fmtDelta(delta)}\``;
  });

  const summary = {
    title: "🏆 LP GAP — Resumen diario",
    description: lines.join("\n") || "_Sin datos_",
    color: 0xf0b232,
    timestamp: new Date().toISOString(),
    footer: { text: "EUW SoloQ · Snapshot 07:00 UTC" },
  };

  const promoEmbeds = promotions.map((p) => ({
    title: `🎉 ¡Promoción! ${p.name}`,
    description: `**${p.prevTier}** → **${p.newTier}** 🔥`,
    color: TIER_COLORS[p.newTier] || 0xf0b232,
    thumbnail: { url: emblemUrl(p.newTier) },
  }));

  return [summary, ...promoEmbeds].slice(0, 10); // Discord cap de 10 embeds
}

module.exports = async (req, res) => {
  if (req.method && !["GET", "POST"].includes(req.method)) {
    return res.status(405).json({ error: "Método no permitido" });
  }
  if (!isAuthorized(req)) {
    return res.status(401).json({ error: "No autorizado" });
  }
  if (!isDatabaseConfigured()) {
    return res.status(500).json({ error: "DATABASE_URL no configurada" });
  }
  const apiKey = process.env.RIOT_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "RIOT_API_KEY no configurada" });
  }

  try {
    // 1. Snapshot anterior (antes de guardar el nuevo, para que sea el de ayer)
    const previous = await fetchLatestSnapshot(LADDER_ID);

    // 2. Datos actuales de Riot. Secuencial para no machacar la API.
    const players = [];
    for (const riotId of LADDER_PLAYERS) {
      try {
        const p = await fetchRankForRiotId(riotId, LADDER_REGION, apiKey);
        players.push(p);
      } catch (e) {
        console.warn(`Skip ${riotId}:`, e.message);
      }
    }

    // 3. Persistimos el snapshot de hoy
    const recordedAt = await saveSnapshot(players, LADDER_ID);

    // 4. Calculamos deltas + promociones contra el snapshot anterior
    const ranked = players
      .map((p) => {
        const prev = previous.byRiotId[p.riotId];
        const delta = prev ? p.totalLp - prev.totalLp : null;
        return { player: p, prev, delta };
      })
      .sort((a, b) => b.player.totalLp - a.player.totalLp);

    const promotions = ranked
      .filter(
        ({ player, prev }) =>
          prev && isPromotion(prev.tier, player.tier),
      )
      .map(({ player, prev }) => ({
        name: player.name,
        prevTier: prev.tier,
        newTier: player.tier,
      }));

    // 5. Discord
    let discordResult = { skipped: true };
    if (isDiscordConfigured()) {
      const embeds = buildEmbeds(ranked, promotions);
      discordResult = await postWebhook({ embeds });
    }

    res.json({
      ok: true,
      ladderId: LADDER_ID,
      recordedAt: recordedAt.toISOString(),
      playerCount: players.length,
      promotionCount: promotions.length,
      discord: discordResult,
    });
  } catch (e) {
    console.error("LADDER SNAPSHOT ERROR:", e.message);
    res.status(500).json({ error: e.message });
  }
};
