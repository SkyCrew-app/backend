# Console SkyCrew

La console est votre tableau de commande, en ligne à votre propre adresse
(par exemple `https://console.skycrew.fr`), réservée à vous seul. Depuis un
ordinateur ou un téléphone, elle vous permet de :

- **voir tous les clubs** d’un coup d’œil : s’ils répondent, leurs versions,
  leur formule, leur dernière sauvegarde, leurs nombres de membres, d’avions
  et de réservations, les alertes, et la place qui reste sur chaque serveur ;
- **gérer chaque club** : en créer un, changer sa formule et ses limites, le
  suspendre et le réactiver, le sauvegarder tout de suite ;
- **mettre à jour** un club ou tous les clubs, avec retour automatique à
  l’ancienne version si la nouvelle ne répond pas ;
- **suivre les abonnements Stripe** pris sur le site vitrine, les relier aux
  clubs, et suspendre automatiquement un club qui ne paie plus (puis le
  réactiver dès qu’il paie).

Ce que la console ne fait **jamais** : lire les données des membres des clubs.
Elle ne voit que l’état des installations et des nombres (combien de membres,
d’avions, de réservations), comme `deploy/clubs.sh status`. Elle n’affiche
jamais de mot de passe, de clé ni d’adresse de webhook, sauf le mot de passe
provisoire d’un club que vous venez de créer, une seule fois.

## Comment elle est faite (pour information)

- Un petit programme Node.js qui tourne sur le serveur des clubs, sous un
  utilisateur à lui (`skycrew-console`), qui n’écoute que sur le serveur
  lui-même (`127.0.0.1:8090`). nginx le publie à son adresse, en HTTPS.
- Il n’a **aucun** droit sur Docker ni sur `/opt`. Pour agir sur un club, il
  demande à un petit outil, `skycrew-console-helper`, le seul programme qu’il
  a le droit de lancer en administrateur (règle `sudo` dédiée). Cet outil ne
  sait faire qu’une liste fixe de choses et vérifie lui-même chaque nom de
  club, chaque version, chaque adresse. Il réutilise les scripts du dossier
  `deploy/` (`new-club.sh`, `clubs-remote.sh`, `release-lib.sh`) : la console
  fait exactement ce que font ces scripts.
- Ses données (votre compte, les sessions, le journal, les abonnements, les
  opérations) sont dans un seul fichier, `/var/lib/skycrew-console/console.db`.

## Installer la console

### Ce qu’il faut

- Le serveur des clubs (Docker, nginx et certbot y sont déjà).
- **Node.js 24** sur ce serveur. Debian en propose une version plus ancienne ;
  installez la 24 depuis NodeSource :

  ```bash
  curl -fsSL https://deb.nodesource.com/setup_24.x -o /tmp/nodesource.sh
  sudo bash /tmp/nodesource.sh && sudo apt install -y nodejs
  node -v      # doit afficher v24…
  ```

- Une **adresse pour la console** (par exemple `console.skycrew.fr`), pointée
  vers le serveur chez le fournisseur du nom de domaine (enregistrement DNS de
  type A vers l’adresse IP du serveur).
- Une **application d’authentification** sur votre téléphone (Google
  Authenticator, Microsoft Authenticator, 1Password…).

### Étapes

1. **Copier le dépôt sur le serveur** (le dossier `backend`, branche publiée),
   par exemple dans `~/skycrew-backend`.

2. **Simulation** : affiche chaque fichier et chaque commande, sans rien
   changer.

   ```bash
   cd ~/skycrew-backend
   sudo console/deploy/install.sh --domain console.skycrew.fr --dry-run
   ```

3. **Installation** : la même commande sans `--dry-run`. Elle crée
   l’utilisateur `skycrew-console`, installe la console, l’outil et sa règle
   `sudo` (vérifiée par `visudo` avant d’être activée), et démarre le service.
   Elle ne touche à aucun club, ni aux sites nginx déjà actifs.

4. **Créer votre compte** (une seule fois ; il n’y a pas de page
   d’inscription) :

   ```bash
   sudo skycrew-console create-owner
   ```

   Choisissez un identifiant et un mot de passe (12 caractères au moins ; une
   phrase de plusieurs mots est idéale). Un code QR s’affiche : scannez-le avec
   l’application de votre téléphone, puis tapez le code à 6 chiffres qu’elle
   affiche. La commande affiche alors **10 codes de secours** : notez-les sur
   papier ou dans votre coffre de mots de passe, hors du téléphone. Chacun
   remplace une fois le code du téléphone. Ils ne seront plus jamais affichés.

5. **Vérifier** :

   ```bash
   sudo skycrew-console check
   ```

   Chaque serveur doit répondre `skycrew-console-helper 1`.

6. **Activer le site** de la console (comme pour un club : `nginx -t` avant
   tout rechargement, toujours `reload`, jamais `restart`) :

   ```bash
   sudo cp /etc/skycrew-console/nginx-console.conf /etc/nginx/sites-available/skycrew-console.conf
   sudo ln -s /etc/nginx/sites-available/skycrew-console.conf /etc/nginx/sites-enabled/
   sudo nginx -t && sudo systemctl reload nginx
   sudo certbot --nginx -d console.skycrew.fr --redirect
   ```

   `nginx -t` doit répondre « syntax is ok » et « test is successful » ;
   sinon, retirez le lien créé dans `sites-enabled` et n’allez pas plus loin.

7. Ouvrez `https://console.skycrew.fr` : c’est prêt.

Pour **mettre à jour la console** plus tard : mettez à jour la copie du dépôt
puis relancez l’étape 3. Vos réglages et vos données sont gardés.

## Se connecter

1. Identifiant et mot de passe.
2. Le code à 6 chiffres de l’application du téléphone (ou un code de secours).

La session se ferme après 30 minutes sans rien ouvrir, et au plus tard après
8 heures. Avant chaque action sur un club, la console vous redemande un code
du téléphone (sauf si vous en avez donné un dans les 5 dernières minutes).

- **5 essais faux depuis la même adresse** bloquent cette adresse 15 minutes ;
  **10 essais faux en tout** bloquent le compte 15 minutes. Pour le débloquer
  tout de suite : `sudo skycrew-console unlock` sur le serveur.
- **Téléphone perdu ou changé** : connectez-vous avec un code de secours, puis
  sur le serveur `sudo skycrew-console reset-2fa` (nouveau code QR, nouveaux
  codes de secours, toutes les sessions fermées).
- **Mot de passe oublié** : `sudo skycrew-console set-password` sur le serveur.
- Plus que 3 codes de secours ? La page « Compte » vous le signale :
  `reset-2fa` en donne 10 nouveaux.

## Les écrans

### Clubs (tableau de bord)

En haut, les **serveurs** : mémoire et disque libres, charge, et surtout
« **N clubs de plus, environ** » (le même calcul que `clubs.sh status` : la
mémoire et le disque libres, moins une marge, divisés par ce qu’utilise un
club). En dessous, **tous les clubs**, les plus urgents d’abord, chacun classé
**OK**, **À voir** ou **Problème**, avec la raison écrite dessous : un
conteneur arrêté, un club qui ne répond pas, une sauvegarde trop vieille, un
plafond de formule atteint, un club suspendu… La colonne « Abonnement » montre
l’état Stripe du club et, s’il ne paie plus, la date prévue de sa suspension.

L’état est relu toutes les minutes au plus quand vous ouvrez la page, et toutes
les 5 minutes en arrière-plan ; « Actualiser maintenant » le relit tout de
suite. Sur téléphone, les colonnes secondaires sont masquées.

### Un club

Cliquez sur son nom. Vous voyez tout son état, son abonnement et ses
dernières opérations, et ses actions :

- **Sauvegarder maintenant** : base, fichiers et réglages, en plus de la
  sauvegarde de chaque nuit.
- **Formule et limites** : Club ou Club + École, nombre d’avions en service et
  de membres actifs permis (vide = sans limite). L’API du club redémarre
  (environ 30 secondes de coupure pour ce club seulement) ; si elle ne
  répondait plus, l’ancienne formule serait remise toute seule. Rien n’est
  jamais effacé : avec une formule plus petite, ce qui existe reste
  consultable, seuls les ajouts sont refusés.
- **Mettre à jour ce club** : choisissez les versions parmi celles présentes
  sur le serveur. Sauvegarde, bascule, attente qu’il réponde (2 minutes au
  plus), et **retour tout seul** à ses versions actuelles sinon.
- **Suspendre / Réactiver** : voir « Suspendre un club » plus bas.
- **Activer le site** (une fois, après la création) : ajoute le site du club à
  nginx, vérifie la configuration (`nginx -t`) avant de recharger nginx, puis
  demande le certificat HTTPS à certbot. Si `nginx -t` refuse, le site est
  retiré et rien d’autre ne change.

Chaque action passe par une page de **confirmation** qui dit exactement ce qui
va se passer, puis s’exécute en arrière-plan : vous suivez son journal en
direct. Une seule action à la fois par club ; les suivantes attendent leur
tour.

### Nouveau club

Les mêmes informations que pour `new-club.sh` : le serveur (avec la place
qu’il lui reste), le nom court, l’adresse, l’e-mail du premier administrateur,
la formule et les limites, les versions, et si vous voulez le webhook Discord
ou Slack qui préviendra si le club ne répond plus (il n’est plus jamais
affiché ensuite). Vous pouvez aussi relier tout de suite l’abonnement Stripe
du club : depuis la page « Abonnements », le lien « Créer son club » remplit
le formulaire avec la formule et le nombre d’avions de l’abonnement.

À la fin, la page de l’opération propose d’**afficher une seule fois** le mot
de passe provisoire du premier administrateur (pendant 30 minutes, après un
code du téléphone). Il n’est enregistré nulle part dans la console.
Transmettez-le par un moyen sûr (de vive voix, SMS), jamais dans le même
e-mail que l’adresse du site. Ensuite : faites pointer l’adresse du club vers
le serveur, « Activer le site » sur la page du club, et remplissez les réglages
d’envoi d’e-mails du club (README du kit, étape 6).

### Mises à jour

Choisissez les versions et les clubs (tous cochés au départ). Les clubs passent
**l’un après l’autre**, comme `clubs.sh update-all` ; ceux déjà dans ces
versions sont passés. Au premier échec, ce club revient à ses versions et la
suite s’arrête (sauf si vous cochez « Continuer… »). « Arrêter après le club
en cours » est possible pendant l’opération. Conseil : un club d’abord, puis
les autres.

### Abonnements

Les abonnements pris sur le site vitrine, tels que Stripe les a signalés : le
nom du club et le contact donnés à la souscription, l’offre, le nombre
d’avions, le statut (actif, période d’essai, paiement en retard, impayé,
résilié…) et, s’il ne paie plus, depuis quand et la date de suspension prévue.
Pour chacun, choisissez le club relié, ou « Créer son club ». En bas, les
dernières notifications reçues de Stripe.

### Opérations

Toutes les actions lancées, par vous ou par la règle des impayés, avec leur
état (en attente, en cours, réussi, échec, « échec, retour à l’ancienne
version », annulé) et leur journal. Une opération en attente peut être
annulée. Une opération en cours va jusqu’au bout : couper une bascule au
milieu laisserait un club à moitié mis à jour.

### Journal

Tout ce qui a été fait ou tenté depuis la console : connexions (réussies et
refusées), actions, notifications Stripe, opérations, avec l’heure et
l’adresse d’origine. Il ne peut être ni modifié ni effacé depuis la console,
et chaque entrée est chaînée à la précédente : la page vérifie la chaîne et
signale si le fichier a été modifié à la main. Une copie part aussi dans le
journal du serveur : `journalctl -u skycrew-console`.

### Compte

Changer le mot de passe (ancien mot de passe + code du téléphone ; toutes les
sessions sont fermées ensuite) et voir le nombre de codes de secours restants.

## Suspendre un club

Pour un club qui ne paie plus, par exemple. Une fois suspendu :

- ses membres voient, sur toutes les pages, « **Service suspendu** — L’accès à
  l’espace de votre club est suspendu. Vos données sont conservées. Contactez
  l’administrateur de votre club, ou le prestataire SkyCrew, pour le
  rétablir. » ;
- son API refuse toute modification (même si on essaie sans passer par les
  pages) ; les paiements en ligne de ses membres (webhooks Stripe et PayPal du
  club) continuent d’être enregistrés ;
- **rien n’est effacé** ; sauvegardes, surveillance et mises à jour continuent.

« Réactiver » rend tout tel quel. Les deux prennent environ 30 secondes (l’API
du club redémarre).

Il faut que le club tourne avec une version de SkyCrew qui connaît la
suspension (l’API 2.19.0 et l’application 2.15.0, ou plus récentes). Sur une
version plus ancienne, la console le dit (« suspension sans effet ») : mettez
le club à jour, puis recommencez. Les clubs installés avant cette fonction
reçoivent automatiquement le nouveau `docker-compose.yml` du kit à leur
première suspension (l’ancien est gardé à côté, en `.bak-<date>`).

## Les images des versions

Pour créer ou mettre à jour un club, les images de la version doivent être sur
le serveur. Réglage `IMAGE_SOURCE` dans `/etc/skycrew-console/helper.conf` :

- `preloaded` (au départ) : la console n’utilise que les images déjà sur le
  serveur. Elles y arrivent comme aujourd’hui, depuis votre Mac :
  `deploy/clubs.sh update-all --only <un club> --backend X --frontend Y`
  construit les images, les copie et met ce club à jour ; les autres clubs se
  mettent ensuite à jour depuis la console.
- `pull` (recommandé une fois réglé) : une image absente est téléchargée de
  GHCR. Les images sont privées : soit rendez publics les paquets `backend` et
  `frontend` de l’organisation `skycrew-app` sur GitHub (ils ne contiennent
  que des clés publiques du navigateur), soit créez sur GitHub un jeton
  « classic » avec le seul droit `read:packages` et enregistrez-le une fois
  sur le serveur :

  ```bash
  sudo docker login ghcr.io -u <votre compte GitHub>   # collez le jeton comme mot de passe
  ```

La console ne construit pas les images sur le serveur : il faudrait y mettre
les sources et les clés de construction, et une construction chargerait le
serveur (et Tickly) plusieurs minutes.

## Relier Stripe

La console apprend les abonnements par les **notifications de Stripe**. Elle
ne détient aucune clé Stripe : seulement le secret qui lui permet de vérifier
que chaque notification vient bien de Stripe.

1. Dans Stripe : **Développeurs › Webhooks › Ajouter une destination**
   (ou « Ajouter un point de terminaison »). Le site vitrine a déjà le sien ;
   celui-ci s’y ajoute.
2. Adresse : **`https://console.skycrew.fr/stripe/webhook`** (votre adresse
   de console, suivie de `/stripe/webhook` ; la page « Abonnements » l’affiche).
3. Événements à cocher :
   - `checkout.session.completed`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.payment_failed`
   - `invoice.paid`
4. Copiez le **secret de signature** (`whsec_…`) dans
   `/etc/skycrew-console/console.env`, ligne `STRIPE_WEBHOOK_SECRET=`, puis :
   `sudo systemctl restart skycrew-console`.
5. Faites-le d’abord en **mode test** de Stripe : la console marque « test »
   ce qui en vient. Puis refaites les étapes 1 à 4 en mode réel (le secret
   change).

Un abonnement apparaît à sa première notification. Pour faire apparaître un
abonnement plus ancien : dans Stripe, ouvrez-le et modifiez ses métadonnées
(ajoutez par exemple `note` = `console`) ; Stripe envoie alors une
notification.

### La règle des impayés

- Un abonnement **cesse de payer** quand Stripe le dit en retard de paiement,
  impayé, résilié, en pause, ou qu’une de ses factures échoue.
- Son club est **suspendu automatiquement 14 jours après**, s’il n’a pas payé
  entre-temps. Pourquoi 14 jours : Stripe retente lui-même le paiement
  pendant environ deux semaines (réglage par défaut), un virement ou un
  changement de carte peut prendre quelques jours, et cela laisse le temps
  d’en parler avec le club. La date prévue s’affiche sur le tableau de bord et
  la page « Abonnements ». Le délai se règle avec `STRIPE_GRACE_DAYS` dans
  `console.env`.
- **Dès que Stripe le dit de nouveau actif**, un club suspendu par cette règle
  est **réactivé automatiquement**. Un club que vous avez suspendu vous-même
  n’est jamais réactivé par Stripe.
- La règle ne touche qu’aux clubs reliés à un abonnement. Pour garder ouvert
  un club en retard (un arrangement avec lui), **détachez** son abonnement
  (« aucun » dans la liste).
- Chaque suspension et réactivation automatique apparaît dans « Opérations »
  (faite par « règle Stripe ») et dans le journal.

## Plusieurs serveurs

La console peut gérer les clubs d’autres serveurs, par SSH, avec exactement
les mêmes actions.

1. Sur la console, sa clé publique : `sudo cat /var/lib/skycrew-console/.ssh/id_ed25519.pub`.
   Copiez-la dans un fichier `console.pub` sur le nouveau serveur.
2. Sur le nouveau serveur (préparé comme le premier : Docker, nginx, certbot),
   depuis une copie du dépôt :

   ```bash
   sudo console/deploy/install.sh --helper-only --authorized-key console.pub
   ```

   Cela installe l’outil, le kit et un utilisateur `skycrew-console` qui
   n’entre que par cette clé et ne peut lancer que l’outil en administrateur.
3. Sur la console, une fois, pour accepter l’empreinte du nouveau serveur :
   `sudo -u skycrew-console ssh skycrew-console@<adresse du serveur> true`
   (répondez `yes`).
4. Dans `/etc/skycrew-console/console.env`, ajoutez-le à `CONSOLE_SERVERS`,
   par exemple `CONSOLE_SERVERS=tickly-prod=local,serveur2=ssh:skycrew-console@203.0.113.20`,
   puis `sudo systemctl restart skycrew-console` et `sudo skycrew-console check`.

## Sécurité : ce qu’il faut savoir

- La console ne s’ouvre qu’avec votre mot de passe **et** votre téléphone. Si
  quelqu’un apprend votre mot de passe, il ne peut rien faire sans un code du
  téléphone ou un code de secours : changez quand même le mot de passe
  (`set-password`).
- Si quelqu’un avait votre mot de passe **et** votre téléphone (ou vos codes
  de secours), il pourrait faire ce que fait la console : créer, suspendre,
  mettre à jour, changer la formule des clubs. Il ne pourrait **pas** lire les
  données des membres, ni lancer d’autres commandes sur le serveur, ni effacer
  un club ou une sauvegarde : la console ne sait pas le faire. Tout ce qu’il
  ferait serait dans le journal. Dans ce cas : `sudo systemctl stop
  skycrew-console`, puis `reset-2fa` et `set-password`, lisez le journal, et
  relancez.
- Pour plus de sûreté, vous pouvez n’ouvrir la console qu’à vos adresses
  (maison, bureau) : voir les lignes `allow` / `deny` du fichier nginx de la
  console (l’adresse `/stripe/webhook` doit rester ouverte).
- Les sauvegardes de la console : copiez de temps en temps
  `/var/lib/skycrew-console/console.db` ailleurs (il contient votre compte, le
  journal et les abonnements ; aucune donnée de club).

## Ce que l’installation met en place

| Quoi | Où |
| --- | --- |
| La console (propriété de root, la console ne peut pas se modifier) | `/opt/skycrew-console/app/` |
| Ses réglages | `/etc/skycrew-console/console.env` (lisible par la console seule) |
| Son site nginx, à activer | `/etc/skycrew-console/nginx-console.conf` |
| Ses données | `/var/lib/skycrew-console/` (utilisateur `skycrew-console`) |
| Le service | `/etc/systemd/system/skycrew-console.service` |
| La commande | `/usr/local/bin/skycrew-console` |
| L’outil privilégié et ses réglages | `/usr/local/sbin/skycrew-console-helper`, `/etc/skycrew-console/helper.conf` |
| Le kit qu’il utilise | `/usr/local/lib/skycrew-console/kit/` |
| La règle sudo | `/etc/sudoers.d/skycrew-console` |

La règle sudo, en entier :

```
Defaults:skycrew-console !requiretty, env_reset, secure_path="/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin"
skycrew-console ALL=(root) NOPASSWD: /usr/local/sbin/skycrew-console-helper
```

Retirer la console (les clubs ne sont pas touchés) :

```bash
sudo systemctl disable --now skycrew-console
sudo rm /etc/nginx/sites-enabled/skycrew-console.conf && sudo nginx -t && sudo systemctl reload nginx
sudo rm -rf /opt/skycrew-console /etc/skycrew-console /usr/local/lib/skycrew-console /var/lib/skycrew-console \
  /usr/local/sbin/skycrew-console-helper /usr/local/bin/skycrew-console /etc/sudoers.d/skycrew-console \
  /etc/systemd/system/skycrew-console.service
sudo userdel skycrew-console
```

## Pour les développeurs

```bash
cd console
npm ci
npm test            # tests unitaires (validation, TOTP, connexion, CSRF, Stripe, outil, opérations)
npm run typecheck
npm run e2e         # parcours complet contre des clubs jetables en local (Docker), voir test/e2e/run.ts
```

Node 24 lit directement le TypeScript (pas de construction). L’outil
privilégié est `helper/skycrew-console-helper` ; ses règles d’arguments sont
les mêmes que `src/validation.ts`, et les deux sont testées.
