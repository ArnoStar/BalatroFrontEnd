#!/usr/bin/env bash
# The server's part of .github/deploy.sh (run there through ssh): rebuilds and
# restarts the web service with docker compose, waits until it is healthy, and
# checks that its /api/ reaches the API.
#   deploy-remote.sh <root> [api_url]
# api_url: where /api/ goes, an API's base URL without a path (the API_URL
# secret); empty: the server's .env, or the compose file's own API service.
set -euo pipefail
root="$1"
api_url="${2:-}"

# one deployment at a time (the API's deploys here too)
exec 9>"$root/.deploy.lock"
flock 9

for d in BalatroWebAPI balatro_src; do
  if [ ! -d "$root/$d" ]; then
    echo "::error::$root/$d is missing on the server (deploy BalatroWebAPI first; copy the game to balatro_src)"
    exit 1
  fi
done

if [ -n "$api_url" ]; then
  api_url="${api_url%/}"
  # nginx passes the request's path on only if the address has none of its own
  if ! [[ "$api_url" =~ ^https?://[^/[:space:]]+$ ]]; then
    echo "::error::API_URL must be an API's base URL without a path, like http://host:8000 or https://api.example.com"
    exit 1
  fi
  export API_URL="$api_url"
else
  unset API_URL
fi

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

# the API, through the front end
if ! docker compose exec -T web wget -q -O /dev/null http://127.0.0.1/api/v1/health; then
  docker compose logs --tail 40 web
  echo "::error::the front end is up, but its /api/ does not reach the API (API_URL)"
  exit 1
fi
docker image prune -f > /dev/null
