# lp-gap
League of Legends LP comparator

## Environment

Required:

- `RIOT_API_KEY`: Riot API key used by the serverless endpoints.

Optional for permanent SoloQ Challenge history:

- `DATABASE_URL`: Neon/Postgres connection string.
- `CRON_SECRET`: secret used by Vercel Cron when calling `/api/challenge-snapshot`.

The challenge history endpoint falls back to browser `localStorage` when
`DATABASE_URL` is not configured. Vercel Cron runs `/api/challenge-snapshot`
daily at 07:00 UTC.
