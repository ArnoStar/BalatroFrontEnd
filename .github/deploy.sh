#!/usr/bin/env bash
# Deploys the front end (GitHub Actions, deploy job): copies this checkout to
# the server, then rebuilds and restarts the web service with docker compose
# and waits until it is healthy.
#
# The server keeps, in DEPLOY_PATH (/opt/balatro):
#   BalatroFrontEnd/   this repository (copied here), with an optional .env
#   BalatroWebAPI/     the API (copied by its own deployment)
#   balatro_src/       a copy of the game, put there once by hand
#
# env: DEPLOY_HOST, DEPLOY_USER, DEPLOY_SSH_KEY, DEPLOY_KNOWN_HOSTS,
#      DEPLOY_PORT (22), DEPLOY_PATH (/opt/balatro)
set -euo pipefail

: "${DEPLOY_HOST:?}" "${DEPLOY_USER:?}" "${DEPLOY_SSH_KEY:?}" "${DEPLOY_KNOWN_HOSTS:?}"
port="${DEPLOY_PORT:-22}"
root="${DEPLOY_PATH:-/opt/balatro}"
target="$DEPLOY_USER@$DEPLOY_HOST"

mkdir -p ~/.ssh
chmod 700 ~/.ssh
printf '%s\n' "$DEPLOY_SSH_KEY" > ~/.ssh/deploy_key
chmod 600 ~/.ssh/deploy_key
printf '%s\n' "$DEPLOY_KNOWN_HOSTS" > ~/.ssh/deploy_known_hosts
ssh_cmd="ssh -i $HOME/.ssh/deploy_key -p $port -o BatchMode=yes -o StrictHostKeyChecking=yes -o UserKnownHostsFile=$HOME/.ssh/deploy_known_hosts"

$ssh_cmd "$target" "mkdir -p '$root/BalatroFrontEnd'"
# the code only: what the image generates, and the server's own .env, stay
rsync -az --delete -e "$ssh_cmd" \
  --exclude .git --exclude node_modules --exclude dist --exclude .env \
  --exclude public/resources --exclude public/fonts --exclude src/shared/config/generated \
  ./ "$target:$root/BalatroFrontEnd/"

api_url_b64="$(printf '%s' "$API_URL" | base64 -w0)"
$ssh_cmd "$target" "API_URL_B64='$api_url_b64' bash -s -- '$root'" <<'REMOTE'
set -euo pipefail
root="$1"
# one deployment at a time (the API's deploys here too)
exec 9>"$root/.deploy.lock"
flock 9
for d in BalatroWebAPI balatro_src; do
  if [ ! -d "$root/$d" ]; then
    echo "::error::$root/$d is missing on the server (deploy BalatroWebAPI first; copy the game to balatro_src)"
    exit 1
  fi
done
cd "$root/BalatroFrontEnd"
docker compose up -d --build web
cid="$(docker compose ps -q web)"
status=starting
for _ in $(seq 90); do
  status="$(docker inspect -f '{{.State.Health.Status}}' "$cid")"
  [ "$status" = healthy ] && break
  [ "$status" = unhealthy ] && break
  sleep 2
done
docker compose ps
if [ "$status" != healthy ]; then
  docker compose logs --tail 80 web api
  echo "::error::the web service is $status"
  exit 1
fi
docker image prune -f > /dev/null
REMOTE
