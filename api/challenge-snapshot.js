const {
  CHALLENGE_ID,
  CHALLENGE_PLAYERS,
  CHALLENGE_REGION,
  fetchLatestSnapshot,
  fetchRankForRiotId,
  isAuthorized,
  isDatabaseConfigured,
  saveSnapshot,
} = require("./_challenge");
const { postWebhook, isDiscordConfigured } = require("./_discord");

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
  if (prevTier === "Unranked") return true;
  return tierIndex(newTier) > tierIndex(prevTier);
}

function fmtRank(p) {
  if (!p || p.tier === "Unranked") return "Unranked";
  if (tierIndex(p.tier) >= 7) return `${p.tier} · ${p.lp} LP`;
  return `${p.tier} ${p.division} · ${p.lp} LP`;
}

function fmtDelta(delta) {
  if (delta === null || delta === undefined) return "—";
  if (delta > 0) return `🟢 +${delta}`;
  if (delta < 0) return `🔴 −${Math.abs(delta)}`;
  return "⚪ 0";
}

function emblemUrl(tier) {
  return `https://opgg-static.akamaized.net/images/medals_new/${tier.toLowerCase()}.png`;
}

function dailyStats(curr, prev) {
  if (!prev) return null;
  const dW = curr.wins - prev.wins;
  const dL = curr.losses - prev.losses;
  // Reset de temporada o queueType cambiado: counters bajan, descartamos
  if (dW < 0 || dL < 0) return null;
  const total = dW + dL;
  return {
    wins: dW,
    losses: dL,
    total,
    wr: total ? Math.round((dW / total) * 100) : null,
  };
}

function playerFieldValue(p, lpDelta, daily) {
  const lines = [`**${fmtRank(p)}**`];

  const todayParts = [`${fmtDelta(lpDelta)} hoy`];
  if (daily && daily.total > 0) {
    todayParts.push(
      `${daily.wins}W ⁄ ${daily.losses}L (${daily.wr}% WR hoy)`,
    );
  } else if (daily && daily.total === 0) {
    todayParts.push("sin partidas hoy");
  }
  lines.push(todayParts.join(" · "));

  const total = p.wins + p.losses;
  const totalWR = total ? Math.round((p.wins / total) * 100) : 0;
  lines.push(`Total: ${p.wins}W ⁄ ${p.losses}L · ${totalWR}% WR`);

  return lines.join("\n");
}

function buildSummaryEmbed(p1, p2, previous) {
  const p1Prev = previous.byRiotId[p1.riotId];
  const p2Prev = previous.byRiotId[p2.riotId];
  const p1LpDelta = p1Prev ? p1.totalLp - p1Prev.totalLp : null;
  const p2LpDelta = p2Prev ? p2.totalLp - p2Prev.totalLp : null;
  const p1Daily = dailyStats(p1, p1Prev);
  const p2Daily = dailyStats(p2, p2Prev);

  const diff = Math.abs(p1.totalLp - p2.totalLp);
  let leader, trailer, leaderDelta, trailerDelta, leaderDaily, trailerDaily;
  if (p1.totalLp >= p2.totalLp) {
    leader = p1;
    trailer = p2;
    leaderDelta = p1LpDelta;
    trailerDelta = p2LpDelta;
    leaderDaily = p1Daily;
    trailerDaily = p2Daily;
  } else {
    leader = p2;
    trailer = p1;
    leaderDelta = p2LpDelta;
    trailerDelta = p1LpDelta;
    leaderDaily = p2Daily;
    trailerDaily = p1Daily;
  }

  const header =
    diff === 0
      ? "🤝 Empate técnico — siguen igualados"
      : `**${leader.name}** va por delante`;
  const gapLine = diff === 0 ? "**0 LP**" : `**+${diff} LP**`;
  const leaderEmoji = diff === 0 ? "🤝" : "🥇";
  const trailerEmoji = diff === 0 ? "🤝" : "🥈";

  return {
    title: "🥊 SoloQ Challenge — SevillanaEnjoyer vs CAL Destroyersit",
    description: `${header}\n\n**GAP:** ${gapLine}`,
    color: 0xf0b232,
    fields: [
      {
        name: `${leaderEmoji} ${leader.name}`,
        value: playerFieldValue(leader, leaderDelta, leaderDaily),
        inline: false,
      },
      {
        name: `${trailerEmoji} ${trailer.name}`,
        value: playerFieldValue(trailer, trailerDelta, trailerDaily),
        inline: false,
      },
    ],
    footer: { text: "EUW SoloQ · Snapshot 07:00 UTC" },
    timestamp: new Date().toISOString(),
  };
}

function buildPromoEmbed(player, prevTier) {
  return {
    title: `🎉 ¡Promoción! ${player.name}`,
    description: `**${prevTier}** → **${player.tier}** 🔥`,
    color: TIER_COLORS[player.tier] || 0xf0b232,
    thumbnail: { url: emblemUrl(player.tier) },
  };
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
    // 1. Snapshot anterior (lee ANTES de guardar; así es el de ayer/última run)
    const previous = await fetchLatestSnapshot(CHALLENGE_ID);

    // 2. Datos actuales de Riot
    const players = await Promise.all(
      CHALLENGE_PLAYERS.map((riotId) =>
        fetchRankForRiotId(riotId, CHALLENGE_REGION, apiKey),
      ),
    );

    // 3. Persistimos el snapshot de hoy
    const recordedAt = await saveSnapshot(players, CHALLENGE_ID);

    // 4. Embeds
    const [p1, p2] = players;
    const embeds = [buildSummaryEmbed(p1, p2, previous)];

    const promotions = [];
    for (const p of players) {
      const prev = previous.byRiotId[p.riotId];
      if (prev && isPromotion(prev.tier, p.tier)) {
        promotions.push({ player: p.name, prevTier: prev.tier, newTier: p.tier });
        embeds.push(buildPromoEmbed(p, prev.tier));
      }
    }

    // 5. Discord
    let discordResult = { skipped: true };
    if (isDiscordConfigured()) {
      discordResult = await postWebhook({ embeds: embeds.slice(0, 10) });
    }

    res.json({
      ok: true,
      challengeId: CHALLENGE_ID,
      recordedAt: recordedAt.toISOString(),
      players,
      promotionCount: promotions.length,
      promotions,
      discord: discordResult,
    });
  } catch (e) {
    console.error("CHALLENGE SNAPSHOT ERROR:", e.message);
    res.status(500).json({ error: e.message });
  }
};
