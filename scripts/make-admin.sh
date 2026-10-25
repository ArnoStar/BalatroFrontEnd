#!/usr/bin/env bash
# Makes an account an admin (the identity service's admin role): it asks for
# the account's email, shows its roles, and gives it the role once you say yes.
# Admins then give roles to others in the portal (/admin).
#
#   make admin                              (or ./scripts/make-admin.sh)
#   ./scripts/make-admin.sh you@example.com
#   ./scripts/make-admin.sh -y you@example.com     (no question: for scripts)
#
# It uses the identity service in this folder's Docker stack when it runs
# (`make up`, the server), or else ../BalatroIndentityService run on this
# machine (`make dev`, with its .env's database). The account must exist: sign
# up on the site first.
set -euo pipefail

game="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
identity="$(dirname "$game")/BalatroIndentityService"

die() { printf '\033[31mmake-admin: %s\033[0m\n' "$*" >&2; exit 1; }

yes=0
if [ "${1:-}" = "-y" ]; then yes=1; shift; fi
email="${1:-}"

# ---------------------------------------------------------------- where the identity service is
# (their input is /dev/null: `docker compose exec` would read what is typed for the questions)
if docker compose -f "$game/docker-compose.yml" ps --status running --services < /dev/null 2> /dev/null | grep -qx identity; then
  where="the Docker stack"
  manage() { docker compose -f "$game/docker-compose.yml" exec -T identity python -m app.manage "$@" < /dev/null; }
elif [ -d "$identity" ] && command -v uv > /dev/null; then
  where="$identity (its .env's database)"
  manage() { (cd "$identity" && uv run --quiet python -m app.manage "$@" < /dev/null); }
else
  die "no identity service: start the stack (make up) or clone BalatroIndentityService next to this folder"
fi
echo "The identity service: $where"

# ---------------------------------------------------------------- the account
while [ -z "$email" ]; do
  [ -t 0 ] || die "give the email: $0 you@example.com"
  read -rp "Email of the account to make admin: " email
  email="$(printf '%s' "$email" | tr -d '[:space:]')"
done
case "$email" in
  *@*.*) ;;
  *) die "'$email' is not an email address" ;;
esac

if ! account="$(manage show "$email" 2>&1)"; then
  die "$account (sign up on the site first, then run this again)"
fi
echo "$account"
roles="${account##*): }" # "email (name): admin, tester" (or "no role")
case ",${roles// /}," in
  *,admin,*) echo "Already an admin."; exit 0 ;;
esac

# ---------------------------------------------------------------- yes?
if [ "$yes" != 1 ]; then
  [ -t 0 ] || die "add -y to confirm without a terminal"
  read -rp "Make $email an admin? [y/N] " answer
  case "$answer" in
    y | Y | yes | YES) ;;
    *) echo "Nothing changed."; exit 0 ;;
  esac
fi
manage grant "$email" admin
echo "Done. In the portal, the Accounts page (/admin) is there at the next page load; the other"
echo "services see the role from the account's next sign-in or token refresh (15 minutes at most)."
