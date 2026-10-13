# Deploying SkyCrew on a server

This folder runs the whole application on one server with Docker: the web
application, the API, the database, the cache and an HTTPS reverse proxy.
Members reach everything through a single address.

## What you need

- A Linux server with Docker and the Compose plugin (2 GB of memory is enough).
- A domain name pointing to the server, with ports 80 and 443 open. The HTTPS
  certificate is obtained and renewed automatically.
- An account with an e-mail provider (SMTP) for account activation, password
  reset and notifications.

## First installation

1. Copy `docker-compose.yml`, `Caddyfile` and `.env.example` to a folder on
   the server.
2. Rename `.env.example` to `.env` and fill it in. Each value is explained in
   the file. Generate the two secrets with `openssl rand -hex 32`.
3. Start everything:

   ```bash
   docker compose up -d
   ```

4. Open the address in a browser and sign in with `ADMIN_EMAIL` and
   `ADMIN_PASSWORD`. Change the password from the profile page, then empty
   `ADMIN_PASSWORD` in `.env`: it is only read to create the account.

The first start creates the database, the four roles, the administrator and
the club settings. Later starts leave existing data untouched.

The images are published at `ghcr.io/skycrew-app/backend` and
`ghcr.io/skycrew-app/frontend`. If they are private, sign in on the server
first with `docker login ghcr.io`.

## On a server that already runs a web server

When ports 80 and 443 are taken by another web server, or the server hosts
other applications, add the second Compose file to every command:

```bash
docker compose -f docker-compose.yml -f docker-compose.behind-proxy.yml up -d
```

SkyCrew then only listens on `127.0.0.1:8100` (change it with `LOCAL_PORT`),
with a memory and processor cap on each service. In `.env`, set
`SITE_ADDRESS=:80` and keep `PUBLIC_URL` to the public address. The existing
web server terminates HTTPS and forwards to that port:
`nginx-site.conf.example` is a ready-made nginx site, to complete with
`certbot --nginx`.

## Updating

Set `BACKEND_VERSION` and `FRONTEND_VERSION` in `.env` to the versions wanted
(or keep `latest`), then:

```bash
docker compose pull
docker compose up -d
```

The API is updated before the web application, and database changes are
applied when the API starts. Back up before updating.

## Backups

Two things hold the data of the club: the database and the uploaded files.

```bash
# Database
docker compose exec -T db pg_dump -U skycrew skycrew | gzip > skycrew-db-$(date +%F).sql.gz

# Uploaded files (licences, maintenance documents, pictures)
docker run --rm -v skycrew_uploads:/data -v "$PWD":/backup alpine \
  tar czf /backup/skycrew-uploads-$(date +%F).tar.gz -C /data .
```

Keep the backups on another machine, and keep a copy of `.env`: `JWT_SECRET`
and `DB_PASSWORD` are needed to restore.

To restore a database backup into an empty installation:

```bash
gunzip -c skycrew-db-2026-01-01.sql.gz | docker compose exec -T db psql -U skycrew skycrew
```

## Useful commands

```bash
docker compose ps                 # state of each service
docker compose logs -f backend    # what the API is doing
docker compose restart backend    # after changing .env, use: docker compose up -d
```

`https://<address>/health` answers with the state of the API and of its
database.

## Notes

- Card payments, PayPal and weather are optional: leave their keys empty and
  the rest of the application works.
- `API_NINJAS_KEY` (a free key from api-ninjas.com) feeds the aerodrome
  search of the profile and the weather of the dashboard. It is read by the
  API only and never reaches the browser; without it both stay empty.
- The map and weather keys used by the browser are part of the web
  application image. They are set as repository variables on GitHub
  (`NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN`, `NEXT_PUBLIC_OPENWEATHERMAP_API_KEY`,
  ...) and applied when a version is published.
- `DEMO_MODE=true` makes the API read-only, for a public demonstration.
