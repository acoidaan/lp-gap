const ROUTING = {
  euw: { platform: "euw1" },
  eune: { platform: "eun1" },
  tr: { platform: "tr1" },
  na: { platform: "na1" },
  br: { platform: "br1" },
  lan: { platform: "la1" },
  las: { platform: "la2" },
  kr: { platform: "kr" },
  jp: { platform: "jp1" },
  oce: { platform: "oc1" },
};

async function riot(url, apiKey) {
  const res = await fetch(url, { headers: { "X-Riot-Token": apiKey } });
  if (res.status === 404) return { notFound: true };
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    return { error: `${res.status} ${body}` };
  }
  return { data: await res.json() };
}

module.exports = async (req, res) => {
  const apiKey = process.env.RIOT_API_KEY;
  if (!apiKey)
    return res.status(500).json({ error: "RIOT_API_KEY no configurada" });

  const { puuid, region } = req.query;
  if (!puuid || !region)
    return res.status(400).json({ error: "Faltan parámetros" });

  const r = ROUTING[region];
  if (!r) return res.status(400).json({ error: "Región inválida" });

  const result = await riot(
    `https://${r.platform}.api.riotgames.com/lol/spectator/v5/active-games/by-summoner/${puuid}`,
    apiKey,
  );

  // Cache corto: 30s en edge + 60s stale-while-revalidate. Suficiente para
  // que múltiples usuarios mirando la página no multipliquen las llamadas
  // y el indicador se sienta "live" sin saturar Riot.
  res.setHeader("Cache-Control", "s-maxage=30, stale-while-revalidate=60");

  if (result.notFound) {
    return res.json({ inGame: false });
  }
  if (result.error) {
    return res.status(502).json({ error: result.error, inGame: false });
  }

  const game = result.data;
  const me = (game.participants || []).find((p) => p.puuid === puuid);

  res.json({
    inGame: true,
    championId: me ? me.championId : null,
    gameMode: game.gameMode || null,
    gameQueueConfigId: game.gameQueueConfigId || null,
    gameStartTime: game.gameStartTime || null,
    gameLength: game.gameLength || 0,
  });
};
