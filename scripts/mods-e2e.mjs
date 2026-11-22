// Mods, end to end in the real UI: the MODS menu (browse, install, info),
// a run with the official mods, creative mode (add a mod's joker, a card),
// a scored hand with the mod's joker. Screenshots in OUT.
//   node scripts/mods-e2e.mjs [game url] [out dir]
// Needs the API (sign-in off, debug: BALATRO_API_DATABASE_URL=memory BALATRO_API_DEBUG_COMMANDS=1)
// and the dev server (npx vite). Chrome: CHROME=/usr/bin/google-chrome-stable.
import { chromium } from 'playwright-core';
import { mkdirSync } from 'node:fs';

const [url = 'http://localhost:5173/play/', out = '/tmp/mods-e2e'] = process.argv.slice(2);
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({
  executablePath: process.env.CHROME ?? '/usr/bin/google-chrome-stable',
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--disable-gpu-compositing'],
});
const page = await browser.newPage({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 1 });
page.setDefaultTimeout(120000);
const errors = [];
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errors.push(`[${m.type()}] ${m.text()}`); });
page.on('pageerror', (e) => errors.push(`[pageerror] ${e.stack ?? e}`));
page.on('response', (r) => { if (r.status() >= 400) errors.push(`[http ${r.status()}] ${r.url()}`); });

let n = 0;
const shot = async (name) => { await page.screenshot({ path: `${out}/${String(++n).padStart(2, '0')}-${name}.png` }); };
const wait = (ms) => page.waitForTimeout(ms);
const until = (f, arg) => page.waitForFunction(f, arg, { timeout: 60000 });

/** the screen position of a UI element whose config.button is `name` (and whose ref_table matches `ref`) */
async function find_button(name, ref) {
  return page.evaluate(([name, ref]) => {
    const G = window.__game.G;
    const k = G.TILESCALE * G.TILESIZE;
    const ok = (n) => n.config?.button === name && n.states?.visible !== false &&
      (!ref || Object.entries(ref).every(([a, b]) => n.config.ref_table?.[a] === b));
    const find = (n) => {
      if (!n) return null;
      if (ok(n)) return n;
      for (const c of (n.children ? Object.values(n.children) : [])) { const r = find(c); if (r) return r; }
      return null;
    };
    const boxes = [G.OVERLAY_MENU, ...G.I.UIBOX].filter((b) => b && b.UIRoot);
    for (const b of boxes) {
      const n = find(b.UIRoot);
      if (n) return [(n.T.x + n.T.w / 2 + G.ROOM.T.x) * k / devicePixelRatio, (n.T.y + n.T.h / 2 + G.ROOM.T.y) * k / devicePixelRatio];
    }
    return null;
  }, [name, ref ?? null]);
}

async function click(name, ref, ms = 900) {
  let pos = null;
  for (let i = 0; i < 40 && !pos; i++) { pos = await find_button(name, ref); if (!pos) await wait(250); }
  if (!pos) throw new Error(`no button ${name} ${JSON.stringify(ref ?? {})}`);
  await page.mouse.move(pos[0], pos[1]);
  await wait(150);
  await page.mouse.click(pos[0], pos[1]);
  await wait(ms);
}

/** a card's screen position: in an area of G (name), or in the overlay, by its center key */
async function card_pos(where, key) {
  return page.evaluate(([where, key]) => {
    const G = window.__game.G;
    const k = G.TILESCALE * G.TILESIZE;
    let card = null;
    if (where !== 'overlay') card = G[where].cards.find((c) => c.config.center.key === key || c.base?.value + c.base?.suit === key);
    else for (const c of G.I.CARD) if (c.config?.center?.key === key && c.area && !c.REMOVED && c.states.visible) card = c;
    if (!card) return null;
    return [(card.T.x + card.T.w / 2 + G.ROOM.T.x) * k / devicePixelRatio, (card.T.y + card.T.h / 2 + G.ROOM.T.y) * k / devicePixelRatio];
  }, [where, key]);
}

async function click_card(where, key, ms = 600) {
  const pos = await card_pos(where, key);
  if (!pos) throw new Error(`no card ${key} in ${where}`);
  await page.mouse.move(pos[0], pos[1]);
  await wait(200);
  await page.mouse.click(pos[0], pos[1]);
  await wait(ms);
}

/** the ids of the mods the game's library has (IndexedDB) */
function installed_ids() {
  return page.evaluate(() => new Promise((done) => {
    const req = indexedDB.open('balatro-fe.mods', 1);
    req.onupgradeneeded = () => req.result.createObjectStore('installed', { keyPath: 'id' });
    req.onsuccess = () => {
      const all = req.result.transaction('installed', 'readonly').objectStore('installed').getAllKeys();
      all.onsuccess = () => done(all.result);
      all.onerror = () => done([]);
    };
    req.onerror = () => done([]);
  }));
}

async function hover_card(where, key) {
  const pos = await card_pos(where, key);
  if (!pos) throw new Error(`no card ${key} in ${where}`);
  await page.mouse.move(pos[0], pos[1]);
  await wait(900);
}

try {
  await page.goto(url);
  await until(() => window.__game && window.__game.G.STATE === window.__game.G.STATES.MENU && window.__game.G.MAIN_MENU_UI);
  await wait(3000);
  await shot('title');

  // the MODS menu: browse the registry, install the official mods
  await click('mods_menu');
  await shot('mods-installed-empty');
  await click('mods_tab', { tab: 'browse' }, 2500);
  await shot('mods-browse');
  for (const id of ['fruit_stand', 'wild_rules', 'creative']) {
    for (let i = 0; i < 3 && !(await installed_ids()).includes(id); i++) {
      await click('mods_install', { id }, 500);
      for (let w = 0; w < 20 && !(await installed_ids()).includes(id); w++) await wait(250);
    }
  }
  console.log('installed:', (await installed_ids()).join(', '));
  await wait(1000);
  await shot('mods-browse-installed');
  await click('mods_tab', { tab: 'installed' }, 1500);
  await shot('mods-installed');
  await click('mods_info', { id: 'fruit_stand' }, 2500);
  await shot('mods-info');
  await hover_card('overlay', 'j_fruit_stand_orchard');
  await shot('mods-info-hover');
  await click('mods_info_back', null, 1200);
  await click('mods_close', null, 1500);

  // a run with the enabled mods, on a mod's deck
  await page.evaluate(() => window.__game.G.FUNCS.start_run(null, { request: { seed: 'MODTEST', deck: 'b_wild_rules_gardener', stake: 1 } }));
  await until(() => window.__game.G.STATE === window.__game.G.STATES.BLIND_SELECT && window.__game.run.view);
  await until(() => !window.__game.G.CONTROLLER.locked);
  await wait(800);
  const settings = await page.evaluate(() => window.__game.run.view.settings);
  console.log('run settings mods:', settings.mods.map((m) => m.id).join(', '), 'deck', settings.deck);
  await shot('run-blind-select');

  // creative mode: the panel, a mod joker from the picker
  await click('creative_open', null, 1200);
  await shot('creative-panel');
  await click('creative_step', { what: 'money', value: (await page.evaluate(() => window.__game.run.view.dollars)) + 10 }, 1500);
  console.log('money after +10:', await page.evaluate(() => window.__game.run.view.dollars));
  await click('creative_open_pick', null, 1200);
  await wait(800);
  await shot('creative-pick-jokers');
  await click_card('overlay', 'j_fruit_stand_cherry_seven', 1500);
  await click_card('overlay', 'j_fruit_stand_orchard', 1500);
  await shot('creative-added');
  await click('creative_close', null, 1500);
  await hover_card('jokers', 'j_fruit_stand_cherry_seven');
  await shot('run-joker-hover');

  // a round: two cards added to the hand with creative mode (the picker's default: Ace of Spades)
  await click('select_blind', null, 4000);
  await until(() => window.__game.G.STATE === window.__game.G.STATES.SELECTING_HAND && !window.__game.run.busy && !window.__game.G.CONTROLLER.locked);
  await wait(800);
  await click('creative_open', null, 1000);
  await click('creative_open_pick', null, 800);
  await click('creative_set', { set: 'Playing' }, 800);
  await click('creative_add_card', { to: 'hand' }, 1500);
  await click('creative_add_card', { to: 'hand' }, 1500);
  await shot('creative-cards-added');
  await click('creative_close', null, 1500);
  const added = await page.evaluate(() => window.__game.G.hand.cards.slice(-2).map((c) => c.base.value + ' ' + c.base.suit));
  console.log('added to hand:', added.join(', '));
  await shot('run-hand');

  // Orchard: discarding Hearts makes it grow (its "Upgrade!"), then a pair of the added Aces scores with it
  const idx = (pred) => page.evaluate((p) => window.__game.G.hand.cards.map((c, i) => [i, c.base.value, c.base.suit]).filter(eval(p)).map((x) => x[0]), pred);
  const click_hand = async (i) => {
    const pos = await page.evaluate((i) => { const G = window.__game.G; const k = G.TILESCALE * G.TILESIZE; const c = G.hand.cards[i]; return [(c.T.x + c.T.w / 2 + G.ROOM.T.x) * k, (c.T.y + c.T.h / 2 + G.ROOM.T.y) * k]; }, i);
    await page.mouse.click(pos[0], pos[1]);
    await wait(300);
  };
  for (const i of (await idx("(x) => x[2] === 'Hearts'")).slice(0, 2)) await click_hand(i);
  await click('discard_cards_from_highlighted', null, 900);
  await shot('discard-upgrade');
  await until(() => !window.__game.run.busy && window.__game.G.STATE === window.__game.G.STATES.SELECTING_HAND);
  await wait(800);
  await hover_card('jokers', 'j_fruit_stand_orchard');
  await shot('orchard-grown');
  for (const i of (await idx("(x) => x[1] === 'Ace'")).slice(0, 2)) await click_hand(i);
  await click('play_cards_from_highlighted', null, 2600);
  await shot('pair-scoring');
  await until(() => !window.__game.run.busy);
  const last = await page.evaluate(() => window.__game.run.view.last_hand);
  console.log('scored:', JSON.stringify(last));

  // a mod's boss blind, chosen with creative mode at the next blind select
  await page.evaluate(() => window.__game.G.FUNCS.start_run(null, { request: { seed: 'MODBOSS', deck: 'b_red', stake: 1 } }));
  await until(() => window.__game.G.STATE === window.__game.G.STATES.BLIND_SELECT && window.__game.run.view?.round === 0 && !window.__game.G.CONTROLLER.locked);
  await wait(800);
  await click('creative_open', null, 1000);
  await click('creative_open_boss', null, 1000);
  await shot('creative-bosses');
  await click('creative_boss', { key: 'bl_wild_rules_toll' }, 500);
  await until(() => window.__game.G.STATE === window.__game.G.STATES.BLIND_SELECT && window.__game.run.view?.blind_select && !window.__game.G.CONTROLLER.locked);
  await wait(2500);
  await shot('mod-boss');
} catch (err) {
  console.error('FAILED:', err.message);
  await shot('failure');
} finally {
  console.log(errors.length ? errors.join('\n') : 'no console errors');
  await browser.close();
}
