async function postWebhook(payload, opts = {}) {
  const url = process.env.DISCORD_WEBHOOK_URL;
  if (!url) return { skipped: true, reason: "DISCORD_WEBHOOK_URL no configurada" };

  // Con wait=true Discord nos devuelve el objeto del mensaje (incluye id),
  // que necesitamos luego para crear un hilo encima.
  const fullUrl = opts.wait ? `${url}?wait=true` : url;
  const res = await fetch(fullUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Discord webhook: ${res.status} ${body}`);
  }
  if (opts.wait) {
    const message = await res.json();
    return { ok: true, message };
  }
  return { ok: true };
}

function isDiscordConfigured() {
  return Boolean(process.env.DISCORD_WEBHOOK_URL);
}

function isBotConfigured() {
  return Boolean(process.env.DISCORD_BOT_TOKEN);
}

async function createThread(channelId, messageId, name) {
  const token = process.env.DISCORD_BOT_TOKEN;
  if (!token) return { skipped: true, reason: "DISCORD_BOT_TOKEN no configurada" };

  const res = await fetch(
    `https://discord.com/api/v10/channels/${channelId}/messages/${messageId}/threads`,
    {
      method: "POST",
      headers: {
        Authorization: `Bot ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: name.slice(0, 100),
        auto_archive_duration: 1440, // 24h
      }),
    },
  );
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Discord createThread: ${res.status} ${body}`);
  }
  return { ok: true, thread: await res.json() };
}

async function renameChannel(channelId, name) {
  const token = process.env.DISCORD_BOT_TOKEN;
  if (!token) return { skipped: true, reason: "DISCORD_BOT_TOKEN no configurada" };

  const res = await fetch(`https://discord.com/api/v10/channels/${channelId}`, {
    method: "PATCH",
    headers: {
      Authorization: `Bot ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ name: name.slice(0, 100) }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Discord renameChannel: ${res.status} ${body}`);
  }
  return { ok: true };
}

module.exports = {
  postWebhook,
  isDiscordConfigured,
  isBotConfigured,
  createThread,
  renameChannel,
};
