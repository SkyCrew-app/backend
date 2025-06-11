#!/usr/bin/env bash
# deploy-k8s.sh – Déploiement Kubernetes local (Minikube) avec Ingress + port-forward fiable
# Usage: ./deploy-k8s.sh [--dev|--prod] [--reset] [-h|--help]

set -euo pipefail
IFS=$'\n\t'

### Couleurs & logs ###
RESET="\033[0m"; RED="\033[0;31m"; GREEN="\033[0;32m"; YELLOW="\033[0;33m"; BLUE="\033[0;34m"
info()    { echo -e "${BLUE}⏳ $*${RESET}"; }
success() { echo -e "${GREEN}✅ $*${RESET}"; }
error()   { echo -e "${RED}❌ $*${RESET}"; }

### Aide ###
usage() {
  cat <<EOF
Usage: $0 [--dev|--prod] [--reset] [-h|--help]

  --dev       Mode développement (par défaut)
  --prod      Mode production
  --reset     Supprime toutes les ressources avant déploiement
  -h, --help  Affiche cet écran d'aide
EOF
}

### Args ###
MODE="dev"; RESET_ALL=false
while [[ $# -gt 0 ]]; do
  case "$1" in
    --dev)   MODE="dev";  shift ;;
    --prod)  MODE="prod"; shift ;;
    --reset) RESET_ALL=true; shift ;;
    -h|--help) usage; exit 0 ;;
    *) error "Option inconnue : $1"; usage; exit 1 ;;
  esac
done

### Vars ###
NAMESPACE="$MODE"
MANIFEST_DIR="k8s/${MODE}"
RELEASE_PG="fullstack-postgres"
RELEASE_RD="fullstack-redis"
POSTGRES_HOST="${RELEASE_PG}-postgresql"
INGRESS_NS="ingress-nginx"
INGRESS_SVC="ingress-nginx-controller"
INGRESS_PORT=8080    # **toujours** non-privilégié

info "Mode de déploiement: ${MODE}${RESET_ALL:+ (avec --reset)}"

### Pré-reqs ###
for cmd in minikube kubectl helm docker; do
  if ! command -v "$cmd" &>/dev/null; then
    error "L’outil '$cmd' est introuvable."; exit 1
  fi
done

### Minikube up ###
if ! minikube status --format '{{.Host}}' | grep -q Running; then
  info "Démarrage de Minikube…"
  minikube start
  success "Minikube démarré."
fi

### Docker-env & Build ###
info "🔨 Configuration Docker-env Minikube…"
eval "$(minikube -p minikube docker-env)"
success "Daemon Docker configuré."

info "📦 Build des images backend & frontend…"
docker build -t backend:latest ./
docker build -t frontend:latest ../frontend/
success "Images Docker prêtes."

### .env & Secrets ###
if [ ! -f .env ]; then error ".env introuvable."; exit 1; fi
info "Chargement des variables d’environnement…"
set -a; source .env; set +a
success "Variables chargées."

cleanup() {
  info "Suppression des ressources…"
  helm uninstall "$RELEASE_PG" --namespace "$NAMESPACE" || true
  helm uninstall "$RELEASE_RD" --namespace "$NAMESPACE" || true
  kubectl delete secret fullstack-env frontend-env -n "$NAMESPACE" --ignore-not-found || true
  kubectl delete pvc -l app.kubernetes.io/instance=postgresql -n "$NAMESPACE" --ignore-not-found || true
  kubectl delete -R -f "$MANIFEST_DIR/" -n "$NAMESPACE" --ignore-not-found || true
  kubectl delete ingress skycrew-ingress -n "$NAMESPACE" --ignore-not-found || true
  minikube addons disable ingress >/dev/null 2>&1 || true
  success "Nettoyage effectué."
}
trap 'error "Interrompu."; cleanup; exit 1' SIGINT SIGTERM

### Namespace ###
if ! kubectl get ns "$NAMESPACE" &>/dev/null; then
  info "Création du namespace '$NAMESPACE'…"
  kubectl create namespace "$NAMESPACE"
  success "Namespace '$NAMESPACE' créé."
fi
$RESET_ALL && cleanup

### Secrets fullstack-env ###
info "Création du secret fullstack-env…"
TMP=".env-with-host"
cp .env "$TMP"
grep -v '^DB_HOST=' "$TMP" >"$TMP.tmp" && mv "$TMP.tmp" "$TMP"
echo "DB_HOST=$POSTGRES_HOST" >>"$TMP"
kubectl create secret generic fullstack-env -n "$NAMESPACE" \
  --from-env-file="$TMP" --dry-run=client -o yaml \
  | kubectl apply -f - >/dev/null
rm "$TMP"
success "Secret fullstack-env OK."

### Secret frontend-env ###
info "Création du secret frontend-env…"
kubectl create secret generic frontend-env -n "$NAMESPACE" \
  --from-env-file=../frontend/.env.local --dry-run=client -o yaml \
  | kubectl apply -f - >/dev/null
success "Secret frontend-env OK."

### Helm PostgreSQL ###
info "Déploiement PostgreSQL…"
helm repo add bitnami https://charts.bitnami.com/bitnami >/dev/null 2>&1 || true
helm repo update >/dev/null 2>&1
helm uninstall "$RELEASE_PG" -n "$NAMESPACE" || true
helm install "$RELEASE_PG" bitnami/postgresql -n "$NAMESPACE" \
  --set auth.username="$DB_USER",auth.password="$DB_PASSWORD",auth.database="$DB_NAME" \
  --wait
success "PostgreSQL déployé."

### Helm Redis ###
info "Déploiement Redis…"
helm uninstall "$RELEASE_RD" -n "$NAMESPACE" || true
helm install "$RELEASE_RD" bitnami/redis -n "$NAMESPACE" \
  --set auth.password="$REDIS_PASSWORD" \
  --wait
success "Redis déployé."

### Manifests & PGAdmin ###
info "Application des manifests…"
kubectl apply -R -f "$MANIFEST_DIR/" -n "$NAMESPACE"
success "Manifests appliqués."

info "Déploiement PGAdmin…"
kubectl -n "$NAMESPACE" delete secret pgadmin-credentials --ignore-not-found || true
kubectl -n "$NAMESPACE" create secret generic pgadmin-credentials \
  --from-literal=PGADMIN_DEFAULT_EMAIL=admin@skycrew.fr \
  --from-literal=PGADMIN_DEFAULT_PASSWORD=Admin1234
kubectl apply -f k8s/"$MODE"/pgadmin.yaml -n "$NAMESPACE"
success "PGAdmin opérationnel."

### Attente des pods ###
info "Attente pods backend & frontend Ready…"
kubectl wait pod -l app=backend  --for=condition=Ready --timeout=300s -n "$NAMESPACE"
kubectl wait pod -l app=frontend --for=condition=Ready --timeout=300s -n "$NAMESPACE"
success "Pods Ready."

### Ingress & port-forward ###
info "Activation de l’add-on Ingress…"
minikube addons enable ingress >/dev/null 2>&1 || true
info "Attente du controller Nginx Ingress…"
kubectl rollout status deployment/"$INGRESS_SVC" -n "$INGRESS_NS" --timeout=180s

# Tunnel Ingress sur le port 8080
info "Mise en place du tunnel Ingress → localhost:${INGRESS_PORT}…"
kubectl port-forward --address 0.0.0.0 \
  svc/"$INGRESS_SVC" ${INGRESS_PORT}:80 \
  -n "$INGRESS_NS" >/dev/null 2>&1 &
INGRESS_PID=$!
sleep 1
if kill -0 $INGRESS_PID 2>/dev/null; then
  success "Tunnel Ingress prêt : http://localhost:${INGRESS_PORT}"
else
  error "Échec tunnel Ingress sur ${INGRESS_PORT}"
  exit 1
fi

### Tunnels services (Docker) ###
DRIVER=$(minikube profile list | awk '/minikube/ {print $2}')
if [ "$DRIVER" = "docker" ]; then
  for svc in frontend backend mailhog; do
    case "$svc" in
      frontend) LP=5173 RP=5173 ;;
      backend)  LP=3000 RP=3000 ;;
      mailhog)  LP=8025 RP=8025 ;;
    esac
    info "Tunnel $svc → localhost:${LP}…"
    kubectl port-forward svc/"$svc" ${LP}:${RP} -n "$NAMESPACE" >/dev/null 2>&1 &
    pid=$!; sleep 1
    if kill -0 $pid 2>/dev/null; then
      success "→ http://localhost:${LP}"
    else
      error "Échec tunnel $svc"
    fi
  done
fi

### Fin ###
echo
echo -e "${GREEN}🚀 Déploiement terminé !${RESET}"
echo "• Pense à ajouter dans /etc/hosts :"
echo "    127.0.0.1 api.skycrew.local club1.skycrew.local club2.skycrew.local pgadmin.skycrew.local"
echo "• Accède à tes apps ici :"
echo "    http://api.skycrew.local:${INGRESS_PORT}"
echo "    http://club1.skycrew.local:${INGRESS_PORT}"
echo "    http://club2.skycrew.local:${INGRESS_PORT}"
echo "    http://pgadmin.skycrew.local:${INGRESS_PORT}"
echo

# On garde le script en vie tant que le tunnel Ingress tourne
info "Appuie sur Ctrl+C pour stopper les tunnels et quitter."
wait $INGRESS_PID