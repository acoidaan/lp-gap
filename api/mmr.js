// WhatIsMyMMR only supports these regions
const SUPPORTED = { euw: "euw", eune: "eune", na: "na", kr: "kr" };

const HEADERS = { "User-Agent": "web:lp-gap:v1.0.0" };

async function tryFetch(url) {
  const resp = await fetch(url, { headers: HEADERS });
  if (!resp.ok) return null;
  const data = await resp.json();
  // Check if we got an error code back
  if (data.error) return null;
  return data;
}

module.exports = async (req, res) => {
  const { name, tag, region } = req.query;
  if (!name || !region) return res.json({ ranked: null });

  const r = SUPPORTED[region];
  if (!r) {
    // Region not supported by WhatIsMyMMR
    return res.json({ ranked: null, unsupported: true });
  }

  try {
    // Try multiple name formats since the API may accept different ones
    const queries = [
      `${name}#${tag}`, // Riot ID: Name#Tag
      name, // Just game name (legacy summoner name)
      `${name}-${tag}`, // Name-Tag (URL format)
    ];

    let data = null;
    for (const q of queries) {
      data = await tryFetch(
        `https://${r}.whatismymmr.com/api/v1/summoner?name=${encodeURIComponent(q)}`,
      );
      if (data && data.ranked && data.ranked.avg != null) break;
      data = null;
    }

    if (!data || !data.ranked || data.ranked.avg == null) {
      return res.json({ ranked: null });
    }

    res.json({
      ranked: {
        mmr: data.ranked.avg,
        err: data.ranked.err,
        percentile: data.ranked.percentile,
        closestRank: data.ranked.closestRank,
      },
    });
  } catch (e) {
    console.error("MMR ERROR:", e.message);
    res.json({ ranked: null });
  }
};
