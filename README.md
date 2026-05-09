# lp-gap

League of Legends LP comparator.

## Configuracion

Copia `.env.example` a `.env.local` para desarrollo local. En Vercel, configura
estas variables desde Project Settings.

Requeridas:

- `RIOT_API_KEY`: Riot API key usada por los endpoints serverless.
- `CRON_SECRET`: secreto para proteger `/api/challenge-snapshot` y
  `/api/twitch-watch` en produccion.

Opcionales:

- `DATABASE_URL`, `POSTGRES_URL` o `NEON_DATABASE_URL`: conexion Neon/Postgres
  para guardar historico permanente del SoloQ Challenge.
- `TWITCH_CLIENT_ID` y `TWITCH_CLIENT_SECRET`: credenciales Helix para detectar
  directos de Twitch.
- `DISCORD_WEBHOOK_URL`: webhook para publicar recaps y avisos.
- `DISCORD_BOT_TOKEN` y `DISCORD_VOICE_CHANNEL_ID`: bot para crear hilos y
  renombrar el canal de voz del reto.

Sin base de datos, el historico del reto cae a `localStorage` en el navegador.
Vercel Cron ejecuta `/api/challenge-snapshot` a diario a las 07:00 UTC.
El watcher de Twitch se configura con cron externo cada 15 minutos; ver
`docs/cronjobs.md`.

## Stream

La pestana `Stream` genera URLs para OBS y comandos listos para Nightbot:

- Overlay jugador: `/overlay/solo.html?riot=Nombre%23Tag&region=euw&refresh=60`
- Overlay challenge: `/overlay/challenge.html?refresh=60&cycle=10`
- Overlay alertas: `/overlay/alerts.html?refresh=60&duration=6&sound=0`
- Nightbot: `$(urlfetch https://TU_DOMINIO/api/command-gap)`,
  `$(urlfetch https://TU_DOMINIO/api/command-reto)`,
  `$(urlfetch https://TU_DOMINIO/api/command-lp?riot=Nombre%23Tag)` y
  `$(urlfetch https://TU_DOMINIO/api/command-live)`.

## Seguridad

- No subas `.env`, `.env.local` ni cadenas de conexion reales al repositorio.
- Si una credencial ha estado alguna vez en git, rotala en el proveedor y
  actualiza la variable correspondiente en Vercel.
- Los endpoints de escritura fallan cerrados en produccion cuando no existe
  `CRON_SECRET`.
- Los webhooks de Discord se envian con `allowed_mentions` desactivado para
  evitar menciones accidentales como `@everyone`.
