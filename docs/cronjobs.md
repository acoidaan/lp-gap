# Cronjobs externos

Este proyecto usa dos tipos de cron:

- Vercel Cron para `/api/challenge-snapshot`, una vez al dia.
- cron-job.org para `/api/twitch-watch`, cada 15 minutos.

Vercel Hobby solo permite cron una vez al dia, asi que el watcher de Twitch va
mejor en un cron externo.

## Twitch watcher en cron-job.org

Configura el job asi:

### Common

- **Title**: `LP Gap Twitch Watch`
- **URL**: `https://lp-gap.vercel.app/api/twitch-watch`
- **Enable job**: activado
- **Save responses in job history**: activado mientras pruebas
- **Execution schedule**: `Every 15 minutes`
- **Schedule expires**: desactivado
- **Notify me when execution fails**: recomendado, despues de `1` fallo

### Advanced

- **Requires HTTP authentication**: desactivado
- **Request method**: `GET`
- **Request body**: vacio
- **Timeout**: `30` seconds
- **Treat redirects with HTTP 3xx status code as success**: desactivado

En **Headers**, pulsa **ADD** y anade:

```text
Authorization: Bearer TU_CRON_SECRET
```

`TU_CRON_SECRET` tiene que ser exactamente el mismo valor que tienes en Vercel
como variable de entorno `CRON_SECRET`.

## Variables necesarias

En Vercel tienen que existir estas variables:

- `CRON_SECRET`
- `DATABASE_URL`, `POSTGRES_URL` o `NEON_DATABASE_URL`
- `TWITCH_CLIENT_ID`
- `TWITCH_CLIENT_SECRET`
- `DISCORD_WEBHOOK_URL`

## Test run

El test run correcto debe devolver `200 OK` con un JSON parecido a:

```json
{
  "ok": true,
  "checked": 3,
  "newlyLive": [],
  "discord": {
    "skipped": true
  }
}
```

Si alguien acaba de pasar de offline a live, `newlyLive` traera su canal y se
mandara el aviso a Discord.

Errores habituales:

- `401 No autorizado`: falta el header `Authorization` o el secreto no coincide.
- `500 DATABASE_URL no configurada`: falta la variable de Neon/Postgres.
- `500 TWITCH_CLIENT_ID/SECRET no configurados`: faltan credenciales de Twitch.
