// Cache de token a nivel de módulo: si la función está caliente, evitamos
// re-autenticar en cada request. En frío vuelve a pedir token (rápido).
const PUBLIC_TWITCH_CHANNELS = ["votillas", "xstellar_", "destr0lol", "elmiillor"];
const WATCHED_TWITCH_CHANNELS = ["votillas", "xstellar_", "destr0lol"];
const PUBLIC_TWITCH_CHANNEL_SET = new Set(PUBLIC_TWITCH_CHANNELS);

let cachedToken = null;
let cachedTokenExpiresAt = 0;

function isTwitchConfigured() {
  return Boolean(process.env.TWITCH_CLIENT_ID && process.env.TWITCH_CLIENT_SECRET);
}

function normalizeTwitchChannel(channel) {
  return String(channel || "").trim().toLowerCase();
}

function filterKnownTwitchChannels(channels) {
  const filtered = [];
  const seen = new Set();
  for (const channel of channels || []) {
    const normalized = normalizeTwitchChannel(channel);
    if (
      !normalized ||
      seen.has(normalized) ||
      !PUBLIC_TWITCH_CHANNEL_SET.has(normalized)
    ) {
      continue;
    }
    seen.add(normalized);
    filtered.push(normalized);
  }
  return filtered.slice(0, 100);
}

async function getAppAccessToken() {
  const clientId = process.env.TWITCH_CLIENT_ID;
  const clientSecret = process.env.TWITCH_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error("TWITCH_CLIENT_ID/SECRET no configurados");
  }

  if (cachedToken && Date.now() < cachedTokenExpiresAt - 60_000) {
    return { token: cachedToken, clientId };
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
  return { token: cachedToken, clientId };
}

async function fetchStreams(channels) {
  if (!channels || channels.length === 0) return {};
  const { token, clientId } = await getAppAccessToken();

  const params = new URLSearchParams();
  channels.forEach((c) => params.append("user_login", c));

  const res = await fetch(
    `https://api.twitch.tv/helix/streams?${params.toString()}`,
    {
      headers: {
        "Client-Id": clientId,
        Authorization: `Bearer ${token}`,
      },
    },
  );
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Twitch streams: ${res.status} ${body}`);
  }

  const data = await res.json();
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
  return streams;
}

module.exports = {
  PUBLIC_TWITCH_CHANNELS,
  WATCHED_TWITCH_CHANNELS,
  filterKnownTwitchChannels,
  isTwitchConfigured,
  getAppAccessToken,
  fetchStreams,
};
