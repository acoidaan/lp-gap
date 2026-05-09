const {
  CHALLENGE_PLAYERS,
  CHALLENGE_REGION,
  fetchRankForRiotId,
  isDatabaseConfigured,
  listSnapshots,
} = require("./_challenge");

function sendText(res, text, status = 200, cache = true) {
  res.setHeader("Content-Type", "text/plain; charset=utf-8");
  res.setHeader(
    "Cache-Control",
    !cache || status >= 400
      ? "no-store"
      : "s-maxage=45, stale-while-revalidate=120",
  );
  res.status(status).send(limitText(text));
}

function limitText(text, max = 390) {
  const value = String(text || "");
  if (value.length <= max) return value;
  return `${value.slice(0, max - 3).trim()}...`;
}

function apiKey() {
  return process.env.RIOT_API_KEY || "";
}

function fmtRank(p) {
  if (!p || p.tier === "Unranked") return "Unranked";
  const tier = String(p.tier || "").toUpperCase();
  if (["MASTER", "GRANDMASTER", "CHALLENGER"].includes(tier)) {
    return `${p.tier} ${p.lp || 0} LP`;
  }
  return `${p.tier} ${p.division || ""} ${p.lp || 0} LP`.trim();
}

function winRate(p) {
  const wins = p.wins || 0;
  const losses = p.losses || 0;
  const total = wins + losses;
  return total ? Math.round((wins / total) * 100) : 0;
}

function fmtPlayer(p) {
  return `${p.name || p.riotId}: ${fmtRank(p)} (${winRate(p)}% WR, ${p.wins || 0}W/${p.losses || 0}L)`;
}

async function latestChallengePlayers() {
  if (!isDatabaseConfigured()) return null;
  const snapshots = await listSnapshots();
  const latest = snapshots[snapshots.length - 1];
  if (!latest || !latest.ranks) return null;

  const players = CHALLENGE_PLAYERS.map((riotId) => latest.ranks[riotId]).filter(
    Boolean,
  );
  return players.length === CHALLENGE_PLAYERS.length ? players : null;
}

async function currentChallengePlayers() {
  const key = apiKey();
  if (key) {
    try {
      return await Promise.all(
        CHALLENGE_PLAYERS.map((riotId) =>
          fetchRankForRiotId(riotId, CHALLENGE_REGION, key),
        ),
      );
    } catch (e) {
      const fallback = await latestChallengePlayers().catch(() => null);
      if (fallback) return fallback;
      throw e;
    }
  }

  const fallback = await latestChallengePlayers();
  if (fallback) return fallback;
  throw new Error("RIOT_API_KEY no configurada");
}

async function currentPlayerRank(riotId, region = CHALLENGE_REGION) {
  const key = apiKey();
  if (!key) throw new Error("RIOT_API_KEY no configurada");
  return fetchRankForRiotId(riotId, region, key);
}

function challengeGap(players) {
  const [p1, p2] = players;
  const diff = Math.abs((p1.totalLp || 0) - (p2.totalLp || 0));
  const leader = (p1.totalLp || 0) >= (p2.totalLp || 0) ? p1 : p2;
  const trailer = leader === p1 ? p2 : p1;
  return { diff, leader, trailer, p1, p2 };
}

function gapText(players) {
  const { diff, leader, trailer, p1, p2 } = challengeGap(players);
  const lead = diff === 0
    ? "Empate en el SoloQ Challenge."
    : `${leader.name} lidera por ${diff} LP sobre ${trailer.name}.`;
  return `${lead} ${p1.name}: ${fmtRank(p1)} | ${p2.name}: ${fmtRank(p2)}`;
}

module.exports = {
  CHALLENGE_PLAYERS,
  CHALLENGE_REGION,
  challengeGap,
  currentChallengePlayers,
  currentPlayerRank,
  fmtPlayer,
  gapText,
  sendText,
};
