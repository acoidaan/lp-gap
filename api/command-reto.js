const {
  challengeGap,
  currentChallengePlayers,
  sendText,
} = require("./_commands");

module.exports = async (req, res) => {
  if (req.method && req.method !== "GET") {
    return sendText(res, "Metodo no permitido", 405);
  }

  try {
    const players = await currentChallengePlayers();
    const { diff, leader, trailer } = challengeGap(players);
    const status =
      diff === 0
        ? "ahora mismo van empatados"
        : `${leader.name} va +${diff} LP sobre ${trailer.name}`;
    sendText(
      res,
      `SoloQ Challenge: SevillanaEnjoyer vs CAL Destroyersit, 1 ago 2026 00:00 -> 1 sep 2026 00:00 Canarias. Max 10 partidas/dia. Premio: cena. ${status}.`,
    );
  } catch (e) {
    sendText(res, `No se pudo cargar el reto: ${e.message}`, 200, false);
  }
};
