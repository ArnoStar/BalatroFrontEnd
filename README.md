# BalatroFrontEnd

Balatro's user interface in the browser: the game's own UI code, ported line by
line from the Lua source to TypeScript and drawn with WebGL2 using the game's
shaders, sprites, sounds and font. The game logic is not here: every action is
sent to [BalatroWebAPI](../BalatroWebAPI), which plays it with
[BalatroEngine](../BalatroEngine) and returns the new state and what happened,
event by event, with the time the game shows each one. The front end replays
those events in time with its port of the game's animations.

The code is organised with [Feature-Sliced Design](https://feature-sliced.design).

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

3. Start the front end:

   ```
   npm run dev                                       # http://localhost:5173
   ```

   The dev server proxies `/api` to `http://127.0.0.1:8000` (`BALATRO_API=...`
   to change it). A built front end (`npm run build`, then serve `dist/`) calls
   the API at `VITE_API_URL` (set at build time) or at the page's
   `?api=http://host:port` parameter.

## Run it with Docker

`docker-compose.yml` builds and starts the front end and the API, with this
project next to `../BalatroWebAPI` and the game in `../balatro_src`:

```
docker compose up --build                         # http://localhost:8080
```

The front end's image runs `npm run assets` itself (LuaJIT and LÖVE are in the
build stage), reading the game from `balatro_src` (the build context `game`),
and serves the built app with nginx, passing `/api/` to the API container.
Runs are kept in the `runs` volume. `WEB_PORT`, `API_PORT` and
`BALATRO_API_DEBUG_COMMANDS` change the defaults (see the file). Builds use the
host's network, so they also download behind a VPN.

Fonts rendered in the container differ from a dump made with another FreeType
by one pixel on six accented letters (Ã Ñ Õ ã ñ õ), which English text never
uses.

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
- `node scripts/shot.mjs "http://localhost:5173/?test" out.png ...` steps the
  front end frame by frame (`window.__test.step(n)`) and takes the same shots.
- `tools/oracle/oracle.py <scenario.py>` plays a scenario with the engine and
  prints when the game runs each queued event, its state changes and the API's
  events, to compare an action's choreography with, frame by frame (see the
  file for how to run it).
- `node scripts/bot.mjs "http://localhost:5173/?test" 80` plays a run through
  the front end's buttons and reports runtime errors (needs the API with
  `BALATRO_API_DEBUG_COMMANDS=1`).

`npm run typecheck` and `npm run lint` (Steiger, FSD rules) should pass.

## Differences with the game

- English only, one profile, everything unlocked and discovered. The profile's
  stats (high scores, card usage, wins) and settings are kept in the browser.
- Runs live in the API: "Continue" opens the most recent unfinished run.
- The API gives a few texts as meanings, not words: a joker's message (e.g.
  "Safe!", "Upgrade!") is rebuilt from the joker's name.
- Face-down cards are never revealed by the API: a face-down card played from
  the hand is shown face down.
- The Credits screen is not ported.
