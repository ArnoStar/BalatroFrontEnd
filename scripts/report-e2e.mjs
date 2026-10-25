// End to end check of bug reports (dev servers): plays a few actions with the
// mouse, reports a bug with F8, then opens /play/?report=<id> in a new page and
// checks that the replay does the same actions and ends on the same run.
//   node scripts/report-e2e.mjs [url=http://localhost:5173/play/]
// Needs the API with debug commands (or the caller in BALATRO_API_ADMINS) and
// the report service without sign-in (or the caller an admin).
import { chromium } from 'playwright-core';

const url = process.argv[2] ?? 'http://localhost:5173/play/';
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM ?? '/usr/bin/chromium',
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});
const logs = [];
const fail = async (msg) => { console.log('FAIL:', msg); console.log(logs.slice(-30).join('\n')); await browser.close(); process.exit(1); };

async function open(path) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
  page.on('console', (m) => { if (['error', 'warning'].includes(m.type())) logs.push(`[${m.type()}] ${m.text()}`); });
  page.on('pageerror', (e) => logs.push(`[pageerror] ${e}`));
  await page.goto(path);
  await page.waitForFunction(() => {
    const g = window.__game?.G;
    return g && g.STAGE === g.STAGES.MAIN_MENU && !g.screenwipe;
  }, null, { timeout: 180000 });
  return page;
}

/** the screen position of a card or of the first visible UI element with this button */
const where = (page, what) => page.evaluate((what) => {
  const G = window.__game.G;
  const k = G.TILESCALE * G.TILESIZE / devicePixelRatio;
  const at = (n) => [(n.T.x + n.T.w / 2 + G.ROOM.T.x) * k, (n.T.y + n.T.h / 2 + G.ROOM.T.y) * k];
  if (what.card) return at(G[what.card[0]].cards[what.card[1]]);
  const find = (n) => {
    if (!n) return null;
    if (n.config?.button === what.button && n.states?.visible) return n;
    for (const c of Object.values(n.children ?? {})) { const r = find(c); if (r) return r; }
    return null;
  };
  for (const box of [G.OVERLAY_MENU, G.buttons, G.blind_select, ...G.I.UIBOX]) {
    const n = box?.UIRoot && find(box.UIRoot);
    if (n) return at(n);
  }
  return null;
}, what);

async function click(page, what) {
  const p = await where(page, what);
  if (!p) await fail(`nothing to click: ${JSON.stringify(what)}`);
  await page.mouse.move(p[0], p[1], { steps: 4 });
  await page.waitForTimeout(150);
  await page.mouse.down();
  await page.waitForTimeout(80);
  await page.mouse.up();
  await page.waitForTimeout(250);
}

const idle = (page, state) => page.waitForFunction((state) => {
  const { G, run } = window.__game;
  return !run.busy && G.STATE === G.STATES[state] && !G.CONTROLLER.locked;
}, state, { timeout: 60000 }).then(() => page.waitForTimeout(1200));

const actions = (page) => page.evaluate(() => {
  const ev = window.__game.recorder.snapshot().events;
  const start = ev.map((e) => e.k).lastIndexOf('run');
  return ev.slice(start).filter((e) => e.k === 'action' && e.phase === 'start').map((e) => JSON.stringify(e.action));
});
const final = (page) => page.evaluate(() => {
  const v = window.__game.run.view;
  return { version: v.version, phase: v.phase, hand: v.hand.map((c) => c.id), dollars: v.dollars, round_score: v.round_score };
});

// ---------------------------------------------------------------- the player
const page = await open(url);
await page.evaluate(() => window.__game.G.FUNCS.start_run(null, { request: { deck: 'b_red', stake: 1 } }));
await idle(page, 'BLIND_SELECT');
await click(page, { button: 'select_blind' });
await idle(page, 'SELECTING_HAND');
for (const i of [0, 1, 2]) await click(page, { card: ['hand', i] });
await click(page, { button: 'play_cards_from_highlighted' });
await idle(page, 'SELECTING_HAND');
// drag the first card to the right end (a move)
const [a, b] = [await where(page, { card: ['hand', 0] }), await where(page, { card: ['hand', 7] })];
await page.mouse.move(a[0], a[1], { steps: 3 });
await page.mouse.down();
await page.mouse.move(b[0] + 40, b[1], { steps: 15 });
await page.mouse.up();
await idle(page, 'SELECTING_HAND');
for (const i of [0, 1]) await click(page, { card: ['hand', i] });
await click(page, { button: 'discard_cards_from_highlighted' });
await idle(page, 'SELECTING_HAND');
for (const i of [3, 4]) await click(page, { card: ['hand', i] });
await click(page, { button: 'play_cards_from_highlighted' });
await idle(page, 'SELECTING_HAND');
const played = await actions(page);
const before = await final(page);
console.log('played:', played.length, 'actions', played.map((s) => JSON.parse(s).type).join(', '));

await page.evaluate(() => console.error(new Error('e2e: something broke')));
await page.waitForSelector('.br-toast', { timeout: 5000 }).catch(() => fail('no toast after an error'));
await page.keyboard.press('F8');
await page.waitForSelector('.br-root textarea', { timeout: 10000 });
await page.fill('.br-root textarea', 'e2e: the cards did something odd');
await page.click('.br-root button[type=submit]');
await page.waitForFunction(() => document.querySelector('.br-status')?.textContent?.startsWith('Thank you'), null, { timeout: 30000 })
  .catch(async () => fail(`not sent: ${await page.textContent('.br-status')}`));
const id = (await page.textContent('.br-status')).match(/Report (\w+)/)[1];
const full = await page.evaluate(async (prefix) => {
  const list = await (await fetch('/reports/v1/reports')).json();
  return list.find((r) => r.id.startsWith(prefix));
}, id);
console.log('report', full.id, '| errors', full.errors, '| screenshot', full.has_screenshot, '| history', full.has_history);

// ---------------------------------------------------------------- the developer
const dev = await open(`${url}?report=${full.id}`);
await dev.waitForFunction(() => /Replay finished|went another way|Couldn't|can't/.test(document.querySelector('.br-hud')?.textContent ?? ''), null, { timeout: 240000 })
  .catch(async () => fail(`replay stuck: ${await dev.textContent('.br-hud')}`));
await idle(dev, 'SELECTING_HAND');
const hud = await dev.textContent('.br-hud');
const replayed = await actions(dev);
const after = await final(dev);
console.log('hud:', hud.replace(/\s+/g, ' ').slice(0, 300));
console.log('replayed:', replayed.length, 'actions');
const same_actions = JSON.stringify(replayed) === JSON.stringify(played);
const same_end = JSON.stringify({ ...after, version: undefined }) === JSON.stringify({ ...before, version: undefined });
console.log('same actions:', same_actions, '| same final run:', same_end, JSON.stringify(before), JSON.stringify(after));
await dev.screenshot({ path: process.env.SHOT ?? '/tmp/report-e2e.png' });
await browser.close();
if (!same_actions || !same_end) process.exit(1);
console.log('OK');
