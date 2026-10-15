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

### In one command, from a workstation

When the server cannot reach the registry, `release-to-server.sh` builds the
images from the version tags, copies them over SSH and switches the versions:

```bash
deploy/release-to-server.sh my-server --backend 2.13.0 --frontend 2.10.0
```

It runs the backup first, waits for the API and the web application to report
healthy, and puts the previous versions back by itself when they do not. Give
only `--backend` or only `--frontend` to update one of them. On a server
with several clubs (see below), `--club <slug>` updates that club only:

```bash
deploy/release-to-server.sh my-server --club aeroclub-vexin --backend 2.18.0 --frontend 2.14.0
```

To check beforehand that the versions build, without touching the server:

```bash
deploy/release-to-server.sh --dry-run --backend 2.13.0 --frontend 2.10.0
```

The script stops at the first step that fails, with a status other than 0. A
failed build shows the end of what it printed (`LOG_LINES`, 40 by default) and
the file holding the rest; the server is then left as it was. When its output
is piped into another command (`| tee`, `| tail`), the status seen is the one
of that command: read the last lines, which say `FAILED` or `Done`.

## Knowing when the site is down

`skycrew-watch.sh` checks the health address and posts a message to a chat
webhook (Slack, Discord…) or sends an e-mail when the site stops answering,
and again when it is back. Install it and call it from cron every two minutes:

```bash
sudo install -m 755 deploy/skycrew-watch.sh /usr/local/sbin/skycrew-watch
echo '*/2 * * * * root ALERT_WEBHOOK_URL=https://… /usr/local/sbin/skycrew-watch' | sudo tee /etc/cron.d/skycrew-watch
```

Run it from another machine as well if you can: a watcher on the server itself
says nothing when the whole server is down.

## Backups

Two things hold the data of the club: the database and the uploaded files.
`skycrew-backup.sh <deployment folder> <backup folder> [days kept]` saves
both, with the `.env`, for one installation; `new-club.sh` installs it for
each club it creates. By hand:

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
database, memory and disk: it answers 503 when one of them is short, even
while the site still works. The watcher checks `/health/ready` (the API
answers and reaches its database), so that a busy moment does not raise a
"site down" alert.

## Plans

Each installation serves one club, sold in one of two plans, set in `.env`
and read when the API starts:

| Variable | Values | Left empty |
| --- | --- | --- |
| `SKYCREW_PLAN` | `club` (everything except instruction) or `ecole` (everything) | `ecole` |
| `SKYCREW_MAX_AIRCRAFT` | aircraft in service allowed (retired or grounded ones do not count) | no limit |
| `SKYCREW_MAX_MEMBERS` | active members allowed (deactivated ones do not count) | no limit |

Instruction is: bookings with an instructor, courses, student progress,
e-learning, evaluations and the instructor role. After a change, run
`docker compose up -d` (the API restarts, about 30 seconds). Nothing is ever
deleted: with a lower limit or the `club` plan, what exists stays readable and
only additions are refused.

## Mettre en service un nouveau club

Un serveur peut accueillir plusieurs clubs côte à côte, chacun avec son
dossier (`/opt/skycrew-<nom>`), sa base de données, ses fichiers, son port
local, sa sauvegarde et sa surveillance. Le script `new-club.sh`, lancé depuis
votre ordinateur, prépare tout cela sans toucher aux autres clubs ni aux
autres logiciels du serveur. Il refuse de continuer si quoi que ce soit de ce
club existe déjà.

### Avant de commencer

Rassemblez :

- un **nom court** pour le club, en minuscules, chiffres et tirets
  (par exemple `aeroclub-vexin`) ;
- son **adresse** (par exemple `vexin.skycrew.fr`), et faites-la pointer vers
  le serveur chez le fournisseur du nom de domaine (enregistrement DNS de type
  A vers l'adresse IP du serveur) ;
- l'**e-mail du premier administrateur** du club (le président, le
  secrétaire…) ;
- la **formule** vendue : `club` (tout sauf l'instruction) ou `ecole` (tout),
  et les limites éventuelles (nombre d'avions en service, nombre de membres
  actifs) ;
- si possible, les réglages d'**envoi d'e-mails** du club (voir l'étape 6).

### Étapes

1. **Simulation.** Depuis le dossier `backend`, lancez la commande avec
   `--dry-run` : elle affiche chaque fichier et chaque commande, sans rien
   envoyer au serveur.

   ```bash
   deploy/new-club.sh tickly-prod aeroclub-vexin --domain vexin.skycrew.fr \
     --admin-email president@aeroclub-vexin.fr --plan club --max-aircraft 3 --dry-run
   ```

   Options utiles : `--max-members 60`, `--port 8105` (sinon le premier port
   libre à partir de 8101), `--backend 2.18.0 --frontend 2.14.0` (sinon les
   versions de `/opt/skycrew`), `--alert-webhook https://…` (message sur
   Discord ou Slack si le club ne répond plus).

2. **Installation.** Relancez la même commande sans `--dry-run`. Le script
   crée le dossier du club, ses secrets (tirés au hasard), son fichier `.env`,
   la sauvegarde quotidienne et la surveillance, puis démarre le club et
   attend qu'il réponde (quelques minutes la première fois : création de la
   base, des rôles et de l'administrateur).

   À la fin, il affiche **une seule fois** le mot de passe provisoire du
   premier administrateur. Notez-le et transmettez-le à l'administrateur du
   club par un moyen sûr (de vive voix, SMS…), jamais dans le même e-mail que
   l'adresse du site.

   Si le script dit qu'une image manque sur le serveur, relancez-le avec
   `--no-start`, puis démarrez le club avec :
   `BACKUP_CMD=none deploy/release-to-server.sh tickly-prod --club aeroclub-vexin --backend X --frontend Y`
   (qui copie les images et démarre le club).

3. **Relire le site nginx.** Le script a écrit le fichier
   `/opt/skycrew-<nom>/nginx-<adresse>.conf` et l'a affiché, mais ne l'a
   **pas** activé. Vérifiez que l'adresse et le port sont les bons.

4. **Activer le site** sur le serveur, en recopiant les commandes affichées
   par le script :

   ```bash
   sudo cp /opt/skycrew-aeroclub-vexin/nginx-vexin.skycrew.fr.conf /etc/nginx/sites-available/skycrew-aeroclub-vexin.conf
   sudo ln -s /etc/nginx/sites-available/skycrew-aeroclub-vexin.conf /etc/nginx/sites-enabled/
   sudo nginx -t
   sudo systemctl reload nginx
   sudo certbot --nginx -d vexin.skycrew.fr
   ```

   `nginx -t` doit répondre « syntax is ok » et « test is successful » ;
   sinon, n'allez pas plus loin et retirez le lien créé dans
   `sites-enabled`. Utilisez toujours `reload`, **jamais** `restart` : un
   `reload` ne coupe aucun des autres sites du serveur. `certbot` ajoute le
   HTTPS et le renouvelle tout seul.

5. **Première connexion.** Ouvrez `https://<adresse>`, connectez-vous avec
   l'e-mail de l'administrateur et le mot de passe provisoire : l'application
   marche. L'administrateur du club change son mot de passe dans « Mon
   profil ». Ensuite, videz la ligne `ADMIN_PASSWORD=` dans
   `/opt/skycrew-<nom>/.env` (elle ne sert qu'à créer le compte).

6. **E-mails du club.** Remplissez `MAIL_HOST`, `MAIL_PORT`, `MAIL_USER`,
   `MAIL_PASSWORD` et `MAIL_FROM` dans `/opt/skycrew-<nom>/.env` (les
   réglages SMTP du fournisseur d'e-mails du club : Brevo, OVH, Gmail
   professionnel…), puis dans ce dossier : `sudo docker compose up -d`.
   Sans ces réglages, aucun e-mail ne part : le premier administrateur entre
   quand même avec son mot de passe provisoire (c'est prévu pour), mais les
   membres qu'il invite ne reçoivent pas leur lien d'activation, et « Mot de
   passe oublié » ne fonctionne pas. Remplissez-les donc avant que le club
   invite ses membres.

7. **Paiements en ligne du club** (facultatif). Voir ci-dessous, puis
   `sudo docker compose up -d` dans le dossier du club.

Le club voit sa formule dans Administration (carte « Formule ») : avions et
membres utilisés sur le nombre permis.

### Qui paie qui

Il y a deux circuits d'argent, qui ne se mélangent jamais :

- **Les membres paient leur club.** Quand un pilote approvisionne son solde
  par carte ou PayPal, l'argent va sur le compte **du club**. Ce sont donc les
  clés Stripe et PayPal **du club** qui vont dans son `.env`
  (`STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `PAYPAL_CLIENT_ID`,
  `PAYPAL_CLIENT_SECRET`, `PAYPAL_MODE=live`). Le club les crée dans son
  propre compte Stripe ; dans Stripe, il déclare l'adresse
  `https://<adresse>/webhooks/stripe` comme point de notification, qui lui
  donne `STRIPE_WEBHOOK_SECRET`. Sans ces clés, le reste de l'application
  fonctionne et les soldes s'approvisionnent à la main par l'administrateur.
- **Le club vous paie son abonnement.** Cela se passe hors de SkyCrew : vous
  facturez le club avec votre propre compte (abonnement Stripe, lien de
  paiement, virement…). Vos clés à vous ne vont **jamais** dans le `.env` d'un
  club.

### Changer la formule d'un club

Dans `/opt/skycrew-<nom>/.env`, modifiez `SKYCREW_PLAN`,
`SKYCREW_MAX_AIRCRAFT` ou `SKYCREW_MAX_MEMBERS` (vide = sans limite), puis
`sudo docker compose up -d` dans ce dossier (environ 30 secondes de coupure
pour ce club seulement). Rien n'est supprimé : en passant à une formule plus
petite, ce qui existe reste consultable, seuls les ajouts sont refusés.

### Ce que le script installe

| Quoi | Où |
| --- | --- |
| Le club (Compose, `.env`, site nginx à activer) | `/opt/skycrew-<nom>/` |
| Sauvegarde quotidienne (base, fichiers, `.env`), gardée 14 jours | `/usr/local/sbin/skycrew-backup-<nom>`, `/etc/cron.d/skycrew-backup-<nom>`, archives dans `/var/backups/skycrew-<nom>/` |
| Surveillance toutes les 2 minutes | `/etc/cron.d/skycrew-watch-<nom>`, réglages dans `/etc/skycrew-watch-<nom>.env` |

Les sauvegardes sont sur le même disque que le serveur : copiez-les
régulièrement ailleurs.

Mise à jour d'un club : `deploy/release-to-server.sh <serveur> --club <nom> --backend X --frontend Y`
(les autres clubs gardent leurs versions).

Retirer un club (définitif, sauvegardez d'abord) :

```bash
cd /opt/skycrew-<nom> && sudo docker compose down -v
sudo rm -rf /opt/skycrew-<nom> /usr/local/sbin/skycrew-backup-<nom> /etc/cron.d/skycrew-backup-<nom> \
  /etc/cron.d/skycrew-watch-<nom> /etc/skycrew-watch-<nom>.env
sudo rm /etc/nginx/sites-enabled/skycrew-<nom>.conf && sudo nginx -t && sudo systemctl reload nginx
```

## Gérer plusieurs clubs

Quand vous avez plusieurs clubs, sur un ou plusieurs serveurs, une seule
commande lancée depuis votre ordinateur (dans le dossier `backend`) les voit
tous : `deploy/clubs.sh`.

### Une fois pour toutes : la liste des serveurs

Copiez `deploy/servers.conf.example` en `deploy/servers.conf` et écrivez-y vos
serveurs, un par ligne, comme vous les tapez après `ssh` (par exemple
`tickly-prod`). Ce fichier reste sur votre ordinateur (il n'est jamais envoyé
sur GitHub).

Vous n'avez **pas** à tenir la liste des clubs : le script les trouve tout seul
sur chaque serveur (le dossier `/opt/skycrew`, le premier club, qui s'appelle
`skycrew` dans le script, puis chaque dossier `/opt/skycrew-<nom>`). Un club
ajouté avec `new-club.sh` apparaît donc tout de suite.

### Voir l'état de tous les clubs

```bash
deploy/clubs.sh status
```

Ne modifie rien. Pour chaque serveur : mémoire, processeurs et disque libres,
et combien de clubs il peut encore accueillir. Pour chaque club : son adresse,
sa formule et ses limites, ses versions, ses conteneurs, s'il répond (sur le
serveur et à son adresse publique), sa dernière sauvegarde, la place de ses
données, sa mémoire, son nombre de membres actifs, d'avions en service et de
réservations des 30 derniers jours, et son veilleur de panne. Chaque club est
classé **OK**, **À voir** ou **Problème**, avec la raison en dessous du tableau.

Seuls des nombres sont lus dans la base de chaque club, en lecture seule :
aucun nom, aucune adresse e-mail ne sort du serveur.

### Le tableau de bord

```bash
deploy/clubs.sh status --html ~/Desktop/clubs.html
```

Écrit la même chose dans une page qu'il ouvre dans votre navigateur : un seul
fichier, qui marche sans Internet, en clair ou en sombre selon votre Mac.
Cliquez sur le titre d'une colonne pour trier (par exemple par état, pour
avoir les problèmes en premier). La page ne contient ni mot de passe, ni clé,
ni adresse de webhook : vous pouvez la garder ou la transmettre. Elle montre
l'état au moment où vous l'avez générée : relancez la commande pour la mettre
à jour.

Ce qui met un club en **Problème** : un conteneur arrêté ou malade, le club
qui ne répond pas, aucune sauvegarde de moins de 2 jours, ou son veilleur qui
le voit en panne. En **À voir** : une sauvegarde de plus de 26 heures, pas de
veilleur ou un veilleur sans destinataire, des alertes qui ne disent pas de
quel club il s'agit, ou un plafond de la formule atteint.

### Mettre à jour tous les clubs

```bash
deploy/clubs.sh update-all --backend 2.19.0 --frontend 2.15.0
```

Le script affiche d'abord le plan (chaque club, sa version actuelle et la
nouvelle) et demande de taper `oui`. Ensuite il construit les images **une
seule fois**, les copie **une seule fois** par serveur, puis met les clubs à
jour **l'un après l'autre** : sauvegarde, changement de version, attente que
le club réponde (2 minutes au plus), et retour tout seul à l'ancienne version
s'il ne répond pas. Chaque club n'est coupé qu'environ 30 secondes, les autres
continuent de tourner.

- **Si un club échoue**, il revient à son ancienne version et le script
  s'arrête là : il affiche les clubs mis à jour, celui qui a échoué (et
  pourquoi) et ceux qui n'ont pas été tentés. Regardez ce qui s'est passé avec
  `deploy/clubs.sh logs <nom>`. Une fois le problème réglé, relancez la même
  commande : les clubs déjà à jour sont passés.
- `--continue-on-error` : continue avec les clubs suivants malgré un échec.
- `--only aeroclub-vexin,aeroclub-b` : seulement ces clubs ;
  `--except aeroclub-c` : tous sauf celui-là. Si deux serveurs ont un club du
  même nom, écrivez `serveur:nom`.
- `--dry-run` : montre le plan sans rien construire, copier ni modifier.
- `--yes` : ne pose pas la question (pour l'enchaîner sans vous).
- Un seul des deux (`--backend` ou `--frontend`) suffit pour ne mettre à jour
  que l'un.

Conseil : mettez d'abord à jour un club avec `--only`, vérifiez-le, puis
lancez les autres. `release-to-server.sh --club <nom>` fait toujours la même
chose pour un seul club.

### Sauvegarder tout de suite

```bash
deploy/clubs.sh backup-all
```

Lance la sauvegarde de chaque club maintenant (en plus de celle de chaque
nuit), par exemple avant une intervention. Accepte aussi `--only` et
`--except`. Les sauvegardes restent sur le disque du serveur : copiez-les
régulièrement ailleurs.

### Lire ce qui se passe dans un club

```bash
deploy/clubs.sh logs aeroclub-vexin            # 100 dernières lignes
deploy/clubs.sh logs aeroclub-vexin --lines 300
```

### Les alertes de panne

Chaque club créé par `new-club.sh` a son veilleur, qui envoie un message
nommant le club et son adresse, par exemple « SkyCrew (aeroclub-vexin,
vexin.skycrew.fr) ne répond plus », puis « … répond de nouveau ». Le tableau
de bord indique pour chaque club si le veilleur est installé, s'il a un
destinataire (webhook Discord ou e-mail) et sa dernière alerte.

Le premier club (`/opt/skycrew`) a été installé à la main : si le tableau dit
« alertes sans nom du club », mettez son nom dans `/etc/skycrew-watch.env` :

```bash
MESSAGE_DOWN='SkyCrew (skycrew, <adresse du site>) ne répond plus'
MESSAGE_UP='SkyCrew (skycrew, <adresse du site>) répond de nouveau'
```

La date de la dernière alerte est lue dans le journal du serveur ; les
veilleurs à jour (le fichier `skycrew-watch.sh` de ce dossier) la notent aussi
à côté de leur état, ce qui la garde même si le journal est vidé.

### Combien de clubs par serveur

`status` donne pour chaque serveur une estimation : « place pour environ N
clubs de plus ». Elle est calculée ainsi :

- **mémoire** : la mémoire libre du serveur, moins une marge pour le reste du
  serveur (1 Go, ou 10 % de la mémoire si c'est plus), divisée par la mémoire
  qu'utilise en moyenne un club de ce serveur (comptée au moins 600 Mo) ;
- **disque** : l'espace libre, moins une marge (5 Go, ou 10 % du disque),
  divisé par ce qu'occupe en moyenne un club, sauvegardes comprises (compté au
  moins 2 Go) ;
- le plus petit des deux est retenu.

C'est un ordre de grandeur pour des clubs de taille moyenne, mesuré à un
instant donné. Chaque club est de toute façon plafonné (environ 3,2 Go de
mémoire au pire), pour ne jamais priver le reste du serveur. Sur `tickly-prod`
(22 Go), la marge protège aussi Tickly : ne descendez pas sous 2 ou 3 clubs de
place.

### Quand ajouter un serveur

Prévoyez un nouveau serveur quand l'une de ces choses arrive :

- le tableau de bord annonce **2 clubs de plus ou moins** pour tous vos
  serveurs (le serveur passe en « À voir », puis en « Problème » à 0) ;
- la mémoire libre reste sous 10 % ou le disque sous 10 % ;
- la charge des processeurs dépasse souvent leur nombre (le serveur passe en
  « À voir ») ;
- ou, pour le serveur de Tickly, dès que vous voulez garder Tickly à l'abri
  de la croissance de SkyCrew.

Un nouveau serveur se prépare comme le premier (Docker, nginx, certbot), puis
s'ajoute en une ligne dans `deploy/servers.conf` ; `new-club.sh` y installe
les clubs suivants. Les clubs existants restent où ils sont.

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
