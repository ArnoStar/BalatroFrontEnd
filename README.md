# BalatroFrontEnd

Balatro's user interface in the browser: the game's own UI code, ported line by
line from the Lua source to TypeScript and drawn with WebGL2 using the game's
shaders, sprites, sounds and font. The game logic is not here: every action is
sent to [BalatroWebAPI](../BalatroWebAPI), which plays it with
[BalatroEngine](../BalatroEngine) and returns the new state and what happened,
event by event, with the time the game shows each one. The front end replays
those events in time with its port of the game's animations.

The code is organised with [Feature-Sliced Design](https://feature-sliced.design).

The game is served at `/play/`. Everything around it is
[BalatroPortal](../BalatroPortal): signing in, the account, the player's runs,
and later leaderboards and lobbies. The portal is at `/` on the same origin,
so both share the player's session. Accounts and tokens come from
[BalatroIndentityService](../BalatroIndentityService).

## Run it

You need Node 20+, a copy of Balatro's files (the unpacked game, as in
`../balatro_src`), LuaJIT and LÖVE 11.5 (only to extract the data and the font
once), and the API.

1. Extract the game's assets and data (they are not in this repository):

   ```
   npm install
   npm run assets            # reads ../balatro_src; BALATRO_SRC=/path/to/game to change it
   ```

   This copies the textures, sounds and shaders to `public/resources/`, dumps
   the font to `public/fonts/` and writes the game's data tables to
   `src/shared/config/generated/game.json`.

2. Start the API (see its README):

   ```
   cd ../BalatroWebAPI && uv run balatro-api        # http://127.0.0.1:8000
   ```

3. Start the game:

   ```
   npm run dev                                       # http://localhost:5173/play/
   ```

   The dev server proxies `/api` to `http://127.0.0.1:8000` and `/identity` to
   `http://127.0.0.1:8001` (`BALATRO_API=...`, `BALATRO_IDENTITY=...` to change
   them). A built game (`npm run build`, served at `/play/`) calls the API at
   `VITE_API_URL` (set at build time) or at the page's `?api=http://host:port`
   parameter.

### Signing in

When the API runs with sign-in (its `/health` says `"auth": "required"`), the
game needs a signed-in player. Without a session, it sends the player to the
portal's `/login?next=/play/...`, which sends them back afterwards. In
development, run the identity service and the portal too, and open the game
through the portal, at http://localhost:5174/play/ (see BalatroPortal's
README).

With the API's default, sign-in off, nothing changes: the game works on its
own at http://localhost:5173/play/, everyone is the same player, and the
frame-by-frame tools below need no account.

`src/shared/api/session.ts` reads the shared session
(`localStorage['balatro.session']`). It refreshes the access token under a
lock shared by every tab, and the API client adds the token to each request
and retries once after a refresh on a 401. The portal has the same file, so
keep the two in step. In the main menu's profile, a signed-in player sees
their account's name, with ACCOUNT (the portal's account page) and LOG OUT
buttons, in place of the local name field.

## Run the whole site

The site is six parts, each in its own repository next to this one: the
portal (BalatroPortal), this game, the API (BalatroWebAPI), the identity
service (BalatroIndentityService), the notification service that sends the
emails (BalatroNotificationService), and the engine inside the API. Every
repository has the same commands (`make` lists them): `make install`,
`make run` (that part alone), `make check`. This repository also runs them
all together, in two ways.

**On this machine, from the repositories, with hot reload**:

```
make dev              # http://localhost:5174 (the portal; the game at /play/)
MAIL=1 make dev       # the emails in Mailpit's inbox, http://localhost:8025
AUTH=0 make dev       # the API without sign-in
```

`scripts/dev-all.sh` starts the identity service's PostgreSQL and Redis,
RabbitMQ (and Mailpit) in Docker. It then starts the notification service
(:8002; the emails are in its log lines), the identity service (:8001, which
hands it the codes), the API with sign-in (:8000), the game (:5173) and the
portal (:5174). Their logs share the
terminal, each with its name. Ctrl-C stops them, and `make down` stops the
Docker part. Google sign-in comes from the identity service's `.env`. The
Docker stack below uses the same ports, so stop it first (`make down`).

**In Docker, built from the repositories, configured by one `.env`**:

```
cp .env.example .env  # then fill it in (Google, email ...)
make up               # http://localhost:8087
make logs s=identity  # make ps, make restart s=api, make down, make config
```

## Run it with Docker

`docker-compose.yml` builds and starts the whole site. It expects this project
next to `../BalatroPortal`, `../BalatroWebAPI`, `../BalatroIndentityService`,
and the game in `../balatro_src`:

```
docker compose up --build                         # http://localhost:8087
```

| Service | |
|---|---|
| `portal` | the front door on `WEB_PORT`: the portal at `/`, and nginx passes `/play/`, `/api/` and `/identity/` on |
| `web` | the game, at `/play/` |
| `api`, `api-db` | the game API, with sign-in on (it checks the identity service's tokens), and its PostgreSQL (runs and statistics) |
| `reports`, `reports-db` | the bug reports (BalatroBugReportService), with its PostgreSQL; at `/reports/` |
| `identity`, `identity-db`, `identity-redis` | accounts and sign-in, with PostgreSQL and Redis |
| `notification` | sends the emails (BalatroNotificationService): the identity service hands it the codes through `rabbitmq` |
| `rabbitmq` | the message broker between them (UI on `127.0.0.1:15672`) |
| `mailpit` (`--profile mail`) | catches the emails: http://localhost:8025 (with `EMAIL_BACKEND=smtp SMTP_HOST=mailpit SMTP_PORT=1025 SMTP_SECURITY=none`) |

This is the only compose file of the project: the identity service's `make
services` also starts its database and Redis from it. Those are published on
`127.0.0.1:55432` and `:56379` for the identity service run outside Docker,
and the API's `make db` starts `api-db` (on `127.0.0.1:55433`).
The engine (BalatroEngine) is a library inside the `api` image, not a service.

The game's image runs `npm run assets` itself (LuaJIT and LÖVE are in the
build stage), reading the game from `balatro_src` (the build context `game`).
Runs are kept in `api-db`, accounts in `identity-db`, and the token
signing key in `identity-data`. `WEB_PORT`, `PUBLIC_URL` (the site's public
origin, which the tokens' issuer depends on), `API_URL`, `API_PORT`,
`BALATRO_API_DEBUG_COMMANDS`, `API_DB_PASSWORD`, `IDENTITY_DB_PASSWORD`, the identity service's
email settings and Google keys change the defaults (see the file). Emails go
to `docker compose logs identity` by default. Builds use the host's network,
so they also download behind a VPN.

Fonts rendered in the container differ from a dump made with another FreeType
by one pixel on six accented letters (Ã Ñ Õ ã ñ õ), which English text never
uses.

## Deployment

`.github/workflows/ci-cd.yml` checks every push and pull request on `main`
and `dev` (typecheck, lint, build, with a stand-in for the game's data). A push
or a merge to `main` then deploys: the code is copied to the server over SSH,
and `docker compose up -d --build web portal notification` rebuilds the images
there, since the server has the copy of the game they are made from. It starts
the identity service and RabbitMQ too. The job waits until all three are healthy and the portal reaches
`/play/`, `/api/` and `/identity/`. A failed build leaves the running
containers in place. BalatroWebAPI, BalatroIndentityService,
BalatroNotificationService and BalatroPortal deploy themselves the same way, each rebuilding its own service with this
compose file.

The server (Ubuntu), once:

1. Docker Engine with the compose and buildx plugins, and rsync. Docker's own
   packages have both plugins (docs.docker.com/engine/install/ubuntu); with
   Ubuntu's `docker.io`, add `docker-compose-v2` and `docker-buildx`. Then
   `sudo apt install rsync`.
2. A user for the deployments, in the `docker` group
   (`sudo adduser --disabled-password deploy && sudo usermod -aG docker deploy`),
   with the deploy key's public half in `~deploy/.ssh/authorized_keys`.
3. `/opt/balatro`, owned by that user, with the game in
   `/opt/balatro/balatro_src` (e.g. `rsync -a balatro_src/ deploy@server:/opt/balatro/balatro_src/`).
4. `/opt/balatro/BalatroFrontEnd/.env`, which deployments keep, with at least
   `PUBLIC_URL` (the site's address as players type it, e.g.
   `https://balatro.example.com`), `API_DB_PASSWORD` and `IDENTITY_DB_PASSWORD`. For real email,
   add `EMAIL_BACKEND=smtp` and the `SMTP_*` settings (the notification service
   uses them), and set `RABBITMQ_PASSWORD`; for Google sign-in, add
   `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` (see the identity service's
   README). Optionally `WEB_PORT=80`.

The secrets, in both repositories (Settings → Secrets and variables →
Actions → New repository secret):

| Secret | Value |
|---|---|
| `DEPLOY_HOST` | the server's address |
| `DEPLOY_USER` | the deployment user (`deploy`) |
| `DEPLOY_SSH_KEY` | the private key of a key pair made for it (`ssh-keygen -t ed25519 -N '' -f balatro_deploy`) |
| `DEPLOY_KNOWN_HOSTS` | the server's host keys (`ssh-keyscan <server>`) |
| `DEPLOY_PORT` | optional, the SSH port (22) |
| `DEPLOY_PATH` | optional, the folder on the server (`/opt/balatro`) |
| `API_URL` | optional, the API's public base URL, with or without a path: the browser calls `<API_URL>/api/v1/...` (e.g. `https://example.com/api` when a reverse proxy sends `/api/...` to the API without the `/api`). By default the page's own `/api/`, which goes to the API deployed next to it |

The `DEPLOY_*` secrets go in all five deployed repositories (BalatroFrontEnd,
BalatroWebAPI, BalatroIndentityService, BalatroNotificationService,
BalatroPortal). Until they are set,
the deploy job is skipped with a warning. The first time, and whenever a new
service is added to the compose file, deploy BalatroWebAPI,
BalatroIndentityService, BalatroNotificationService and BalatroPortal first (Actions → CI/CD → Run
workflow, on `main`). Their deployments only copy their code until this
repository's compose file runs them. Then deploy this repository: it starts
everything.

The API kept its runs in a SQLite file (the `runs` volume) before it moved to
PostgreSQL (`api-db`). On a server that ran the earlier version, copy them
once after the deployment, in `/opt/balatro/BalatroFrontEnd`:

```
docker compose exec api python -m balatro_api.manage import-sqlite /data/balatro.db
```

Runs already copied are skipped, so running it again does no harm.

## Bug reports

A player reports a bug from inside the game: Options > **Report a bug**, the
**F8** key, or the note that appears after an error. The dialog takes a
screenshot and sends, with the player's words, everything needed to see the
bug again (to BalatroBugReportService, at `/reports/`):

- **the run's history** (`GET /api/v1/games/{id}/history`): its settings and
  every command, which rebuild the run exactly (the engine is deterministic);
- **the game's recording** (`shared/lib/recorder`) of its last 15 minutes:
  every API request and response with its request id (the API logs each request
  with it), the player's mouse and keys in game units (`shared/lib/input`, the
  one way input reaches the game), actions, state changes, warnings and errors;
- the build (`.build`, written by the deployment, or git), browser, window and
  settings.

**To see it again**, a developer (an account with the developer or admin
role, given in the portal's `/admin`) opens the report in
the portal (`/bugs`) and clicks *Replay it in the game*, i.e.
`/play/?report=<id>`: the API rebuilds the run where the recording starts
(`POST /api/v1/games/import`), the game opens it and replays the player's
inputs, each after the same number of finished actions and the same delay as
when it was recorded, frame by frame, up to the moment of the report. A bar
shows the report, the progress, and where the replay goes another way than the
player did. `&at=<version>` only opens the run at a version; `&inputs=0` skips
the inputs. Details: BalatroBugReportService's `docs/recording.md`.

`node scripts/report-e2e.mjs` checks the whole loop on the dev servers (API
with debug commands, report service without sign-in): it plays a few actions
with the mouse (a drag included), reports with F8, replays the report in a new
page, and compares the actions and the final run.

## How it works

- **The game's UI, ported.** `shared/lib/engine` is the game's engine
  (`engine/*.lua`: nodes, moveables, sprites, UI boxes, DynaText, particles,
  events, the controller), `shared/lib/love` a small WebGL2/WebAudio version of
  the LÖVE APIs it uses (the game's `.fs` shaders run unchanged). Cards, card
  areas, blinds, tags and decks are `entities`; the screens (HUD, blind select,
  shop, packs, round evaluation, game over, run setup, options, collection...)
  are `widgets` and `pages`, written from `UI_definitions.lua`.
- **The API's events, replayed in time.** An action (`features`) sends the
  move to the API, then plays two things together: the API's events at their
  `t` (cards moving, scoring texts, money, the score), and the game's own
  reaction, ported as it is queued in the game (screens sliding, sounds, the
  state machine). Where the game waits on its logic, the port waits on the
  event timeline (`Timeline.until`). When the events are played, the returned
  `GameView` is the truth and the screen is brought in line with it.
- **Legality comes from the API.** Buttons are enabled from the view's
  `actions`, and the hand shown above the selected cards comes from
  `POST /preview`. Nothing of the rules is computed here.

```
src/
  app/        boot (assets, shaders, font), the main loop, input, slice registration
  pages/      splash, main-menu (with the profile and language overlays), run (Game:start_run,
              the run's state machine, shop, packs, play buttons, round evaluation, game over)
  widgets/    hud, blind-select, run-setup, run-info (and the deck), options (and Customize
              Deck), challenges, collection, stats
  features/   play-hand, select-blind, shop (and cash out), use-card (use, pick, sell,
              open packs, redeem, move), run-lifecycle (new run, continue, main menu)
  entities/   card (Card, CardArea, Jimbo, card popups), blind, tag, back,
              run (G.GAME from the view, the timeline, the action pipeline)
  shared/     api (types and client), lib/engine, lib/love, lib/localization,
              config (game data, profile, settings), ui (the generic UI kit)
```

## Checking it against the game

- `tools/love/refshot/run.sh <script.lua> <out>` runs the real game headless
  (fixed 60 fps, scripted clicks or Lua, screenshots at 2560x1440).
- `node scripts/shot.mjs "http://localhost:5173/play/?test" out.png ...` steps the
  front end frame by frame (`window.__test.step(n)`) and takes the same shots.
- `tools/oracle/oracle.py <scenario.py>` plays a scenario with the engine and
  prints when the game runs each queued event, its state changes and the API's
  events, to compare an action's choreography with, frame by frame (see the
  file for how to run it).
- `node scripts/bot.mjs "http://localhost:5173/play/?test" 80` plays a run through
  the front end's buttons and reports runtime errors (needs the API with
  `BALATRO_API_DEBUG_COMMANDS=1`).

`npm run typecheck` and `npm run lint` (Steiger, FSD rules) should pass.

## Differences with the game

- English only, one profile, everything unlocked and discovered. The profile's
  stats (high scores, card usage, wins) and settings are kept in the browser.
  With sign-in, the profile's name is the account's display name.
- Runs live in the API, one list per player: "Continue" opens the player's
  most recent unfinished run.
- The API gives a few texts as meanings, not words: a joker's message (e.g.
  "Safe!", "Upgrade!") is rebuilt from the joker's name.
- Face-down cards are never revealed by the API: a face-down card played from
  the hand is shown face down.
- The Credits screen is not ported.
- The main menu's QUIT is HOME: it goes back to the portal (the site's home,
  with the player's runs and account) instead of closing the program.
