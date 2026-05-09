const {
  CHALLENGE_PLAYERS,
  CHALLENGE_REGION,
  currentPlayerRank,
  fmtPlayer,
  sendText,
} = require("./_commands");

module.exports = async (req, res) => {
  if (req.method && req.method !== "GET") {
    return sendText(res, "Metodo no permitido", 405);
  }

  const riotId = String(req.query.riot || CHALLENGE_PLAYERS[0]).trim();
  const region = String(req.query.region || CHALLENGE_REGION).trim().toLowerCase();

  if (!riotId.includes("#")) {
    return sendText(res, "Formato: /api/command-lp?riot=Nombre%23Tag", 400);
  }

  try {
    const player = await currentPlayerRank(riotId, region);
    sendText(res, fmtPlayer(player));
  } catch (e) {
    sendText(res, `No se pudo cargar el LP: ${e.message}`, 200, false);
  }
};
