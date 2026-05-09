function webhookBaseUrl() {
  const url = process.env.DISCORD_WEBHOOK_URL;
  if (!url) return "";
  return url.split("?")[0].replace(/\/+$/, "");
}

function withSafeMentions(payload) {
  return {
    ...payload,
    allowed_mentions: payload.allowed_mentions || { parse: [] },
  };
}

function webhookIdFromUrl() {
  const match = webhookBaseUrl().match(/\/webhooks\/([^/]+)\//);
  return match ? match[1] : "";
}

async function postWebhook(payload, opts = {}) {
  const url = webhookBaseUrl();
  if (!url) return { skipped: true, reason: "DISCORD_WEBHOOK_URL no configurada" };
  const body = withSafeMentions(payload);

  // Con wait=true Discord nos devuelve el objeto del mensaje (incluye id),
  // que necesitamos luego para crear un hilo encima.
  const fullUrl = opts.wait ? `${url}?wait=true` : url;
  const res = await fetch(fullUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
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

async function editWebhookMessage(messageId, payload) {
  const url = webhookBaseUrl();
  if (!url) return { skipped: true, reason: "DISCORD_WEBHOOK_URL no configurada" };

  const res = await fetch(`${url}/messages/${encodeURIComponent(messageId)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(withSafeMentions(payload)),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    const err = new Error(`Discord editWebhookMessage: ${res.status} ${body}`);
    err.status = res.status;
    throw err;
  }
  return { ok: true, message: await res.json() };
}

function isDiscordConfigured() {
  return Boolean(process.env.DISCORD_WEBHOOK_URL);
}

function isBotConfigured() {
  return Boolean(process.env.DISCORD_BOT_TOKEN);
}

async function getWebhookInfo() {
  const url = webhookBaseUrl();
  if (!url) return { skipped: true, reason: "DISCORD_WEBHOOK_URL no configurada" };

  const res = await fetch(url);
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Discord getWebhookInfo: ${res.status} ${body}`);
  }
  return { ok: true, webhook: await res.json() };
}

async function findLatestWebhookMessage(channelId) {
  const token = process.env.DISCORD_BOT_TOKEN;
  if (!token) return { skipped: true, reason: "DISCORD_BOT_TOKEN no configurada" };

  const webhookId = webhookIdFromUrl();
  if (!webhookId) return { skipped: true, reason: "Webhook id no encontrado" };

  const res = await fetch(
    `https://discord.com/api/v10/channels/${channelId}/messages?limit=50`,
    {
      headers: {
        Authorization: `Bot ${token}`,
      },
    },
  );
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Discord findLatestWebhookMessage: ${res.status} ${body}`);
  }

  const messages = await res.json();
  const message = messages.find((m) => {
    const title = ((m.embeds || [])[0] || {}).title || "";
    return m.webhook_id === webhookId && title.includes("SoloQ Challenge");
  });

  return message ? { ok: true, message } : { skipped: true };
}

async function createChannelThread(channelId, name) {
  const token = process.env.DISCORD_BOT_TOKEN;
  if (!token) return { skipped: true, reason: "DISCORD_BOT_TOKEN no configurada" };

  const res = await fetch(`https://discord.com/api/v10/channels/${channelId}/threads`, {
    method: "POST",
    headers: {
      Authorization: `Bot ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name: name.slice(0, 100),
      auto_archive_duration: 1440, // 24h
      type: 11, // Public thread
    }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Discord createChannelThread: ${res.status} ${body}`);
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
  editWebhookMessage,
  isDiscordConfigured,
  isBotConfigured,
  getWebhookInfo,
  findLatestWebhookMessage,
  createChannelThread,
  renameChannel,
};
