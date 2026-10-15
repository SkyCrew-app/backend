# Report of clubs.sh status, from the lines gathered on the servers:
#   <host> S <key> <value>          about a server
#   <host> C <slug> <key> <value>   about a club
# mode=term prints a table for the terminal, mode=html a dashboard in one
# self-contained file. Run with LC_ALL=C (widths are counted by hand).
# Only counts, versions, sizes and states are in the input: nothing secret.

function add(i, level, message) {
  why[i] = why[i] (why[i] == "" ? "" : " ; ") message
  if (level > lvl[i]) lvl[i] = level
}
function sadd(h, level, message) {
  swhy[h] = swhy[h] (swhy[h] == "" ? "" : " ; ") message
  if (level > slvl[h]) slvl[h] = level
}
function v(i, key) { return V[ch[i], cs[i], key] }
function max(a, b) { return a > b ? a : b }
function min(a, b) { return a < b ? a : b }

function size_kb(n) {
  if (n == "") return "?"
  n += 0
  if (n < 1024) return sprintf("%d Ko", n)
  if (n < 1048576) return sprintf("%d Mo", n / 1024 + 0.5)
  return comma(sprintf("%.1f Go", n / 1048576))
}
function size_mb(n) {
  if (n == "") return "?"
  n += 0
  if (n < 1024) return sprintf("%d Mo", n)
  return comma(sprintf("%.1f Go", n / 1024))
}
function alert_text(s) { sub(/ down$/, " panne", s); sub(/ up$/, " retour", s); return s }
# "2026-10-15 03:40 ..." -> "15/10 03:40 ..."
function fr_date(s) { if (s ~ /^[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9] /) s = substr(s, 9, 2) "/" substr(s, 6, 2) substr(s, 11); return s }
function comma(s) { sub(/\./, ",", s); return s }
function host_of(url) { sub(/^[a-z]+:\/\//, "", url); sub(/\/.*$/, "", url); return url }

function eval_club(i,    n, list, s, st, a, up, eb, rb, ef, rf, url, dr, lr, age, m, mm, ac, ma, f, t) {
  lvl[i] = 0; why[i] = ""
  n = split("proxy frontend backend db redis", list, " ")
  up = 0
  for (s = 1; s <= n; s++) {
    st = v(i, "svc_" list[s])
    if (st == "") { add(i, 2, "conteneur " list[s] " absent"); continue }
    split(st, a, " ")
    if (a[1] != "running") add(i, 2, list[s] " arrêté (" a[1] ")")
    else if (a[2] == "unhealthy") add(i, 2, list[s] " en mauvaise santé")
    else if (a[2] == "starting") { add(i, 1, list[s] " en cours de démarrage"); up++ }
    else up++
  }
  containers[i] = up "/" n
  lr = v(i, "local_ready")
  if (lr != "200") add(i, 2, "ne répond pas sur son port local (" (lr == "000" ? "aucune réponse" : "code " lr) ")")
  url = v(i, "url"); dr = v(i, "domain_ready")
  if (url == "") add(i, 1, "PUBLIC_URL vide dans son .env")
  else if (dr != "200") add(i, 2, "injoignable par son adresse publique (" (dr == "000" || dr == "" ? "aucune réponse : DNS, nginx ou certificat ?" : "code " dr) ")")
  eb = v(i, "env_backend"); rb = v(i, "run_backend"); ef = v(i, "env_frontend"); rf = v(i, "run_frontend")
  if (rb != "" && eb != "" && rb != eb) add(i, 1, "backend : le .env dit " eb ", c’est " rb " qui tourne")
  if (rf != "" && ef != "" && rf != ef) add(i, 1, "frontend : le .env dit " ef ", c’est " rf " qui tourne")
  if (v(i, "backup_installed") != "yes") add(i, 2, "aucune sauvegarde installée")
  else if (v(i, "backup_cron") != "yes") add(i, 1, "sauvegarde quotidienne non planifiée")
  age = v(i, "backup_age")
  if (age == "none") add(i, 2, "aucune sauvegarde trouvée")
  else if (age == "old") add(i, 2, "dernière sauvegarde de plus de 2 jours")
  else if (age == "stale") add(i, 1, "dernière sauvegarde de plus de 26 heures")
  if (v(i, "watch_installed") != "yes") add(i, 1, "pas de veilleur de panne")
  else {
    if (v(i, "watch_target") != "yes") add(i, 1, "veilleur sans webhook ni e-mail : ses alertes ne partent nulle part")
    if (v(i, "watch_named") != "yes") add(i, 1, "ses alertes ne nomment pas le club")
    f = v(i, "watch_failures") + 0; t = v(i, "watch_threshold") + 0
    if (t > 0 && f >= t) add(i, 2, "le veilleur le voit en panne depuis " f " vérifications")
  }
  if (v(i, "suspended") ~ /^(1|true|yes)$/) add(i, 1, "suspendu : ses membres voient « service suspendu »")
  m = v(i, "members"); mm = v(i, "max_members"); ac = v(i, "aircraft"); ma = v(i, "max_aircraft")
  if (m != "" && mm != "" && m + 0 >= mm + 0) add(i, 1, "plafond de membres atteint (" m "/" mm ")")
  if (ac != "" && ma != "" && ac + 0 >= ma + 0) add(i, 1, "plafond d’avions atteint (" ac "/" ma ")")
  if (m == "" && v(i, "svc_db") ~ /^running/) add(i, 1, "chiffres d’activité illisibles")
  disk_kb[i] = v(i, "db_kb") + v(i, "uploads_kb")
}

function eval_server(h,    i, n, nm, sm, nd, sd, total, avail, reserve, dt, da, dres, cpus, load) {
  slvl[h] = 0; swhy[h] = ""
  if (S[h, "unreachable"] != "" || S[h, "hostname"] == "") {
    sadd(h, 2, "injoignable : " (S[h, "unreachable"] == "" ? "aucune réponse" : S[h, "unreachable"]))
    reachable[h] = 0
    return
  }
  reachable[h] = 1
  n = nm = sm = nd = sd = 0
  for (i = 1; i <= nc; i++) {
    if (ch[i] != h) continue
    n++
    if (v(i, "mem_mb") + 0 > 0) { nm++; sm += v(i, "mem_mb") }
    if (v(i, "db_kb") != "") { nd++; sd += (v(i, "db_kb") + v(i, "uploads_kb") + v(i, "backups_total_kb")) / 1024 }
  }
  nclubs[h] = n
  avg_mem[h] = nm ? sm / nm : 0
  avg_disk[h] = nd ? sd / nd : 0
  # A new club is counted at least 600 MB of memory and 2 GB of disk.
  est_mem[h] = max(avg_mem[h], 600)
  est_disk[h] = max(avg_disk[h], 2048)
  total = S[h, "mem_total_mb"] + 0; avail = S[h, "mem_avail_mb"] + 0
  reserve = max(1024, total * 0.10)
  fit_mem[h] = max(0, int((avail - reserve) / est_mem[h]))
  dt = S[h, "disk_total_mb"] + 0; da = S[h, "disk_avail_mb"] + 0
  dres = max(5120, dt * 0.10)
  fit_disk[h] = max(0, int((da - dres) / est_disk[h]))
  fit[h] = min(fit_mem[h], fit_disk[h])
  if (total > 0 && avail < total * 0.10) sadd(h, 2, "mémoire presque pleine")
  if (dt > 0 && da < dt * 0.10) sadd(h, 2, "disque presque plein")
  if (fit[h] == 0) sadd(h, 2, "plus de place pour un club de plus")
  else if (fit[h] <= 2) sadd(h, 1, "place pour " fit[h] " club(s) de plus seulement")
  cpus = S[h, "cpus"] + 0; load = S[h, "load1"] + 0
  if (cpus > 0 && load / cpus > 0.8) sadd(h, 1, "processeurs chargés (charge " load " pour " cpus ")")
}

# --- terminal -------------------------------------------------------------------
function width(s,    t) { t = s; gsub(CONT, "", t); return length(t) }
function pad(s, w) {
  if (width(s) > w && s !~ CONT) s = substr(s, 1, w - 1) "~"
  while (width(s) < w) s = s " "
  return s
}
function paint(level, s) {
  if (!color) return s
  return sprintf("\033[%sm%s\033[0m", level == 2 ? "31" : level == 1 ? "33" : "32", s)
}
function label(level) { return level == 2 ? "PROBLÈME" : level == 1 ? "à voir" : "ok" }
function okko(code) { return code == "200" ? "ok" : code == "" ? "?" : "KO" }

function term(    k, h, i, cols, n, c, line, plan, b, alert, total, worst) {
  printf "SkyCrew : état des clubs, relevé le %s\n", now
  for (k = 1; k <= nh; k++) {
    h = hosts[k]
    printf "\n%s %s", paint(slvl[h], "[" label(slvl[h]) "]"), "Serveur " h
    if (!reachable[h]) { printf "\n  %s\n", swhy[h]; continue }
    printf " (%s, relevé à %s)\n", S[h, "hostname"], S[h, "time"]
    printf "  Mémoire : %s libres sur %s%s · Processeurs : %s (charge %s) · Disque : %s libres sur %s\n",
      size_mb(S[h, "mem_avail_mb"]), size_mb(S[h, "mem_total_mb"]),
      (S[h, "mem_source"] == "docker" ? " (machine Docker)" : ""),
      S[h, "cpus"], S[h, "load1"], size_mb(S[h, "disk_avail_mb"]), size_mb(S[h, "disk_total_mb"])
    printf "  %d club(s), en moyenne %s de mémoire et %s de données (sauvegardes comprises) chacun\n",
      nclubs[h], size_mb(int(avg_mem[h])), size_mb(int(avg_disk[h]))
    printf "  Place pour environ %d club(s) de plus (d’après la mémoire : %d, d’après le disque : %d)\n",
      fit[h], fit_mem[h], fit_disk[h]
    if (swhy[h] != "") printf "  %s\n", paint(slvl[h], swhy[h])
  }
  if (nc == 0) { print "\nAucun club trouvé."; return }

  n = split("8 12 14 24 9 15 6 8 18 9 8 8 7 7 24", cols, " ")
  line = pad("ÉTAT", cols[1]) " " pad("SERVEUR", cols[2]) " " pad("CLUB", cols[3]) " " pad("ADRESSE", cols[4]) " " \
    pad("FORMULE", cols[5]) " " pad("VERSIONS B/F", cols[6]) " " pad("CONT.", cols[7]) " " pad("PORT/WEB", cols[8]) " " \
    pad("SAUVEGARDE", cols[9]) " " pad("DONNÉES", cols[10]) " " pad("MÉMOIRE", cols[11]) " " pad("MEMBRES", cols[12]) " " \
    pad("AVIONS", cols[13]) " " pad("RÉSA30J", cols[14]) " " pad("VEILLEUR", cols[15])
  printf "\n%s\n", line
  for (i = 1; i <= nc; i++) {
    plan = v(i, "plan"); if (plan == "") plan = "complète"
    b = v(i, "backup_last") == "" ? "aucune" : substr(v(i, "backup_last"), 6) " " size_kb(v(i, "backup_db_kb"))
    alert = v(i, "watch_installed") != "yes" ? "absent" : v(i, "watch_last") == "" ? "oui, 0 alerte" : "oui, " alert_text(substr(v(i, "watch_last"), 6))
    line = pad(label(lvl[i]), cols[1]) " " pad(ch[i], cols[2]) " " pad(cs[i], cols[3]) " " pad(host_of(v(i, "url")), cols[4]) " " \
      pad(plan, cols[5]) " " pad(v(i, "run_backend") "/" v(i, "run_frontend"), cols[6]) " " pad(containers[i], cols[7]) " " \
      pad(okko(v(i, "local_ready")) "/" okko(v(i, "domain_ready")), cols[8]) " " pad(b, cols[9]) " " \
      pad(size_kb(disk_kb[i]), cols[10]) " " pad(size_mb(v(i, "mem_mb")), cols[11]) " " \
      pad(v(i, "members") (v(i, "max_members") == "" ? "" : "/" v(i, "max_members")), cols[12]) " " \
      pad(v(i, "aircraft") (v(i, "max_aircraft") == "" ? "" : "/" v(i, "max_aircraft")), cols[13]) " " \
      pad(v(i, "bookings30"), cols[14]) " " pad(alert, cols[15])
    if (color) line = paint(lvl[i], pad(label(lvl[i]), cols[1])) substr(line, length(pad(label(lvl[i]), cols[1])) + 1)
    print line
  }
  worst = 0
  for (i = 1; i <= nc; i++) if (why[i] != "") {
    if (!worst) { print "\nÀ regarder :"; worst = 1 }
    printf "  %s %s : %s\n", paint(lvl[i], lvl[i] == 2 ? "x" : "!"), cs[i] " (" ch[i] ")", why[i]
  }
  total = 0; for (i = 1; i <= nc; i++) if (lvl[i] == 0) total++
  printf "\n%d club(s) sur %d sans rien à signaler.\n", total, nc
}

# --- HTML -----------------------------------------------------------------------
function esc(s) {
  gsub(/&/, "\\&amp;", s); gsub(/</, "\\&lt;", s); gsub(/>/, "\\&gt;", s); gsub(/"/, "\\&quot;", s)
  return s
}
function pill(level) {
  return "<span class=\"pill l" level "\"><span aria-hidden=\"true\">" (level == 2 ? "✕" : level == 1 ? "▲" : "●") \
    "</span> " (level == 2 ? "Problème" : level == 1 ? "À voir" : "OK") "</span>"
}
function td(value, sortkey) {
  return "<td" (sortkey == "" ? "" : " data-v=\"" esc(sortkey) "\"") ">" value "</td>"
}
function health(code) {
  if (code == "200") return "<span class=\"ok\">répond</span>"
  return "<span class=\"ko\">" (code == "000" || code == "" ? "aucune réponse" : "code " esc(code)) "</span>"
}

function html(    k, h, i, n0, n1, n2, plan, b, w, url, alerts, list) {
  n0 = n1 = n2 = 0
  for (i = 1; i <= nc; i++) { if (lvl[i] == 2) n2++; else if (lvl[i] == 1) n1++; else n0++ }
  print "<!doctype html>"
  print "<html lang=\"fr\"><head><meta charset=\"utf-8\">"
  print "<meta name=\"viewport\" content=\"width=device-width, initial-scale=1\">"
  print "<title>Clubs SkyCrew</title>"
  print "<style>"
  print ":root{--bg:#f7f7f5;--surface:#fff;--ink:#1a1a19;--muted:#5c5c58;--line:#e2e1dc;--good:#0ca30c;--warn:#b77700;--bad:#d03b3b;--good-bg:#e7f6e7;--warn-bg:#fdf3dc;--bad-bg:#fbe9e9;color-scheme:light}"
  print "@media (prefers-color-scheme:dark){:root:not([data-theme=light]){--bg:#121211;--surface:#1a1a19;--ink:#ededea;--muted:#a3a39e;--line:#33332f;--good:#3fc23f;--warn:#fab219;--bad:#ef6b6b;--good-bg:#173317;--warn-bg:#3a2d0c;--bad-bg:#3d1a1a;color-scheme:dark}}"
  print "*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font:14px/1.45 system-ui,-apple-system,\"Segoe UI\",Roboto,sans-serif}"
  print "main{max-width:1800px;margin:0 auto;padding:24px 16px 48px}h1{font-size:22px;margin:0 0 4px}h2{font-size:16px;margin:28px 0 10px}"
  print ".sub{color:var(--muted);margin:0}.counts{display:flex;gap:8px;flex-wrap:wrap;margin:12px 0 0}"
  print ".pill{display:inline-flex;align-items:center;gap:4px;padding:1px 8px;border-radius:999px;font-weight:600;font-size:12px;white-space:nowrap;border:1px solid transparent}"
  print ".l0{color:var(--good);background:var(--good-bg)}.l1{color:var(--warn);background:var(--warn-bg)}.l2{color:var(--bad);background:var(--bad-bg)}"
  print ".servers{display:grid;grid-template-columns:repeat(auto-fill,minmax(320px,1fr));gap:12px}"
  print ".card{background:var(--surface);border:1px solid var(--line);border-radius:10px;padding:14px 16px}.card h3{margin:0 0 8px;font-size:15px;display:flex;justify-content:space-between;gap:8px;align-items:center}"
  print ".card dl{display:grid;grid-template-columns:auto 1fr;gap:2px 12px;margin:0}.card dt{color:var(--muted)}.card dd{margin:0;font-variant-numeric:tabular-nums}"
  print ".fit{font-size:28px;font-weight:700;margin:8px 0 0;font-variant-numeric:tabular-nums}.fit small{font-size:13px;font-weight:400;color:var(--muted)}"
  print ".issues{margin:8px 0 0;color:var(--muted)}"
  print ".wrap{overflow-x:auto;background:var(--surface);border:1px solid var(--line);border-radius:10px}"
  print "table{border-collapse:collapse;width:100%;font-size:13px;font-variant-numeric:tabular-nums}th,td{padding:7px 10px;text-align:left;border-bottom:1px solid var(--line);vertical-align:top}"
  print "tbody tr:last-child td{border-bottom:0}th{position:sticky;top:0;background:var(--surface);font-size:12px;color:var(--muted);font-weight:600;white-space:nowrap}"
  print "th button{all:unset;cursor:pointer}th button:focus-visible{outline:2px solid var(--ink);outline-offset:2px}th[aria-sort=ascending] button::after{content:\" ↑\"}th[aria-sort=descending] button::after{content:\" ↓\"}"
  print "td{white-space:nowrap}td.num,th.num{text-align:right}.warn{color:var(--warn)}.why ul{margin:0;padding-left:16px}.why li{margin:0 0 2px}.ok{color:var(--good)}.ko{color:var(--bad);font-weight:600}.muted{color:var(--muted)}td.why{white-space:normal;min-width:260px;max-width:380px}"
  print "details{margin-top:24px;background:var(--surface);border:1px solid var(--line);border-radius:10px;padding:12px 16px}summary{cursor:pointer;font-weight:600}"
  print "footer{margin-top:24px;color:var(--muted);font-size:12px}"
  print "</style></head><body><main>"
  print "<h1>Clubs SkyCrew</h1>"
  printf "<p class=\"sub\">Relevé le %s · %d club(s) sur %d serveur(s)</p>\n", esc(now), nc, nh
  printf "<div class=\"counts\">%s %d &nbsp; %s %d &nbsp; %s %d</div>\n", pill(0), n0, pill(1), n1, pill(2), n2

  print "<h2>Serveurs</h2><div class=\"servers\">"
  for (k = 1; k <= nh; k++) {
    h = hosts[k]
    printf "<section class=\"card\"><h3><span>%s</span>%s</h3>\n", esc(h), pill(slvl[h])
    if (!reachable[h]) { printf "<p class=\"issues\">%s</p></section>\n", esc(swhy[h]); continue }
    print "<dl>"
    printf "<dt>Machine</dt><dd>%s, relevé à %s</dd>\n", esc(S[h, "hostname"]), esc(S[h, "time"])
    printf "<dt>Mémoire libre</dt><dd>%s sur %s%s</dd>\n", size_mb(S[h, "mem_avail_mb"]), size_mb(S[h, "mem_total_mb"]), (S[h, "mem_source"] == "docker" ? " (machine Docker)" : "")
    printf "<dt>Processeurs</dt><dd>%s, charge %s</dd>\n", esc(S[h, "cpus"]), esc(S[h, "load1"])
    printf "<dt>Disque libre</dt><dd>%s sur %s</dd>\n", size_mb(S[h, "disk_avail_mb"]), size_mb(S[h, "disk_total_mb"])
    printf "<dt>Clubs</dt><dd>%d, en moyenne %s de mémoire et %s de données chacun</dd>\n", nclubs[h], size_mb(int(avg_mem[h])), size_mb(int(avg_disk[h]))
    print "</dl>"
    printf "<p class=\"fit\">≈ %d <small>club(s) de plus (mémoire : %d, disque : %d)</small></p>\n", fit[h], fit_mem[h], fit_disk[h]
    if (swhy[h] != "") printf "<p class=\"issues\">%s</p>\n", esc(swhy[h])
    print "</section>"
  }
  print "</div>"

  print "<h2>Clubs</h2><div class=\"wrap\"><table id=\"clubs\"><thead><tr>"
  print "<th data-type=\"num\"><button>État</button></th><th><button>Club</button></th><th><button>À regarder</button></th><th><button>Formule</button></th><th><button>Versions</button></th><th><button>Conteneurs</button></th><th><button>Réponse</button></th><th><button>Sauvegarde</button></th><th><button>Veilleur</button></th><th class=\"num\" data-type=\"num\"><button>Données</button></th><th class=\"num\" data-type=\"num\"><button>Mémoire</button></th><th class=\"num\" data-type=\"num\"><button>Membres</button></th><th class=\"num\" data-type=\"num\"><button>Avions</button></th><th class=\"num\" data-type=\"num\"><button>Résa. 30 j</button></th>"
  print "</tr></thead><tbody>"
  for (i = 1; i <= nc; i++) {
    plan = v(i, "plan"); if (plan == "") plan = "complète"; else if (plan == "ecole") plan = "école"
    url = v(i, "url")
    b = v(i, "backup_last") == "" ? "<span class=\"ko\">aucune</span>" : esc(fr_date(v(i, "backup_last"))) "<br><span class=\"muted\">base " size_kb(v(i, "backup_db_kb")) "</span>"
    if (v(i, "watch_installed") != "yes") w = "<span class=\"ko\">absent</span>"
    else {
      alerts = v(i, "watch_last")
      w = (v(i, "watch_target") == "yes" ? "installé" : "<span class=\"ko\">sans destinataire</span>") \
        (v(i, "watch_named") == "yes" ? "" : "<br><span class=\"warn\">alertes sans nom du club</span>") \
        "<br><span class=\"muted\">" (alerts == "" ? "aucune alerte" : esc(alert_text(fr_date(alerts)))) "</span>"
    }
    list = why[i]; gsub(/ ; /, "</li><li>", list)
    print "<tr>" td(pill(lvl[i]), lvl[i]) \
      td("<strong>" esc(cs[i]) "</strong><br><span class=\"muted\">" (url == "" ? "adresse vide" : esc(host_of(url))) "<br>serveur " esc(ch[i]) "</span>", cs[i]) \
      "<td class=\"why\">" (why[i] == "" ? "<span class=\"muted\">rien</span>" : "<ul><li>" list "</li></ul>") "</td>" \
      td(esc(plan) (v(i, "max_members") v(i, "max_aircraft") == "" ? "" : "<br><span class=\"muted\">" \
        (v(i, "max_members") == "" ? "" : esc(v(i, "max_members")) " membres ") \
        (v(i, "max_aircraft") == "" ? "" : esc(v(i, "max_aircraft")) " avions") "</span>")) \
      td("<span class=\"muted\">API</span> " esc(v(i, "run_backend")) "<br><span class=\"muted\">web</span> " esc(v(i, "run_frontend"))) \
      td(esc(containers[i])) \
      td("<span class=\"muted\">port " esc(v(i, "port")) "</span> " health(v(i, "local_ready")) "<br><span class=\"muted\">adresse</span> " health(v(i, "domain_ready"))) \
      td(b, v(i, "backup_last")) td(w) \
      "<td class=\"num\" data-v=\"" (disk_kb[i] + 0) "\">" size_kb(disk_kb[i]) "</td>" \
      "<td class=\"num\" data-v=\"" (v(i, "mem_mb") + 0) "\">" size_mb(v(i, "mem_mb")) "</td>" \
      "<td class=\"num\" data-v=\"" (v(i, "members") + 0) "\">" esc(v(i, "members")) (v(i, "max_members") == "" ? "" : "<span class=\"muted\"> / " esc(v(i, "max_members")) "</span>") "</td>" \
      "<td class=\"num\" data-v=\"" (v(i, "aircraft") + 0) "\">" esc(v(i, "aircraft")) (v(i, "max_aircraft") == "" ? "" : "<span class=\"muted\"> / " esc(v(i, "max_aircraft")) "</span>") "</td>" \
      "<td class=\"num\" data-v=\"" (v(i, "bookings30") + 0) "\">" esc(v(i, "bookings30")) "</td></tr>"
  }
  print "</tbody></table></div>"

  print "<details><summary>Comment lire ce tableau</summary>"
  print "<p><strong>État</strong> : <em>Problème</em> quand un conteneur est arrêté ou en mauvaise santé, que le club ne répond pas (sur son port local ou à son adresse publique), qu’il n’a pas de sauvegarde de moins de 2 jours, ou que son veilleur le voit en panne. <em>À voir</em> pour une sauvegarde de plus de 26 heures, un veilleur absent ou sans destinataire, des alertes qui ne nomment pas le club, un plafond de la formule atteint, ou des versions du .env qui ne sont pas celles qui tournent.</p>"
  print "<p><strong>Données</strong> : base de données et fichiers envoyés (licences, documents, photos), sans les sauvegardes. <strong>Mémoire</strong> : celle qu’utilisent en ce moment les cinq conteneurs du club. <strong>Membres</strong> : comptes actifs ; <strong>Avions</strong> : avions en service ; <strong>Résa. 30 j</strong> : réservations non annulées des 30 derniers jours. Seuls des nombres sont lus dans la base, jamais de nom ni d’adresse.</p>"
  print "<p><strong>Place pour d’autres clubs</strong> : la mémoire libre du serveur, moins une marge pour le reste du serveur (1 Go ou 10 % de la mémoire, le plus grand des deux), divisée par la mémoire moyenne d’un club de ce serveur (au moins 600 Mo) ; de même pour le disque, avec une marge de 5 Go ou 10 % et au moins 2 Go par club (données et sauvegardes). Le plus petit des deux nombres est retenu. C’est un ordre de grandeur pour des clubs de taille moyenne, mesuré à un instant : un club très actif compte double. Chaque club est plafonné à environ 3,2 Go de mémoire au pire.</p>"
  print "</details>"
  print "<footer>Généré par deploy/clubs.sh status --html. Ce fichier ne contient ni mot de passe, ni clé, ni adresse de webhook.</footer>"
  print "</main><script>"
  print "(function(){var t=document.getElementById('clubs');if(!t)return;var hs=t.tHead.rows[0].cells;"
  print "function key(c,num){var v=c.getAttribute('data-v');if(v===null)v=c.textContent.trim();if(num){var n=parseFloat(v);return isNaN(n)?-1:n}return v.toLowerCase()}"
  print "Array.prototype.forEach.call(hs,function(th,i){th.querySelector('button').addEventListener('click',function(){"
  print "var num=th.getAttribute('data-type')==='num';var dir=th.getAttribute('aria-sort')==='ascending'?-1:1;"
  print "Array.prototype.forEach.call(hs,function(o){o.removeAttribute('aria-sort')});th.setAttribute('aria-sort',dir===1?'ascending':'descending');"
  print "var b=t.tBodies[0];var rows=Array.prototype.slice.call(b.rows);rows.sort(function(x,y){var a=key(x.cells[i],num),c=key(y.cells[i],num);return (a<c?-1:a>c?1:0)*dir});"
  print "rows.forEach(function(r){b.appendChild(r)})})})})();"
  print "</script></body></html>"
}

BEGIN { FS = "\t"; CONT = "[\200-\277]" }
{
  h = $1
  if (!(h in hseen)) { hseen[h] = 1; hosts[++nh] = h }
  if ($2 == "S") { S[h, $3] = $4; next }
  if ($2 == "C") {
    if (!((h, $3) in cseen)) { cseen[h, $3] = 1; nc++; ch[nc] = h; cs[nc] = $3 }
    V[h, $3, $4] = $5
  }
}
END {
  for (i = 1; i <= nc; i++) eval_club(i)
  for (k = 1; k <= nh; k++) eval_server(hosts[k])
  if (mode == "html") html(); else term()
}
