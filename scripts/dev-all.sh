#!/usr/bin/env bash
# The whole site on this machine, each part from its own repository (next to
# this one) with hot reload, their logs together in this terminal:
#
#   identity-db, identity-redis   Docker (docker-compose.yml)    127.0.0.1:55432, :56379
#   api-db, reports-db            Docker                         127.0.0.1:55433, :55434
#   rabbitmq                      Docker                         :5672 (UI http://localhost:15672)
#   mailpit (MAIL=1)              Docker                         http://localhost:8025
#   notification                  ../BalatroNotificationService  http://localhost:8002/health
#   identity                      ../BalatroIndentityService     http://localhost:8001
#   api (with sign-in)            ../BalatroWebAPI               http://localhost:8000
#   reports (with sign-in)        ../BalatroBugReportService     http://localhost:8003/docs
#   game                          this repository                http://localhost:5173/play/
#   portal                        ../BalatroPortal               http://localhost:5174  <- open this
#
#   make dev            (scripts/dev-all.sh)
#   MAIL=1 make dev     emails go to Mailpit instead of the notification service's log
#   AUTH=0 make dev     the API without sign-in (everyone is one player)
#   ADMINS=<account id> make dev   who reads the bug reports (/bugs in the portal; with
#                       AUTH=0, everyone does). An account's id: GET /reports/v1/me
#
# Ctrl-C stops the services it started; the Docker ones keep running
# (`make down` stops them). Google sign-in works when the identity service's
# .env has GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET (its README).
set -euo pipefail

game="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
root="$(dirname "$game")"
identity="$root/BalatroIndentityService"
notification="$root/BalatroNotificationService"
api="$root/BalatroWebAPI"
reports="$root/BalatroBugReportService"
portal="$root/BalatroPortal"
compose=(docker compose -f "$game/docker-compose.yml")

MAIL="${MAIL:-0}"
AUTH="${AUTH:-1}"
IDENTITY_URL="http://localhost:8001" # the tokens' issuer: the identity service's PUBLIC_URL
RABBITMQ_URL="amqp://balatro:balatro@127.0.0.1:5672/" # the compose file's rabbitmq

die() { printf '\033[31mdev-all: %s\033[0m\n' "$*" >&2; exit 1; }
note() { printf '\033[1mdev-all: %s\033[0m\n' "$*"; }

# a port answers on 127.0.0.1 or ::1 (Vite listens on "localhost", which may be either)
port_open() {
  (exec 3<> "/dev/tcp/127.0.0.1/$1") 2> /dev/null || (exec 3<> "/dev/tcp/::1/$1") 2> /dev/null
}

# ---------------------------------------------------------------- checks
for dir in "$identity" "$notification" "$api" "$reports" "$portal"; do
  [ -d "$dir" ] || die "$dir is missing: clone it next to $(basename "$game")"
done
for tool in uv npm docker; do
  command -v "$tool" > /dev/null || die "$tool is not installed"
done
[ -d "$game/public/resources" ] || die "the game's assets are missing: run 'npm run assets' here (needs ../balatro_src)"

busy=()
for port in 8000 8001 8002 8003 5173 5174; do
  if port_open "$port"; then busy+=("$port"); fi
done
if [ "${#busy[@]}" -gt 0 ]; then
  die "port(s) ${busy[*]} already in use. The Docker stack uses 8000 to 8003: 'make down'
       (or 'docker compose stop api reports identity notification web portal'), or stop the other dev servers"
fi

# dependencies, the first time
[ -d "$identity/.venv" ] || (cd "$identity" && uv sync)
[ -d "$notification/.venv" ] || (cd "$notification" && uv sync)
[ -d "$api/.venv" ] || (cd "$api" && uv sync)
[ -d "$reports/.venv" ] || (cd "$reports" && uv sync)
[ -d "$game/node_modules" ] || (cd "$game" && npm install)
[ -d "$portal/node_modules" ] || (cd "$portal" && npm install)

# ---------------------------------------------------------------- Docker
services=(identity-db identity-redis rabbitmq api-db reports-db)
profiles=()
if [ "$MAIL" = 1 ]; then
  services+=(mailpit)
  profiles=(--profile mail)
fi
note "starting ${services[*]} in Docker"
"${compose[@]}" "${profiles[@]}" up -d --wait "${services[@]}"

# ---------------------------------------------------------------- the services
trap 'trap - INT TERM EXIT; printf "\ndev-all: stopping\n"; kill 0 2> /dev/null' INT TERM EXIT

pids=()
start() { # start <name> <colour> <dir> <command...>
  local name="$1" colour="$2" dir="$3"
  shift 3
  (cd "$dir" && exec "$@") > >(sed -u "s/^/$(printf '\033[%sm' "$colour")[$name]$(printf '\033[0m') /") 2>&1 &
  pids+=("$!")
}

notification_env=(RABBITMQ_URL="$RABBITMQ_URL" SITE_URL=http://localhost:5174)
if [ "$MAIL" = 1 ]; then
  notification_env+=(EMAIL_BACKEND=smtp SMTP_HOST=127.0.0.1 SMTP_PORT=1025 SMTP_SECURITY=none)
fi
start notification 36 "$notification" env "${notification_env[@]}" make --no-print-directory run

# the codes go to the notification service
start identity 35 "$identity" env PUBLIC_URL="$IDENTITY_URL" EMAIL_BACKEND=notifications \
  RABBITMQ_URL="$RABBITMQ_URL" make --no-print-directory run

if [ "$AUTH" = 1 ]; then
  start api 34 "$api" env BALATRO_API_ADMINS="${ADMINS:-}" make --no-print-directory run-auth IDENTITY_URL="$IDENTITY_URL"
  start reports 31 "$reports" env BALATRO_REPORTS_ADMINS="${ADMINS:-}" make --no-print-directory run-auth IDENTITY_URL="$IDENTITY_URL"
else
  start api 34 "$api" make --no-print-directory run
  start reports 31 "$reports" make --no-print-directory run
fi
start game 32 "$game" npm run dev --silent
start portal 33 "$portal" npm run dev --silent

# the address, once everything answers
(
  for _ in $(seq 120); do
    ok=1
    for port in 8000 8001 8002 8003 5173 5174; do
      port_open "$port" || ok=0
    done
    if [ "$ok" = 1 ]; then
      note "ready: open http://localhost:5174 (game http://localhost:5174/play/, API docs :8000/docs, identity docs :8001/docs, bug reports :8003/docs, emails in $([ "$MAIL" = 1 ] && echo 'the inbox :8025' || echo "[notification]'s log"))"
      exit 0
    fi
    sleep 1
  done
  note "still starting after 2 minutes: see the logs above"
) &

# one service stopping stops the others
wait -n "${pids[@]}"
note "a service stopped: stopping the others"
