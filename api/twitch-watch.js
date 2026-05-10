const { isAuthorized, isDatabaseConfigured, sqlClient } = require("./_challenge");
const {
  isTwitchConfigured,
  fetchStreams,
} = require("./_twitch");
const {
  postWebhook,
  editWebhookMessage,
  isDiscordConfigured,
} = require("./_discord");

const STREAM_STATUS_CHANNELS = [
  { channel: "votillas", label: "botas" },
  { channel: "destr0lol", label: "destro" },
  { channel: "xstellar_", label: "stellar" },
];
const TWITCH_CHANNELS = STREAM_STATUS_CHANNELS.map((item) => item.channel);
const STATUS_MESSAGE_KEY = "stream-status";
const RED_DOT = "\u{1F534}";
const GREEN_DOT = "\u{1F7E2}";

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
  await sql`
    CREATE TABLE IF NOT EXISTS twitch_status_message (
      state_key TEXT PRIMARY KEY,
      message_id TEXT NOT NULL,
      channel_id TEXT,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
}

async function readState(sql, channels) {
  const rows = await sql`
    SELECT channel, is_live, started_at
    FROM twitch_live_state
  `;
  const wanted = new Set(channels);
  const byChannel = {};
  for (const row of rows) {
    if (!wanted.has(row.channel)) continue;
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

async function readStatusMessage(sql) {
  const rows = await sql`
    SELECT message_id, channel_id
    FROM twitch_status_message
    WHERE state_key = ${STATUS_MESSAGE_KEY}
    LIMIT 1
  `;
  const row = rows[0];
  if (!row) return null;
  return {
    messageId: row.message_id,
    channelId: row.channel_id || null,
  };
}

async function saveStatusMessage(sql, message) {
  if (!message || !message.id) return;
  await sql`
    INSERT INTO twitch_status_message (
      state_key,
      message_id,
      channel_id,
      updated_at
    )
    VALUES (
      ${STATUS_MESSAGE_KEY},
      ${message.id},
      ${message.channel_id || null},
      NOW()
    )
    ON CONFLICT (state_key) DO UPDATE SET
      message_id = EXCLUDED.message_id,
      channel_id = EXCLUDED.channel_id,
      updated_at = NOW()
  `;
}

function twitchUrl(channel) {
  return `https://www.twitch.tv/${encodeURIComponent(channel)}`;
}

function formatViewerCount(viewers) {
  const count = Number(viewers || 0);
  return `${count.toLocaleString("es-ES")} viewers`;
}

function buildStatusLine(item, stream) {
  const url = twitchUrl(item.channel);
  if (!stream) {
    return `${GREEN_DOT} **${item.label}** - sin stream - ${url}`;
  }

  const meta = [stream.gameName, formatViewerCount(stream.viewerCount)]
    .filter(Boolean)
    .join(" - ");
  return `${RED_DOT} **${item.label}** - EN STREAM - ${meta} - ${url}`;
}

function buildStatusContent(streams) {
  const updatedAt = Math.floor(Date.now() / 1000);
  return [
    "**Estado de streams**",
    ...STREAM_STATUS_CHANNELS.map((item) =>
      buildStatusLine(item, streams[item.channel]),
    ),
    "",
    `Actualizado <t:${updatedAt}:R>`,
  ].join("\n");
}

async function upsertStatusMessage(sql, streams) {
  const payload = {
    content: buildStatusContent(streams),
    embeds: [],
  };
  const state = await readStatusMessage(sql);

  if (state && state.messageId) {
    try {
      const edited = await editWebhookMessage(state.messageId, payload);
      await saveStatusMessage(sql, edited.message);
      return {
        ok: true,
        action: "edited",
        messageId: edited.message && edited.message.id,
      };
    } catch (e) {
      if (e.status !== 404) throw e;
      console.warn("Discord stream status missing, creating a fresh one");
    }
  }

  const created = await postWebhook(payload, { wait: true });
  if (created.ok && created.message) {
    await saveStatusMessage(sql, created.message);
    return {
      ok: true,
      action: "created",
      messageId: created.message.id,
    };
  }
  return created;
}

module.exports = async (req, res) => {
  if (req.method && !["GET", "POST"].includes(req.method)) {
    return res.status(405).json({ error: "Metodo no permitido" });
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

      if (isLive && !wasLive) {
        transitions.push({ channel, stream });
      }
    }

    let discordResult = { skipped: true };
    if (isDiscordConfigured()) {
      discordResult = await upsertStatusMessage(sql, currentStreams);
    }

    res.setHeader("Cache-Control", "no-store");
    res.json({
      ok: true,
      checked: TWITCH_CHANNELS.length,
      newlyLive: transitions.map((t) => t.channel),
      live: TWITCH_CHANNELS.filter((channel) => currentStreams[channel]),
      discord: discordResult,
    });
  } catch (e) {
    console.error("TWITCH WATCH ERROR:", e.message);
    res.status(500).json({ error: e.message });
  }
};
