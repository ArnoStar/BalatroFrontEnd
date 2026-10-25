#!/usr/bin/env bash
# The server's part of .github/deploy.sh (run there through ssh): rebuilds and
# restarts the game (web), the API (api, with its database api-db) and the
# site's front door (portal, which also starts the identity service) with
# docker compose, waits until they are healthy, and
# checks that the portal reaches the game, the API and the identity service.
#   deploy-remote.sh <root> [api_url]
# api_url: where /api/ goes, an API's base URL, with or without a path (the
# API_URL secret); empty: the server's .env, or the compose file's API service.
set -euo pipefail
root="$1"
api_url="${2:-}"

# one deployment at a time (the API's deploys here too)
exec 9>"$root/.deploy.lock"
flock 9

for d in BalatroWebAPI BalatroIndentityService BalatroNotificationService BalatroPortal balatro_src; do
  if [ ! -d "$root/$d" ]; then
    echo "::error::$root/$d is missing on the server (deploy BalatroWebAPI, BalatroIndentityService, BalatroNotificationService and BalatroPortal first; copy the game to balatro_src)"
    exit 1
  fi
done

# a pasted secret may end with a newline
api_url="$(printf '%s' "$api_url" | tr -d '[:space:]')"
if [ -n "$api_url" ]; then
  if ! [[ "$api_url" =~ ^https?://[^/]+ ]]; then
    echo "::error::API_URL must be an http(s) URL: http://host:8000, https://api.example.com, https://example.com/balatro"
    exit 1
  fi
  export API_URL="${api_url%/}"
else
  unset API_URL
fi

cd "$root/BalatroFrontEnd"
docker compose up -d --build api web portal notification
for service in api web portal notification; do
  cid="$(docker compose ps -q "$service")"
  status=starting
  for _ in $(seq 90); do
    status="$(docker inspect -f '{{.State.Health.Status}}' "$cid")"
    [ "$status" = healthy ] && break
    [ "$status" = unhealthy ] && break
    sleep 2
  done
  if [ "$status" != healthy ]; then
    docker compose ps
    docker compose logs --tail 80 "$service" api identity notification
    echo "::error::the $service service is $status"
    exit 1
  fi
done
docker compose ps

# the other parts, through the front door
for path in /play/ /api/v1/health /identity/health; do
  if ! docker compose exec -T portal wget -q -O /dev/null "http://127.0.0.1$path"; then
    docker compose logs --tail 40 portal
    echo "::error::the portal is up, but its $path does not answer"
    exit 1
  fi
done
docker image prune -f > /dev/null
