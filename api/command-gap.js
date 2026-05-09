const { currentChallengePlayers, gapText, sendText } = require("./_commands");

module.exports = async (req, res) => {
  if (req.method && req.method !== "GET") {
    return sendText(res, "Metodo no permitido", 405);
  }

  try {
    const players = await currentChallengePlayers();
    sendText(res, gapText(players));
  } catch (e) {
    sendText(res, `No se pudo cargar el gap: ${e.message}`, 200, false);
  }
};
