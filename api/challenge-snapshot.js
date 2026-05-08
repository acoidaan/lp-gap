const {
  CHALLENGE_ID,
  CHALLENGE_PLAYERS,
  CHALLENGE_REGION,
  fetchRankForRiotId,
  isAuthorized,
  isDatabaseConfigured,
  saveSnapshot,
} = require("./_challenge");

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

  const apiKey = process.env.RIOT_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "RIOT_API_KEY no configurada" });
  }

  try {
    const players = await Promise.all(
      CHALLENGE_PLAYERS.map((riotId) =>
        fetchRankForRiotId(riotId, CHALLENGE_REGION, apiKey),
      ),
    );
    const recordedAt = await saveSnapshot(players);

    res.json({
      ok: true,
      challengeId: CHALLENGE_ID,
      recordedAt: recordedAt.toISOString(),
      players,
    });
  } catch (e) {
    console.error("CHALLENGE SNAPSHOT ERROR:", e.message);
    res.status(500).json({ error: e.message });
  }
};
