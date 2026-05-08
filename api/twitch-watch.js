const { isAuthorized, isDatabaseConfigured, sqlClient } = require("./_challenge");
const { isTwitchConfigured, fetchStreams } = require("./_twitch");
const { postWebhook, isDiscordConfigured } = require("./_discord");

// Canales del grupo. Si añades streamers nuevos a TWITCH_CHANNELS en
// public/app.js, mete aquí también su handle (en minúsculas).
const TWITCH_CHANNELS = ["votillas", "xstellar_", "destr0lol"];

async function ensureSchema(sql) {
  await sql`
    CREATE TABLE IF NOT EXISTS twitch_live_state (
      channel TEXT PRIMARY KEY,
      is_live BOOLEAN NOT NULL DEFAULT FALSE,
      user_name TEXT,
      game_name TEXT,
      title TEXT,
      viewer_count INTEGER,
      started_at TIMESTAMPTZ,
      last_checked TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
}

async function readState(sql, channels) {
  const rows = await sql`
    SELECT channel, is_live, started_at
    FROM twitch_live_state
    WHERE channel = ANY(${channels})
  `;
  const byChannel = {};
  for (const row of rows) {
    byChannel[row.channel] = {
      isLive: Boolean(row.is_live),
      startedAt: row.started_at,
    };
  }
  return byChannel;
}

async function upsertState(sql, channel, stream) {
  if (stream) {
    await sql`
      INSERT INTO twitch_live_state (
        channel, is_live, user_name, game_name, title,
        viewer_count, started_at, last_checked
      )
      VALUES (
        ${channel}, TRUE, ${stream.userName}, ${stream.gameName}, ${stream.title},
        ${stream.viewerCount}, ${stream.startedAt}, NOW()
      )
      ON CONFLICT (channel) DO UPDATE SET
        is_live = TRUE,
        user_name = EXCLUDED.user_name,
        game_name = EXCLUDED.game_name,
        title = EXCLUDED.title,
        viewer_count = EXCLUDED.viewer_count,
        started_at = EXCLUDED.started_at,
        last_checked = NOW()
    `;
  } else {
    await sql`
      INSERT INTO twitch_live_state (channel, is_live, last_checked)
      VALUES (${channel}, FALSE, NOW())
      ON CONFLICT (channel) DO UPDATE SET
        is_live = FALSE,
        last_checked = NOW()
    `;
  }
}

function buildLiveEmbed(channel, stream) {
  const url = `https://www.twitch.tv/${encodeURIComponent(channel)}`;
  const thumb = stream.thumbnailUrl
    ? stream.thumbnailUrl.replace("{width}", "640").replace("{height}", "360")
    : null;
  const embed = {
    title: `🔴 ${stream.userName || channel} está EN DIRECTO`,
    url,
    description: stream.title || "_Sin título_",
    color: 0x9146ff,
    fields: [],
    timestamp: stream.startedAt || new Date().toISOString(),
    footer: { text: `Twitch · ${stream.viewerCount || 0} viewers` },
  };
  if (stream.gameName) {
    embed.fields.push({ name: "Juego", value: stream.gameName, inline: true });
  }
  if (thumb) embed.image = { url: thumb };
  return embed;
}

module.exports = async (req, res) => {
  if (req.method && !["GET", "POST"].includes(req.method)) {
    return res.status(405).json({ error: "Método no permitido" });
  }
  if (!isAuthorized(req)) {
    return res.status(401).json({ error: "No autorizado" });
  }
  if (!isDatabaseConfigured()) {
    return res.status(500).json({ error: "DATABASE_URL no configurada" });
  }
  if (!isTwitchConfigured()) {
    return res.status(500).json({ error: "TWITCH_CLIENT_ID/SECRET no configurados" });
  }

  try {
    const sql = sqlClient();
    await ensureSchema(sql);

    const [currentStreams, previousState] = await Promise.all([
      fetchStreams(TWITCH_CHANNELS),
      readState(sql, TWITCH_CHANNELS),
    ]);

    const transitions = [];
    for (const channel of TWITCH_CHANNELS) {
      const stream = currentStreams[channel] || null;
      const prev = previousState[channel];
      const wasLive = prev ? prev.isLive : false;
      const isLive = Boolean(stream);

      await upsertState(sql, channel, stream);

      // Solo nos importa offline → live (no spammeamos cuando se va).
      if (isLive && !wasLive) {
        transitions.push({ channel, stream });
      }
    }

    let discordResult = { skipped: true };
    if (transitions.length > 0 && isDiscordConfigured()) {
      const embeds = transitions
        .map(({ channel, stream }) => buildLiveEmbed(channel, stream))
        .slice(0, 10);
      discordResult = await postWebhook({ embeds });
    }

    res.setHeader("Cache-Control", "no-store");
    res.json({
      ok: true,
      checked: TWITCH_CHANNELS.length,
      newlyLive: transitions.map((t) => t.channel),
      discord: discordResult,
    });
  } catch (e) {
    console.error("TWITCH WATCH ERROR:", e.message);
    res.status(500).json({ error: e.message });
  }
};
