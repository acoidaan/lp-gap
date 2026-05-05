const PLATFORM_MAP = {
  euw: "EUW1",
  eune: "EUN1",
  tr: "TR1",
  na: "NA1",
  br: "BR1",
  lan: "LA1",
  las: "LA2",
  kr: "KR",
  jp: "JP1",
  oce: "OC1",
};

module.exports = async (req, res) => {
  const { region = "euw" } = req.query;
  const platform = PLATFORM_MAP[region];
  if (!platform) return res.status(400).json({ error: "Región inválida" });

  try {
    const r = await fetch("https://www.replays.lol/cutoff/EUW/challenger", {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml",
      },
    });
    if (!r.ok) {
      console.error("CUTOFF replays.lol error:", r.status);
      return res.status(502).json({ error: `replays.lol ${r.status}` });
    }

    const html = await r.text();
    const m = html.match(
      /<script id="__NEXT_DATA__"[^>]*>([\s\S]+?)<\/script>/
    );
    if (!m) {
      console.error("CUTOFF: __NEXT_DATA__ block not found");
      return res.status(502).json({ error: "Datos no encontrados" });
    }

    const data = JSON.parse(m[1]);
    const cutoffs = data?.props?.pageProps?.cutoffData || [];
    const entry = cutoffs.find((c) => c.region === platform);
    if (!entry) return res.status(404).json({ error: "Región no encontrada" });

    res.setHeader(
      "Cache-Control",
      "s-maxage=120, stale-while-revalidate=600"
    );
    res.json({
      challengerMin: entry.challenger ?? null,
      grandmasterMin: entry.grandmaster ?? null,
      updatedAt: entry.timeFetched ?? null,
      source: "replays.lol",
    });
  } catch (e) {
    console.error("CUTOFF scraper error:", e.message);
    res.status(500).json({ error: e.message });
  }
};
