const ROUTING = {
  euw: { platform: "euw1", region: "europe" },
  eune: { platform: "eun1", region: "europe" },
  tr: { platform: "tr1", region: "europe" },
  na: { platform: "na1", region: "americas" },
  br: { platform: "br1", region: "americas" },
  lan: { platform: "la1", region: "americas" },
  las: { platform: "la2", region: "americas" },
  kr: { platform: "kr", region: "asia" },
  jp: { platform: "jp1", region: "asia" },
  oce: { platform: "oc1", region: "sea" },
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

module.exports = async (req, res) => {
  const apiKey = process.env.RIOT_API_KEY;
  if (!apiKey)
    return res.status(500).json({ error: "RIOT_API_KEY no configurada" });

  const { name, tag, region } = req.query;
  if (!name || !tag || !region)
    return res.status(400).json({ error: "Faltan parámetros" });

  const r = ROUTING[region];
  if (!r) return res.status(400).json({ error: "Región inválida" });

  try {
    // 1 — PUUID desde Riot ID
    const acc = await riot(
      `https://${r.region}.api.riotgames.com/riot/account/v1/accounts/by-riot-id/${encodeURIComponent(name)}/${encodeURIComponent(tag)}`,
      apiKey,
      "Account lookup",
    );
    if (!acc) return res.status(404).json({ error: "Jugador no encontrado" });

    // 2 — Summoner ID desde PUUID
    const sum = await riot(
      `https://${r.platform}.api.riotgames.com/lol/summoner/v4/summoners/by-puuid/${acc.puuid}`,
      apiKey,
      "Summoner lookup",
    );
    if (!sum) return res.status(404).json({ error: "Invocador no encontrado" });

    // 3 — Datos de ranked
    const ranks = await riot(
      `https://${r.platform}.api.riotgames.com/lol/league/v4/entries/by-summoner/${sum.id}`,
      apiKey,
      "Ranked lookup",
    );

    const solo = (ranks || []).find((e) => e.queueType === "RANKED_SOLO_5x5");

    if (!solo) {
      return res.json({
        tier: "Unranked",
        division: "",
        lp: 0,
        wins: 0,
        losses: 0,
      });
    }

    res.json({
      tier: solo.tier.charAt(0) + solo.tier.slice(1).toLowerCase(),
      division: solo.rank,
      lp: solo.leaguePoints,
      wins: solo.wins,
      losses: solo.losses,
    });
  } catch (e) {
    console.error("LP GAP ERROR:", e.message);
    res.status(500).json({ error: e.message });
  }
};
