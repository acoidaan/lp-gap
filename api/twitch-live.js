// Cache de token a nivel de módulo: si la función está caliente, evitamos
// re-autenticar en cada request. En frío vuelve a pedir token (rápido, ~150ms).
let cachedToken = null;
let cachedTokenExpiresAt = 0;

async function getAppAccessToken(clientId, clientSecret) {
  if (cachedToken && Date.now() < cachedTokenExpiresAt - 60_000) {
    return cachedToken;
  }
  const params = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: "client_credentials",
  });
  const res = await fetch("https://id.twitch.tv/oauth2/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Twitch auth: ${res.status} ${body}`);
  }
  const data = await res.json();
  cachedToken = data.access_token;
  cachedTokenExpiresAt = Date.now() + (data.expires_in || 3600) * 1000;
  return cachedToken;
}

module.exports = async (req, res) => {
  const clientId = process.env.TWITCH_CLIENT_ID;
  const clientSecret = process.env.TWITCH_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    return res.json({ configured: false, streams: {} });
  }

  const channelsParam = (req.query.channels || "").trim();
  if (!channelsParam) {
    return res.json({ configured: true, streams: {} });
  }

  const channels = channelsParam
    .split(",")
    .map((c) => c.trim().toLowerCase())
    .filter(Boolean)
    .slice(0, 100); // Helix admite hasta 100 user_login por request

  if (channels.length === 0) {
    return res.json({ configured: true, streams: {} });
  }

  try {
    const token = await getAppAccessToken(clientId, clientSecret);

    const params = new URLSearchParams();
    channels.forEach((c) => params.append("user_login", c));

    const helix = await fetch(
      `https://api.twitch.tv/helix/streams?${params.toString()}`,
      {
        headers: {
          "Client-Id": clientId,
          Authorization: `Bearer ${token}`,
        },
      },
    );

    if (!helix.ok) {
      const body = await helix.text().catch(() => "");
      throw new Error(`Twitch streams: ${helix.status} ${body}`);
    }

    const data = await helix.json();
    const streams = {};
    for (const stream of data.data || []) {
      streams[stream.user_login.toLowerCase()] = {
        userName: stream.user_name,
        gameName: stream.game_name,
        title: stream.title,
        viewerCount: stream.viewer_count,
        startedAt: stream.started_at,
        thumbnailUrl: stream.thumbnail_url,
      };
    }

    // Cache 60s edge + 120s stale. Twitch live status no cambia tan rápido
    // como para necesitar polling más agresivo.
    res.setHeader("Cache-Control", "s-maxage=60, stale-while-revalidate=120");
    res.json({ configured: true, streams });
  } catch (e) {
    console.error("TWITCH LIVE ERROR:", e.message);
    res.status(502).json({ error: e.message, configured: true, streams: {} });
  }
};
