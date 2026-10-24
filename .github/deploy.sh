#!/usr/bin/env bash
# Deploys the front end (GitHub Actions, deploy job): copies this checkout to
# the server, then rebuilds and restarts the web service there
# (.github/deploy-remote.sh).
#
# The server keeps, in DEPLOY_PATH (/opt/balatro):
#   BalatroFrontEnd/   this repository (copied here), with an optional .env
#   BalatroWebAPI/     the API (copied by its own deployment)
#   balatro_src/       a copy of the game, put there once by hand
#
# env: DEPLOY_HOST, DEPLOY_USER, DEPLOY_SSH_KEY, DEPLOY_KNOWN_HOSTS,
#      DEPLOY_PORT (22), DEPLOY_PATH (/opt/balatro), API_URL (optional)
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

# the server's part (.github/deploy-remote.sh), with API_URL (quoted for the remote shell)
$ssh_cmd "$target" "bash -s -- $(printf '%q ' "$root" "${API_URL:-}")" < .github/deploy-remote.sh
