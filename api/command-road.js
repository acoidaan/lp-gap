const {
  CHALLENGE_PLAYERS,
  CHALLENGE_REGION,
  currentPlayerRank,
  sendText,
} = require("./_commands");

module.exports = async (req, res) => {
  if (req.method && req.method !== "GET") {
    return sendText(res, "Metodo no permitido", 405);
  }

  const riotId = String(req.query.riot || CHALLENGE_PLAYERS[0]).trim();
  const region = String(req.query.region || CHALLENGE_REGION).trim().toLowerCase();

  if (!riotId.includes("#")) {
    return sendText(res, "Formato: /api/command-road?riot=Nombre%23Tag", 400);
  }

  try {
    const player = await currentPlayerRank(riotId, region);
    const level = Number(player.summonerLevel || 0);
    const missing = Math.max(0, 30 - level);
    const status =
      level >= 30
        ? "rankeds desbloqueadas"
        : `faltan ${missing} niveles para desbloquear ranked`;
    const levelText = level >= 30 ? `nivel ${level}` : `nivel ${level}/30`;
    sendText(res, `Road to Ranked: ${player.name || riotId} va ${levelText}, ${status}.`);
  } catch (e) {
    sendText(res, `No se pudo cargar el Road to Ranked: ${e.message}`, 200, false);
  }
};
