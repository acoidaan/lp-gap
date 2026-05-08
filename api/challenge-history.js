const {
  CHALLENGE_ID,
  CHALLENGE_PLAYERS,
  CHALLENGE_REGION,
  isDatabaseConfigured,
  listSnapshots,
} = require("./_challenge");

module.exports = async (req, res) => {
  if (!isDatabaseConfigured()) {
    return res.json({
      configured: false,
      challengeId: CHALLENGE_ID,
      region: CHALLENGE_REGION,
      players: CHALLENGE_PLAYERS,
      snapshots: [],
    });
  }

  try {
    const snapshots = await listSnapshots();
    res.setHeader("Cache-Control", "s-maxage=60, stale-while-revalidate=300");
    res.json({
      configured: true,
      challengeId: CHALLENGE_ID,
      region: CHALLENGE_REGION,
      players: CHALLENGE_PLAYERS,
      snapshots,
    });
  } catch (e) {
    console.error("CHALLENGE HISTORY ERROR:", e.message);
    res.status(500).json({ error: e.message });
  }
};
