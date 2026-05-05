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

    if (!chalRes.ok) {
      const body = await chalRes.text().catch(() => "");
      console.error("CUTOFF Challenger API error:", chalRes.status, body);
    }
    if (!gmRes.ok) {
      const body = await gmRes.text().catch(() => "");
      console.error("CUTOFF Grandmaster API error:", gmRes.status, body);
    }

    const chal = chalRes.ok ? await chalRes.json() : null;
    const gm = gmRes.ok ? await gmRes.json() : null;

    const minLP = (data) =>
      data?.entries?.length
        ? data.entries.reduce(
            (m, e) => (typeof e.leaguePoints === "number" && e.leaguePoints < m ? e.leaguePoints : m),
            Infinity
          )
        : null;

    const chalRaw = minLP(chal);
    const gmRaw = minLP(gm);

    const chalMin = chalRaw === Infinity ? null : chalRaw;
    const gmMin = gmRaw === Infinity ? null : gmRaw;

    res.setHeader("Cache-Control", "s-maxage=300");
    res.json({ challengerMin: chalMin, grandmasterMin: gmMin });
  } catch (e) {
    console.error("CUTOFF ERROR:", e.message);
    res.status(500).json({ error: e.message });
  }
};
