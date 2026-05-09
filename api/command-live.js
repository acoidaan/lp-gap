const {
  PUBLIC_TWITCH_CHANNELS,
  fetchStreams,
  isTwitchConfigured,
} = require("./_twitch");
const { sendText } = require("./_commands");

module.exports = async (req, res) => {
  if (req.method && req.method !== "GET") {
    return sendText(res, "Metodo no permitido", 405);
  }

  if (!isTwitchConfigured()) {
    return sendText(res, "Twitch no configurado.");
  }

  try {
    const streams = await fetchStreams(PUBLIC_TWITCH_CHANNELS);
    const live = Object.entries(streams);
    if (!live.length) {
      return sendText(res, "Ahora mismo no hay directos vigilados.");
    }

    const text = live
      .map(([channel, stream]) => {
        const game = stream.gameName || "Twitch";
        const viewers = stream.viewerCount || 0;
        return `${stream.userName || channel}: ${game}, ${viewers} viewers - https://twitch.tv/${channel}`;
      })
      .join(" | ");
    sendText(res, `Directos: ${text}`);
  } catch (e) {
    sendText(res, `No se pudo cargar Twitch: ${e.message}`, 200, false);
  }
};
