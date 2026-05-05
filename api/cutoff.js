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

module.exports = async (req, res) => {
  const apiKey = process.env.RIOT_API_KEY;
  if (!apiKey) return res.status(500).json({ error: "RIOT_API_KEY no configurada" });

  const { region = "euw" } = req.query;
  const r = ROUTING[region];
  if (!r) return res.status(400).json({ error: "Región inválida" });

  try {
    const [chalRes, gmRes] = await Promise.all([
      fetch(
        `https://${r.platform}.api.riotgames.com/lol/league/v4/challengerleagues/by-queue/RANKED_SOLO_5x5`,
        { headers: { "X-Riot-Token": apiKey } }
      ),
      fetch(
        `https://${r.platform}.api.riotgames.com/lol/league/v4/grandmasterleagues/by-queue/RANKED_SOLO_5x5`,
        { headers: { "X-Riot-Token": apiKey } }
      ),
    ]);

    const chal = await chalRes.json();
    const gm = await gmRes.json();

    const chalMin = chal.entries?.length
      ? Math.min(...chal.entries.map((e) => e.leaguePoints))
      : null;
    const gmMin = gm.entries?.length
      ? Math.min(...gm.entries.map((e) => e.leaguePoints))
      : null;

    res.setHeader("Cache-Control", "s-maxage=300");
    res.json({ challengerMin: chalMin, grandmasterMin: gmMin });
  } catch (e) {
    console.error("CUTOFF ERROR:", e.message);
    res.status(500).json({ error: e.message });
  }
};
