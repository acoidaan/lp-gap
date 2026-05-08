const {
  filterKnownTwitchChannels,
  isTwitchConfigured,
  fetchStreams,
} = require("./_twitch");

module.exports = async (req, res) => {
  if (!isTwitchConfigured()) {
    return res.json({ configured: false, streams: {} });
  }

  const channelsParam = (req.query.channels || "").trim();
  if (!channelsParam) {
    return res.json({ configured: true, streams: {} });
  }

  const channels = filterKnownTwitchChannels(channelsParam.split(","));

  if (channels.length === 0) {
    return res.json({ configured: true, streams: {} });
  }

  try {
    const streams = await fetchStreams(channels);
    res.setHeader("Cache-Control", "s-maxage=60, stale-while-revalidate=120");
    res.json({ configured: true, streams });
  } catch (e) {
    console.error("TWITCH LIVE ERROR:", e.message);
    res.status(502).json({ error: e.message, configured: true, streams: {} });
  }
};
