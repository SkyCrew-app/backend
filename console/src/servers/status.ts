// The state of a server and of its clubs, from the lines of
// `clubs-remote.sh status` (through the helper):
//   S <key> <value>          about the server
//   C <slug> <key> <value>   about a club
// The rules that classify a club as OK / À voir / Problème are those of
// deploy/clubs-report.awk (the dashboard of clubs.sh), kept identical.
// Only counts, versions, sizes and states are in these lines: nothing secret,
// nothing personal.

export type Level = 0 | 1 | 2;

export interface ClubStatus {
  server: string;
  slug: string;
  facts: Record<string, string>;
  level: Level;
  reasons: string[];
  containers: string;
  diskKb: number;
}

export interface ServerStatus {
  name: string;
  reachable: boolean;
  error: string | null;
  facts: Record<string, string>;
  clubs: ClubStatus[];
  level: Level;
  reasons: string[];
  fit: number;
  fitMemory: number;
  fitDisk: number;
  averageMemoryMb: number;
  averageDiskMb: number;
  fetchedAt: number;
}

export const parseStatus = (text: string): { server: Record<string, string>; clubs: Map<string, Record<string, string>> } => {
  const server: Record<string, string> = {};
  const clubs = new Map<string, Record<string, string>>();
  for (const line of text.split('\n')) {
    const parts = line.split('\t');
    if (parts[0] === 'S' && parts.length >= 3) server[parts[1]] = parts.slice(2).join(' ');
    else if (parts[0] === 'C' && parts.length >= 4) {
      const facts = clubs.get(parts[1]) ?? {};
      facts[parts[2]] = parts.slice(3).join(' ');
      clubs.set(parts[1], facts);
    }
  }
  return { server, clubs };
};

const num = (value: string | undefined): number => (value === undefined || value === '' ? 0 : Number(value) || 0);

export const evaluateClub = (server: string, slug: string, f: Record<string, string>): ClubStatus => {
  let level: Level = 0;
  const reasons: string[] = [];
  const add = (l: Level, message: string) => {
    reasons.push(message);
    if (l > level) level = l;
  };
  let up = 0;
  const services = ['proxy', 'frontend', 'backend', 'db', 'redis'];
  for (const service of services) {
    const st = f[`svc_${service}`];
    if (!st) {
      add(2, `conteneur ${service} absent`);
      continue;
    }
    const [state, health] = st.split(' ');
    if (state !== 'running') add(2, `${service} arrêté (${state})`);
    else if (health === 'unhealthy') add(2, `${service} en mauvaise santé`);
    else if (health === 'starting') {
      add(1, `${service} en cours de démarrage`);
      up++;
    } else up++;
  }
  const lr = f.local_ready;
  if (lr !== '200') add(2, `ne répond pas sur son port local (${lr === '000' || !lr ? 'aucune réponse' : `code ${lr}`})`);
  const dr = f.domain_ready;
  if (!f.url) add(1, 'PUBLIC_URL vide dans son .env');
  else if (dr !== '200') add(2, `injoignable par son adresse publique (${dr === '000' || !dr ? 'aucune réponse : DNS, nginx ou certificat ?' : `code ${dr}`})`);
  if (f.run_backend && f.env_backend && f.run_backend !== f.env_backend) add(1, `backend : le .env dit ${f.env_backend}, c’est ${f.run_backend} qui tourne`);
  if (f.run_frontend && f.env_frontend && f.run_frontend !== f.env_frontend) add(1, `frontend : le .env dit ${f.env_frontend}, c’est ${f.run_frontend} qui tourne`);
  if (f.backup_installed !== 'yes') add(2, 'aucune sauvegarde installée');
  else if (f.backup_cron !== 'yes') add(1, 'sauvegarde quotidienne non planifiée');
  if (f.backup_age === 'none') add(2, 'aucune sauvegarde trouvée');
  else if (f.backup_age === 'old') add(2, 'dernière sauvegarde de plus de 2 jours');
  else if (f.backup_age === 'stale') add(1, 'dernière sauvegarde de plus de 26 heures');
  if (f.watch_installed !== 'yes') add(1, 'pas de veilleur de panne');
  else {
    if (f.watch_target !== 'yes') add(1, 'veilleur sans webhook ni e-mail : ses alertes ne partent nulle part');
    if (f.watch_named !== 'yes') add(1, 'ses alertes ne nomment pas le club');
    const failures = num(f.watch_failures);
    const threshold = num(f.watch_threshold);
    if (threshold > 0 && failures >= threshold) add(2, `le veilleur le voit en panne depuis ${failures} vérifications`);
  }
  if (/^(1|true|yes)$/i.test(f.suspended ?? '')) add(1, 'suspendu : ses membres voient « service suspendu »');
  if (f.members && f.max_members && num(f.members) >= num(f.max_members)) add(1, `plafond de membres atteint (${f.members}/${f.max_members})`);
  if (f.aircraft && f.max_aircraft && num(f.aircraft) >= num(f.max_aircraft)) add(1, `plafond d’avions atteint (${f.aircraft}/${f.max_aircraft})`);
  if (!f.members && /^running/.test(f.svc_db ?? '')) add(1, 'chiffres d’activité illisibles');
  return { server, slug, facts: f, level, reasons, containers: `${up}/${services.length}`, diskKb: num(f.db_kb) + num(f.uploads_kb) };
};

export const evaluateServer = (
  name: string,
  facts: Record<string, string>,
  clubs: ClubStatus[],
  fetchedAt: number,
  error: string | null = null,
): ServerStatus => {
  const base = { name, facts, clubs, fetchedAt, fit: 0, fitMemory: 0, fitDisk: 0, averageMemoryMb: 0, averageDiskMb: 0 };
  if (error !== null || !facts.hostname) {
    return { ...base, reachable: false, error: error ?? 'aucune réponse', level: 2, reasons: [`injoignable : ${error ?? 'aucune réponse'}`] };
  }
  let level: Level = 0;
  const reasons: string[] = [];
  const add = (l: Level, message: string) => {
    reasons.push(message);
    if (l > level) level = l;
  };
  let nm = 0, sm = 0, nd = 0, sd = 0;
  for (const c of clubs) {
    if (num(c.facts.mem_mb) > 0) { nm++; sm += num(c.facts.mem_mb); }
    if (c.facts.db_kb) { nd++; sd += (num(c.facts.db_kb) + num(c.facts.uploads_kb) + num(c.facts.backups_total_kb)) / 1024; }
  }
  const averageMemoryMb = nm ? sm / nm : 0;
  const averageDiskMb = nd ? sd / nd : 0;
  // A new club is counted at least 600 MB of memory and 2 GB of disk.
  const estMem = Math.max(averageMemoryMb, 600);
  const estDisk = Math.max(averageDiskMb, 2048);
  const total = num(facts.mem_total_mb), avail = num(facts.mem_avail_mb);
  const fitMemory = Math.max(0, Math.floor((avail - Math.max(1024, total * 0.1)) / estMem));
  const dt = num(facts.disk_total_mb), da = num(facts.disk_avail_mb);
  const fitDisk = Math.max(0, Math.floor((da - Math.max(5120, dt * 0.1)) / estDisk));
  const fit = Math.min(fitMemory, fitDisk);
  if (total > 0 && avail < total * 0.1) add(2, 'mémoire presque pleine');
  if (dt > 0 && da < dt * 0.1) add(2, 'disque presque plein');
  if (fit === 0) add(2, 'plus de place pour un club de plus');
  else if (fit <= 2) add(1, `place pour ${fit} club(s) de plus seulement`);
  const cpus = num(facts.cpus), load = num(facts.load1);
  if (cpus > 0 && load / cpus > 0.8) add(1, `processeurs chargés (charge ${load} pour ${cpus})`);
  return { ...base, reachable: true, error: null, level, reasons, fit, fitMemory, fitDisk, averageMemoryMb, averageDiskMb };
};
