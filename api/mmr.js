const REGION_MAP = {
  euw: "euw",
  eune: "eune",
  na: "na",
  kr: "kr",
  jp: "jp",
  br: "br",
  las: "las",
  lan: "lan",
  oce: "oce",
  tr: "tr",
};

module.exports = async (req, res) => {
  const { name, tag, region } = req.query;
  if (!name || !region)
    return res.status(400).json({ error: "Faltan parámetros" });

  const r = REGION_MAP[region];
  if (!r) return res.status(400).json({ error: "Región inválida" });

  // whatismymmr uses "Name#Tag" format now (Riot ID)
  const summonerQuery = tag ? `${name}#${tag}` : name;

  try {
    const resp = await fetch(
      `https://${r}.whatismymmr.com/api/v1/summoner?name=${encodeURIComponent(summonerQuery)}`,
      {
        headers: {
          "User-Agent": "web:lp-gap:v1.0.0",
        },
      },
    );

    if (!resp.ok) {
      return res.json({ ranked: null, normal: null, aram: null });
    }

    const data = await resp.json();

    res.json({
      ranked:
        data.ranked && data.ranked.avg != null
          ? {
              mmr: data.ranked.avg,
              err: data.ranked.err,
              percentile: data.ranked.percentile,
              closestRank: data.ranked.closestRank,
            }
          : null,
      normal:
        data.normal && data.normal.avg != null
          ? {
              mmr: data.normal.avg,
              err: data.normal.err,
            }
          : null,
      aram:
        data.ARAM && data.ARAM.avg != null
          ? {
              mmr: data.ARAM.avg,
              err: data.ARAM.err,
            }
          : null,
    });
  } catch (e) {
    console.error("MMR ERROR:", e.message);
    res.json({ ranked: null, normal: null, aram: null });
  }
};
