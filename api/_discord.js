async function postWebhook(payload) {
  const url = process.env.DISCORD_WEBHOOK_URL;
  if (!url) return { skipped: true, reason: "DISCORD_WEBHOOK_URL no configurada" };

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Discord webhook: ${res.status} ${body}`);
  }
  return { ok: true };
}

function isDiscordConfigured() {
  return Boolean(process.env.DISCORD_WEBHOOK_URL);
}

module.exports = { postWebhook, isDiscordConfigured };
