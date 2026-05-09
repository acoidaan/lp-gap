const {
  CHALLENGE_ID,
  CHALLENGE_PLAYERS,
  CHALLENGE_REGION,
  fetchLatestSnapshot,
  fetchRankForRiotId,
  isAuthorized,
  isDatabaseConfigured,
  saveSnapshot,
  sqlClient,
} = require("./_challenge");
const {
  editWebhookMessage,
  findLatestWebhookMessage,
  getWebhookInfo,
  postWebhook,
  isDiscordConfigured,
  isBotConfigured,
  createChannelThread,
  renameChannel,
} = require("./_discord");

// Misma constante que el frontend en public/app.js. Hora de Canarias.
const CHALLENGE_START_MS = new Date("2026-08-01T00:00:00+01:00").getTime();
const CHALLENGE_END_MS = new Date("2026-09-01T00:00:00+01:00").getTime();
const CHALLENGE_TOTAL_DAYS = 31;

function publicBaseUrl() {
  const raw =
    process.env.PUBLIC_BASE_URL ||
    process.env.APP_URL ||
    process.env.VERCEL_PROJECT_PRODUCTION_URL ||
    process.env.VERCEL_URL ||
    "https://lp-gap.vercel.app";
  const withProtocol = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  return withProtocol.replace(/\/+$/, "");
}

function challengeUrl() {
  return `${publicBaseUrl()}/?view=challenge`;
}

function challengePhase() {
  const now = Date.now();
  if (now < CHALLENGE_START_MS) {
    const days = Math.max(1, Math.ceil((CHALLENGE_START_MS - now) / 86400000));
    return { state: "upcoming", daysUntil: days };
  }
  if (now < CHALLENGE_END_MS) {
    const day = Math.floor((now - CHALLENGE_START_MS) / 86400000) + 1;
    return { state: "active", day };
  }
  return { state: "ended" };
}

function shortName(name) {
  if (!name) return "?";
  if (/^Sevillana/i.test(name)) return "SevillanaEnjoyer";
  if (/^CAL/i.test(name)) return "Destro";
  return name.slice(0, 8).trim();
}

function buildChannelName(p1, p2) {
  const phase = challengePhase();
  if (phase.state === "upcoming") {
    return `🥊 Reto en ${phase.daysUntil}d`;
  }
  if (phase.state === "ended") {
    if (!p1 || !p2) return "🏆 Reto finalizado";
    const winner = p1.totalLp >= p2.totalLp ? p1 : p2;
    return `🏆 Ganador: ${shortName(winner.name)}`;
  }
  if (!p1 || !p2) return `🥊 Día ${phase.day}/${CHALLENGE_TOTAL_DAYS}`;
  const diff = Math.abs(p1.totalLp - p2.totalLp);
  if (diff === 0) return `🥊 Empate · D${phase.day}/${CHALLENGE_TOTAL_DAYS}`;
  const leader = p1.totalLp >= p2.totalLp ? p1 : p2;
  return `🥊 ${shortName(leader.name)} +${diff} · D${phase.day}/${CHALLENGE_TOTAL_DAYS}`;
}

function threadDateLabel(date = new Date()) {
  return new Intl.DateTimeFormat("es-ES", {
    timeZone: "Atlantic/Canary",
    day: "2-digit",
    month: "2-digit",
  }).format(date);
}

function compactThreadDateLabel(date = new Date()) {
  return new Intl.DateTimeFormat("es-ES", {
    timeZone: "Atlantic/Canary",
    day: "numeric",
    month: "numeric",
  }).format(date);
}

function isThreadFromDate(thread, date = new Date()) {
  const name = thread && thread.name ? thread.name : "";
  return (
    name.includes(threadDateLabel(date)) ||
    name.includes(compactThreadDateLabel(date))
  );
}

function threadDateKey(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Atlantic/Canary",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const byType = Object.fromEntries(parts.map((p) => [p.type, p.value]));
  return `${byType.year}-${byType.month}-${byType.day}`;
}

function buildThreadName() {
  const phase = challengePhase();
  const date = threadDateLabel();
  if (phase.state === "active") {
    return `📝 ${date} · Día ${phase.day}/${CHALLENGE_TOTAL_DAYS} · Discusión`;
  }
  if (phase.state === "upcoming") return `📝 ${date} · Pre-reto · Discusión`;
  return `📝 ${date} · Reto finalizado · Discusión`;
}

async function ensureDiscordStateSchema(sql) {
  await sql`
    CREATE TABLE IF NOT EXISTS challenge_discord_state (
      challenge_id TEXT PRIMARY KEY,
      summary_message_id TEXT,
      summary_channel_id TEXT,
      thread_date TEXT,
      thread_id TEXT,
      thread_name TEXT,
      poll_date TEXT,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
}

function mapDiscordState(row) {
  if (!row) {
    return {
      summaryMessageId: null,
      summaryChannelId: null,
      threadDate: null,
      threadId: null,
      threadName: null,
      pollDate: null,
    };
  }
  return {
    summaryMessageId: row.summary_message_id || null,
    summaryChannelId: row.summary_channel_id || null,
    threadDate: row.thread_date || null,
    threadId: row.thread_id || null,
    threadName: row.thread_name || null,
    pollDate: row.poll_date || null,
  };
}

async function readDiscordState(sql, challengeId) {
  await ensureDiscordStateSchema(sql);
  const rows = await sql`
    SELECT
      summary_message_id,
      summary_channel_id,
      thread_date,
      thread_id,
      thread_name,
      poll_date
    FROM challenge_discord_state
    WHERE challenge_id = ${challengeId}
  `;
  return mapDiscordState(rows[0]);
}

async function saveDiscordChannel(sql, challengeId, channelId) {
  await ensureDiscordStateSchema(sql);
  await sql`
    INSERT INTO challenge_discord_state (
      challenge_id,
      summary_channel_id,
      updated_at
    )
    VALUES (${challengeId}, ${channelId}, NOW())
    ON CONFLICT (challenge_id) DO UPDATE SET
      summary_channel_id = EXCLUDED.summary_channel_id,
      updated_at = NOW()
  `;
}

async function saveSummaryMessage(sql, challengeId, message) {
  if (!message || !message.id) return;
  await ensureDiscordStateSchema(sql);
  await sql`
    INSERT INTO challenge_discord_state (
      challenge_id,
      summary_message_id,
      summary_channel_id,
      updated_at
    )
    VALUES (${challengeId}, ${message.id}, ${message.channel_id}, NOW())
    ON CONFLICT (challenge_id) DO UPDATE SET
      summary_message_id = EXCLUDED.summary_message_id,
      summary_channel_id = EXCLUDED.summary_channel_id,
      updated_at = NOW()
  `;
}

async function saveDailyThread(sql, challengeId, dateKey, thread) {
  if (!thread || !thread.id) return;
  await ensureDiscordStateSchema(sql);
  await sql`
    INSERT INTO challenge_discord_state (
      challenge_id,
      thread_date,
      thread_id,
      thread_name,
      updated_at
    )
    VALUES (${challengeId}, ${dateKey}, ${thread.id}, ${thread.name || ""}, NOW())
    ON CONFLICT (challenge_id) DO UPDATE SET
      thread_date = EXCLUDED.thread_date,
      thread_id = EXCLUDED.thread_id,
      thread_name = EXCLUDED.thread_name,
      updated_at = NOW()
  `;
}

async function savePollDate(sql, challengeId, dateKey) {
  await ensureDiscordStateSchema(sql);
  await sql`
    INSERT INTO challenge_discord_state (
      challenge_id,
      poll_date,
      updated_at
    )
    VALUES (${challengeId}, ${dateKey}, NOW())
    ON CONFLICT (challenge_id) DO UPDATE SET
      poll_date = EXCLUDED.poll_date,
      updated_at = NOW()
  `;
}

function buildDailyPoll() {
  return {
    poll: {
      question: { text: "¿Quién subirá más LP hoy?" },
      answers: [
        { poll_media: { text: "SevillanaEnjoyer", emoji: { name: "🥇" } } },
        { poll_media: { text: "CAL Destroyersit", emoji: { name: "🥈" } } },
      ],
      duration: 24,
      allow_multiselect: false,
    },
  };
}

const TIER_ORDER = [
  "Iron",
  "Bronze",
  "Silver",
  "Gold",
  "Platinum",
  "Emerald",
  "Diamond",
  "Master",
  "Grandmaster",
  "Challenger",
];
const TIER_COLORS = {
  Iron: 0x8b8589,
  Bronze: 0xcd7f32,
  Silver: 0x9ca3af,
  Gold: 0xf0b232,
  Platinum: 0x47c9af,
  Emerald: 0x50c878,
  Diamond: 0xb9f2ff,
  Master: 0x9b59b6,
  Grandmaster: 0xe74c3c,
  Challenger: 0xf1c40f,
};

function tierIndex(tier) {
  if (!tier || tier === "Unranked") return -1;
  return TIER_ORDER.indexOf(tier);
}

function isPromotion(prevTier, newTier) {
  if (newTier === "Unranked") return false;
  if (prevTier === "Unranked") return true;
  return tierIndex(newTier) > tierIndex(prevTier);
}

function fmtRank(p) {
  if (!p || p.tier === "Unranked") return "Unranked";
  if (tierIndex(p.tier) >= 7) return `${p.tier} · ${p.lp} LP`;
  return `${p.tier} ${p.division} · ${p.lp} LP`;
}

function fmtDelta(delta) {
  if (delta === null || delta === undefined) return "—";
  if (delta > 0) return `🟢 +${delta}`;
  if (delta < 0) return `🔴 −${Math.abs(delta)}`;
  return "⚪ 0";
}

function emblemUrl(tier) {
  return `https://opgg-static.akamaized.net/images/medals_new/${tier.toLowerCase()}.png`;
}

function dailyStats(curr, prev) {
  if (!prev) return null;
  const dW = curr.wins - prev.wins;
  const dL = curr.losses - prev.losses;
  // Reset de temporada o queueType cambiado: counters bajan, descartamos
  if (dW < 0 || dL < 0) return null;
  const total = dW + dL;
  return {
    wins: dW,
    losses: dL,
    total,
    wr: total ? Math.round((dW / total) * 100) : null,
  };
}

function playerFieldValue(p, lpDelta, daily) {
  const lines = [`**${fmtRank(p)}**`];

  const todayParts = [`${fmtDelta(lpDelta)} hoy`];
  if (daily && daily.total > 0) {
    todayParts.push(
      `${daily.wins}W ⁄ ${daily.losses}L (${daily.wr}% WR hoy)`,
    );
  } else if (daily && daily.total === 0) {
    todayParts.push("sin partidas hoy");
  }
  lines.push(todayParts.join(" · "));

  const total = p.wins + p.losses;
  const totalWR = total ? Math.round((p.wins / total) * 100) : 0;
  lines.push(`Total: ${p.wins}W ⁄ ${p.losses}L · ${totalWR}% WR`);

  return lines.join("\n");
}

function buildSummaryEmbed(p1, p2, previous, threadId = null) {
  const p1Prev = previous.byRiotId[p1.riotId];
  const p2Prev = previous.byRiotId[p2.riotId];
  const p1LpDelta = p1Prev ? p1.totalLp - p1Prev.totalLp : null;
  const p2LpDelta = p2Prev ? p2.totalLp - p2Prev.totalLp : null;
  const p1Daily = dailyStats(p1, p1Prev);
  const p2Daily = dailyStats(p2, p2Prev);

  const diff = Math.abs(p1.totalLp - p2.totalLp);
  let leader, trailer, leaderDelta, trailerDelta, leaderDaily, trailerDaily;
  if (p1.totalLp >= p2.totalLp) {
    leader = p1;
    trailer = p2;
    leaderDelta = p1LpDelta;
    trailerDelta = p2LpDelta;
    leaderDaily = p1Daily;
    trailerDaily = p2Daily;
  } else {
    leader = p2;
    trailer = p1;
    leaderDelta = p2LpDelta;
    trailerDelta = p1LpDelta;
    leaderDaily = p2Daily;
    trailerDaily = p1Daily;
  }

  const header =
    diff === 0
      ? "🤝 Empate técnico — siguen igualados"
      : `**${leader.name}** va por delante`;
  const gapLine = diff === 0 ? "**0 LP**" : `**+${diff} LP**`;
  const lpGapUrl = challengeUrl();
  const lpGapLine = `\n\n[Ver LP GAP](${lpGapUrl})`;
  const leaderEmoji = diff === 0 ? "🤝" : "🥇";
  const trailerEmoji = diff === 0 ? "🤝" : "🥈";
  const discussionLine = threadId
    ? `\n\n**Discusión de hoy:** <#${threadId}>`
    : "";

  return {
    title: "🥊 SoloQ Challenge — SevillanaEnjoyer vs CAL Destroyersit",
    url: lpGapUrl,
    description: `${header}\n\n**GAP:** ${gapLine}${lpGapLine}${discussionLine}`,
    color: 0xf0b232,
    fields: [
      {
        name: `${leaderEmoji} ${leader.name}`,
        value: playerFieldValue(leader, leaderDelta, leaderDaily),
        inline: false,
      },
      {
        name: `${trailerEmoji} ${trailer.name}`,
        value: playerFieldValue(trailer, trailerDelta, trailerDaily),
        inline: false,
      },
    ],
    footer: { text: "EUW SoloQ · Snapshot 07:00 UTC" },
    timestamp: new Date().toISOString(),
  };
}

function buildPromoEmbed(player, prevTier) {
  return {
    title: `🎉 ¡Promoción! ${player.name}`,
    description: `**${prevTier}** → **${player.tier}** 🔥`,
    color: TIER_COLORS[player.tier] || 0xf0b232,
    thumbnail: { url: emblemUrl(player.tier) },
  };
}

async function adoptDiscordSummary(sql, challengeId, state, dateKey) {
  if (state.summaryMessageId && state.summaryChannelId) return state;

  try {
    const info = await getWebhookInfo();
    const channelId = info.webhook && info.webhook.channel_id;
    if (!channelId) return state;

    await saveDiscordChannel(sql, challengeId, channelId);
    let nextState = { ...state, summaryChannelId: channelId };

    if (isBotConfigured()) {
      try {
        const found = await findLatestWebhookMessage(channelId);
        if (found.ok && found.message) {
          await saveSummaryMessage(sql, challengeId, found.message);
          nextState = {
            ...nextState,
            summaryMessageId: found.message.id,
            summaryChannelId: found.message.channel_id || channelId,
          };

          if (found.message.thread && isThreadFromDate(found.message.thread)) {
            await saveDailyThread(sql, challengeId, dateKey, found.message.thread);
            nextState = {
              ...nextState,
              threadDate: dateKey,
              threadId: found.message.thread.id,
              threadName: found.message.thread.name || null,
            };
          }
        }
      } catch (e) {
        console.warn("Discord summary adopt skip:", e.message);
      }
    }

    return nextState;
  } catch (e) {
    console.warn("Discord webhook info skip:", e.message);
    return state;
  }
}

async function ensureDailyThread(sql, challengeId, state, dateKey) {
  if (!isBotConfigured()) {
    return {
      state,
      result: { skipped: true, reason: "DISCORD_BOT_TOKEN no configurada" },
    };
  }

  if (state.threadDate === dateKey && state.threadId) {
    return {
      state,
      result: {
        ok: true,
        reused: true,
        thread: { id: state.threadId, name: state.threadName },
      },
    };
  }

  if (!state.summaryChannelId) {
    return {
      state,
      result: { skipped: true, reason: "Canal de Discord no encontrado" },
    };
  }

  const result = await createChannelThread(state.summaryChannelId, buildThreadName());
  if (result.ok && result.thread) {
    await saveDailyThread(sql, challengeId, dateKey, result.thread);
    return {
      state: {
        ...state,
        threadDate: dateKey,
        threadId: result.thread.id,
        threadName: result.thread.name || null,
      },
      result,
    };
  }

  return { state, result };
}

async function upsertSummaryMessage(sql, challengeId, state, payload) {
  if (state.summaryMessageId) {
    try {
      const edited = await editWebhookMessage(state.summaryMessageId, payload);
      if (edited.ok && edited.message) {
        await saveSummaryMessage(sql, challengeId, edited.message);
      }
      return { ...edited, action: "edited" };
    } catch (e) {
      if (e.status !== 404) throw e;
      console.warn("Discord summary missing, creating a fresh one");
    }
  }

  const created = await postWebhook(payload, { wait: true });
  if (created.ok && created.message) {
    await saveSummaryMessage(sql, challengeId, created.message);
  }
  return { ...created, action: "created" };
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
  const apiKey = process.env.RIOT_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "RIOT_API_KEY no configurada" });
  }

  try {
    // 1. Snapshot anterior (lee ANTES de guardar; así es el de ayer/última run)
    const previous = await fetchLatestSnapshot(CHALLENGE_ID);

    // 2. Datos actuales de Riot
    const players = await Promise.all(
      CHALLENGE_PLAYERS.map((riotId) =>
        fetchRankForRiotId(riotId, CHALLENGE_REGION, apiKey),
      ),
    );

    // 3. Persistimos el snapshot de hoy
    const recordedAt = await saveSnapshot(players, CHALLENGE_ID);

    // 4. Embeds
    const [p1, p2] = players;
    const promoEmbeds = [];

    const promotions = [];
    for (const p of players) {
      const prev = previous.byRiotId[p.riotId];
      if (prev && isPromotion(prev.tier, p.tier)) {
        promotions.push({ player: p.name, prevTier: prev.tier, newTier: p.tier });
        promoEmbeds.push(buildPromoEmbed(p, prev.tier));
      }
    }

    // 5. Discord — recap (con wait para tener message_id), thread, poll, rename
    let discordResult = { skipped: true };
    let threadResult = { skipped: true };
    let pollResult = { skipped: true };
    let renameResult = { skipped: true };

    if (isDiscordConfigured()) {
      const sql = sqlClient();
      const dateKey = threadDateKey();
      let discordState = await readDiscordState(sql, CHALLENGE_ID);
      discordState = await adoptDiscordSummary(
        sql,
        CHALLENGE_ID,
        discordState,
        dateKey,
      );

      try {
        const ensured = await ensureDailyThread(
          sql,
          CHALLENGE_ID,
          discordState,
          dateKey,
        );
        discordState = ensured.state;
        threadResult = ensured.result;
      } catch (e) {
        console.warn("Discord thread skip:", e.message);
        threadResult = { error: e.message };
      }

      const summaryEmbed = buildSummaryEmbed(
        p1,
        p2,
        previous,
        discordState.threadId,
      );

      discordResult = await upsertSummaryMessage(sql, CHALLENGE_ID, discordState, {
        embeds: [summaryEmbed],
      });

      // Las promociones van como aviso aparte; el marcador principal se edita.
      if (promoEmbeds.length > 0) {
        try {
          await postWebhook({ embeds: promoEmbeds.slice(0, 10) });
        } catch (e) {
          console.warn("Discord promo skip:", e.message);
        }
      }

      // Poll diario solo durante el reto activo
      const phase = challengePhase();
      if (phase.state === "active" && discordState.pollDate !== dateKey) {
        try {
          pollResult = await postWebhook(buildDailyPoll());
          if (pollResult.ok) {
            await savePollDate(sql, CHALLENGE_ID, dateKey);
          }
        } catch (e) {
          console.warn("Discord poll skip:", e.message);
          pollResult = { error: e.message };
        }
      }
    }

    // Rename voice channel (independiente del webhook, solo necesita bot)
    const voiceChannelId = process.env.DISCORD_VOICE_CHANNEL_ID;
    if (voiceChannelId && isBotConfigured()) {
      try {
        renameResult = await renameChannel(
          voiceChannelId,
          buildChannelName(p1, p2),
        );
      } catch (e) {
        console.warn("Discord rename skip:", e.message);
        renameResult = { error: e.message };
      }
    }

    res.json({
      ok: true,
      challengeId: CHALLENGE_ID,
      recordedAt: recordedAt.toISOString(),
      players,
      promotionCount: promotions.length,
      promotions,
      discord: {
        recap: discordResult,
        thread: threadResult,
        poll: pollResult,
        voiceRename: renameResult,
      },
    });
  } catch (e) {
    console.error("CHALLENGE SNAPSHOT ERROR:", e.message);
    res.status(500).json({ error: e.message });
  }
};
