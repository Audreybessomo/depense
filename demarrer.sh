#!/usr/bin/env bash
#
# Démarre l'application complète — base de données comprise — en une commande.
#
#   ./demarrer.sh
#
# Au premier lancement : génère les secrets, construit l'image, applique les
# migrations, crée le compte administrateur et affiche ses identifiants.
# Aux lancements suivants : redémarre simplement, sans rien recréer.

set -euo pipefail
cd "$(dirname "$0")"

CONFIG=".env.docker"
BLEU=$'\033[36m'; VERT=$'\033[32m'; GRIS=$'\033[90m'; GRAS=$'\033[1m'; FIN=$'\033[0m'

if ! docker info >/dev/null 2>&1; then
  echo "Docker ne répond pas. Démarrez Docker Desktop, puis relancez ./demarrer.sh" >&2
  exit 1
fi

# --- secrets, générés une seule fois ---------------------------------------
if [ ! -f "$CONFIG" ]; then
  echo "${GRIS}Première installation — génération des secrets dans $CONFIG${FIN}"
  cat > "$CONFIG" <<CONF
# Généré automatiquement au premier ./demarrer.sh — ne pas versionner.
AUTH_SECRET=$(openssl rand -base64 48 | tr -d '\n')
POSTGRES_PASSWORD=$(openssl rand -base64 32 | tr -dc 'A-Za-z0-9' | cut -c1-28)

# Port d'écoute ; 8080 pour ne pas gêner un serveur de développement sur 3000.
APP_PORT=8080
APP_URL=http://localhost:8080
APP_NAME=Gestion des Finances

# Compte administrateur créé au tout premier démarrage
ADMIN_NOM=Administrateur
ADMIN_EMAIL=admin@local

BASE_CURRENCY=XAF
MAX_UPLOAD_MB=20

# Emails : passez à smtp et renseignez les SMTP_* quand vous aurez un serveur
MAIL_DRIVER=console
MAIL_FROM=Gestion des Finances <no-reply@exemple.com>
CONF
  chmod 600 "$CONFIG"
fi

# On lit la valeur sans « sourcer » le fichier : docker compose accepte des
# valeurs avec des espaces (APP_NAME, MAIL_FROM), que le shell interpréterait.
PORT=$(grep -E '^APP_PORT=' "$CONFIG" | head -1 | cut -d= -f2- | tr -d ' ')
PORT="${PORT:-8080}"

echo "${BLEU}Construction et démarrage…${FIN}"
docker compose --env-file "$CONFIG" up -d --build

printf "%s" "${GRIS}En attente de l'application"
for _ in $(seq 1 90); do
  if curl -fsS -o /dev/null "http://localhost:${PORT}/login" 2>/dev/null; then
    echo " ${FIN}"
    break
  fi
  printf "."
  sleep 2
done
echo "${FIN}"

if ! curl -fsS -o /dev/null "http://localhost:${PORT}/login" 2>/dev/null; then
  echo "L'application n'a pas répondu. Journaux :" >&2
  docker compose --env-file "$CONFIG" logs --tail 40 app >&2
  exit 1
fi

echo
echo "${VERT}${GRAS}L'application tourne sur http://localhost:${PORT}${FIN}"
echo

# Les identifiants du premier administrateur, s'ils viennent d'être créés.
IDENTIFIANTS=$(docker compose --env-file "$CONFIG" logs app 2>/dev/null \
  | grep -A 8 "PREMIER DÉMARRAGE" | sed 's/^[^|]*| //' || true)

if [ -n "$IDENTIFIANTS" ]; then
  echo "$IDENTIFIANTS"
else
  echo "${GRIS}Compte administrateur déjà en place — connectez-vous normalement.${FIN}"
fi

echo
echo "${GRIS}  Arrêter        : docker compose --env-file $CONFIG down"
echo "  Journaux       : docker compose --env-file $CONFIG logs -f app"
echo "  Tout effacer   : docker compose --env-file $CONFIG down -v${FIN}"
