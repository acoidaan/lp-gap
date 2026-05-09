const ROUTING = {
  euw: { region: "europe" },
  eune: { region: "europe" },
  tr: { region: "europe" },
  na: { region: "americas" },
  br: { region: "americas" },
  lan: { region: "americas" },
  las: { region: "americas" },
  kr: { region: "asia" },
  jp: { region: "asia" },
  oce: { region: "sea" },
};

async function riot(url, apiKey, step) {
  const res = await fetch(url, {
    headers: { "X-Riot-Token": apiKey },
  });
  if (res.status === 404) return null;
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`${step}: ${res.status} - ${body}`);
  }
  return res.json();
}

function participantSummary(match, puuid) {
  const info = match && match.info;
  if (!info) return null;
  const player = (info.participants || []).find((p) => p.puuid === puuid);
  if (!player) return null;

  const deaths = Number(player.deaths || 0);
  const kp = Number(player.kills || 0) + Number(player.assists || 0);
  const kda = deaths === 0 ? "Perfect" : (kp / deaths).toFixed(2);

  return {
    matchId: match.metadata && match.metadata.matchId,
    championId: player.championId,
    championName: player.championName,
    win: Boolean(player.win),
    kills: Number(player.kills || 0),
    deaths,
    assists: Number(player.assists || 0),
    kda,
    gameDuration: Number(info.gameDuration || 0),
    gameStartTimestamp: Number(info.gameStartTimestamp || 0),
    gameEndTimestamp: Number(info.gameEndTimestamp || 0),
    queueId: Number(info.queueId || 0),
  };
}

module.exports = async (req, res) => {
  const apiKey = process.env.RIOT_API_KEY;
  if (!apiKey)
    return res.status(500).json({ error: "RIOT_API_KEY no configurada" });

  const { puuid, region } = req.query;
  if (!puuid || !region)
    return res.status(400).json({ error: "Faltan parametros" });

  const route = ROUTING[String(region).toLowerCase()];
  if (!route) return res.status(400).json({ error: "Region invalida" });

  const startedAfter = Number(req.query.startedAfter || 0);
  const queue = String(req.query.queue || "420").trim().toLowerCase();
  const countRaw = Number.parseInt(req.query.count || "5", 10);
  const count = Number.isFinite(countRaw)
    ? Math.min(20, Math.max(1, countRaw))
    : 5;
  const minStart = Number.isFinite(startedAfter) && startedAfter > 0
    ? startedAfter - 15 * 60 * 1000
    : 0;

  try {
    const base = `https://${route.region}.api.riotgames.com/lol/match/v5`;
    const queuePart =
      queue && queue !== "all" ? `queue=${encodeURIComponent(queue)}&` : "";
    const ids = await riot(
      `${base}/matches/by-puuid/${encodeURIComponent(puuid)}/ids?${queuePart}start=0&count=${count}`,
      apiKey,
      "Match ids",
    );

    for (const matchId of ids || []) {
      const match = await riot(
        `${base}/matches/${encodeURIComponent(matchId)}`,
        apiKey,
        "Match detail",
      );
      const summary = participantSummary(match, puuid);
      if (!summary) continue;
      if (minStart && summary.gameStartTimestamp < minStart) continue;

      res.setHeader("Cache-Control", "s-maxage=45, stale-while-revalidate=180");
      return res.json(summary);
    }

    res.setHeader("Cache-Control", "s-maxage=20, stale-while-revalidate=60");
    return res.status(404).json({ error: "Partida reciente no encontrada" });
  } catch (e) {
    console.error("LATEST MATCH ERROR:", e.message);
    res.status(500).json({ error: e.message });
  }
};
