const { neon } = require("@neondatabase/serverless");

const CHALLENGE_ID = "sevillana-vs-cal-2026";
const CHALLENGE_REGION = "euw";
const CHALLENGE_PLAYERS = ["SevillanaEnjoyer#CARLA", "CAL Destroyersit#EUW"];

const ROUTING = {
  euw: { platform: "euw1", region: "europe" },
};

const TIERS = [
  "IRON",
  "BRONZE",
  "SILVER",
  "GOLD",
  "PLATINUM",
  "EMERALD",
  "DIAMOND",
  "MASTER",
  "GRANDMASTER",
  "CHALLENGER",
];
const DIVS = ["IV", "III", "II", "I"];

function databaseUrl() {
  return (
    process.env.DATABASE_URL ||
    process.env.POSTGRES_URL ||
    process.env.NEON_DATABASE_URL ||
    "postgresql://neondb_owner:npg_OGh8PiA4jIsw@ep-wispy-smoke-abimyzt2-pooler.eu-west-2.aws.neon.tech/neondb?channel_binding=require&sslmode=require"
  );
}

function isDatabaseConfigured() {
  return Boolean(databaseUrl());
}

function sqlClient() {
  const url = databaseUrl();
  if (!url) throw new Error("DATABASE_URL no configurada");
  return neon(url);
}

function parseRiotId(riotId) {
  const idx = riotId.indexOf("#");
  if (idx < 0) return { name: riotId.trim(), tag: "" };
  return {
    name: riotId.slice(0, idx).trim(),
    tag: riotId.slice(idx + 1).trim(),
  };
}

function toLP(tier, div, lp) {
  const i = TIERS.indexOf((tier || "").toUpperCase());
  if (i < 0) return 0;
  if (i >= 7) return 2800 + (lp || 0);
  const d = DIVS.indexOf((div || "").toUpperCase());
  return i * 400 + Math.max(d, 0) * 100 + (lp || 0);
}

async function riot(url, apiKey, step) {
  const res = await fetch(url, {
    headers: { "X-Riot-Token": apiKey },
  });
  if (res.status === 404) return null;
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`${step}: ${res.status} - ${body}`);
  }
  return res.json();
}

async function fetchRankForRiotId(riotId, region, apiKey) {
  const route = ROUTING[region];
  if (!route) throw new Error("Region invalida");

  const { name, tag } = parseRiotId(riotId);
  const acc = await riot(
    `https://${route.region}.api.riotgames.com/riot/account/v1/accounts/by-riot-id/${encodeURIComponent(name)}/${encodeURIComponent(tag)}`,
    apiKey,
    "Account lookup",
  );
  if (!acc) throw new Error(`Jugador no encontrado: ${riotId}`);

  const sum = await riot(
    `https://${route.platform}.api.riotgames.com/lol/summoner/v4/summoners/by-puuid/${acc.puuid}`,
    apiKey,
    "Summoner lookup",
  );
  const iconId = sum ? sum.profileIconId : 29;

  const ranks = await riot(
    `https://${route.platform}.api.riotgames.com/lol/league/v4/entries/by-puuid/${acc.puuid}`,
    apiKey,
    "Ranked lookup",
  );
  const solo = (ranks || []).find((e) => e.queueType === "RANKED_SOLO_5x5");

  if (!solo) {
    return {
      riotId,
      name,
      tag,
      region,
      tier: "Unranked",
      division: "",
      lp: 0,
      wins: 0,
      losses: 0,
      iconId,
      totalLp: 0,
    };
  }

  const tier = solo.tier.charAt(0) + solo.tier.slice(1).toLowerCase();
  return {
    riotId,
    name,
    tag,
    region,
    tier,
    division: solo.rank,
    lp: solo.leaguePoints,
    wins: solo.wins,
    losses: solo.losses,
    iconId,
    totalLp: toLP(tier, solo.rank, solo.leaguePoints),
  };
}

async function ensureSchema(sql) {
  await sql`
    CREATE TABLE IF NOT EXISTS challenge_snapshots (
      id BIGSERIAL PRIMARY KEY,
      challenge_id TEXT NOT NULL,
      riot_id TEXT NOT NULL,
      game_name TEXT NOT NULL,
      tag_line TEXT NOT NULL,
      region TEXT NOT NULL,
      tier TEXT NOT NULL,
      division TEXT NOT NULL,
      lp INTEGER NOT NULL,
      wins INTEGER NOT NULL,
      losses INTEGER NOT NULL,
      icon_id INTEGER NOT NULL,
      total_lp INTEGER NOT NULL,
      recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS challenge_snapshots_lookup_idx
      ON challenge_snapshots (challenge_id, recorded_at)
  `;
}

async function saveSnapshot(players, challengeId = CHALLENGE_ID) {
  const sql = sqlClient();
  await ensureSchema(sql);
  const recordedAt = new Date();

  for (const p of players) {
    await sql`
      INSERT INTO challenge_snapshots (
        challenge_id,
        riot_id,
        game_name,
        tag_line,
        region,
        tier,
        division,
        lp,
        wins,
        losses,
        icon_id,
        total_lp,
        recorded_at
      )
      VALUES (
        ${challengeId},
        ${p.riotId},
        ${p.name},
        ${p.tag},
        ${p.region},
        ${p.tier},
        ${p.division},
        ${p.lp},
        ${p.wins},
        ${p.losses},
        ${p.iconId},
        ${p.totalLp},
        ${recordedAt}
      )
    `;
  }

  return recordedAt;
}

// Devuelve el grupo de filas con el recorded_at más reciente para ese
// challengeId. Si lo llamas ANTES de saveSnapshot ese grupo es el
// "snapshot anterior" del que partir para diffs.
async function fetchLatestSnapshot(challengeId) {
  const sql = sqlClient();
  await ensureSchema(sql);
  const rows = await sql`
    SELECT
      riot_id,
      game_name,
      tag_line,
      tier,
      division,
      lp,
      wins,
      losses,
      total_lp,
      recorded_at
    FROM challenge_snapshots
    WHERE challenge_id = ${challengeId}
    ORDER BY recorded_at DESC
    LIMIT 60
  `;

  if (rows.length === 0) return { recordedAt: null, byRiotId: {} };
  const latestTs = new Date(rows[0].recorded_at).getTime();
  const byRiotId = {};
  for (const row of rows) {
    if (new Date(row.recorded_at).getTime() !== latestTs) break;
    byRiotId[row.riot_id] = {
      riotId: row.riot_id,
      name: row.game_name,
      tag: row.tag_line,
      tier: row.tier,
      division: row.division,
      lp: Number(row.lp),
      wins: Number(row.wins),
      losses: Number(row.losses),
      totalLp: Number(row.total_lp),
    };
  }
  return { recordedAt: new Date(latestTs), byRiotId };
}

async function listSnapshots() {
  const sql = sqlClient();
  await ensureSchema(sql);
  const rows = await sql`
    SELECT
      riot_id,
      game_name,
      tag_line,
      region,
      tier,
      division,
      lp,
      wins,
      losses,
      icon_id,
      total_lp,
      recorded_at
    FROM challenge_snapshots
    WHERE challenge_id = ${CHALLENGE_ID}
    ORDER BY recorded_at ASC, riot_id ASC
  `;

  const grouped = new Map();
  for (const row of rows) {
    const ts = new Date(row.recorded_at).getTime();
    if (!grouped.has(ts)) {
      grouped.set(ts, { ts, lps: {}, ranks: {} });
    }
    const item = grouped.get(ts);
    item.lps[row.riot_id] = Number(row.total_lp);
    item.ranks[row.riot_id] = {
      riotId: row.riot_id,
      name: row.game_name,
      tag: row.tag_line,
      region: row.region,
      tier: row.tier,
      division: row.division,
      lp: Number(row.lp),
      wins: Number(row.wins),
      losses: Number(row.losses),
      iconId: Number(row.icon_id),
      totalLp: Number(row.total_lp),
    };
  }

  return Array.from(grouped.values());
}

function isAuthorized(req) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true;
  const auth = req.headers.authorization || "";
  return auth === `Bearer ${secret}` || req.query.secret === secret;
}

module.exports = {
  CHALLENGE_ID,
  CHALLENGE_PLAYERS,
  CHALLENGE_REGION,
  fetchLatestSnapshot,
  fetchRankForRiotId,
  isAuthorized,
  isDatabaseConfigured,
  listSnapshots,
  saveSnapshot,
  sqlClient,
};
