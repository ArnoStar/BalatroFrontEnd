// A bot that plays a run through the front end's own buttons (G.FUNCS), to
// catch runtime errors across many actions. Logs page errors and API refusals.
//   node scripts/bot.mjs <url> [actions=80] [seed] [shots_dir]
// BOT_CARDS: the jokers/consumables it starts with; BOT_SKIP: how often it
// skips a blind (0.25), to meet more tags.
import { chromium } from 'playwright-core';

const [url, n = '80', seed = 'BOTSEED1', shots] = process.argv.slice(2);
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM ?? '/usr/bin/chromium',
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
const logs = [];
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') logs.push(`[${m.type()}] ${m.text()}`); });
page.on('pageerror', (e) => logs.push(`[pageerror] ${e.stack ?? e}`));
await page.goto(url);
await page.waitForFunction(() => window.__test, null, { timeout: 120000 });
const step = (k) => page.evaluate((k) => window.__test.step(k), k);
await page.evaluate((p) => { window.__bot_skip = p; }, Number(process.env.BOT_SKIP ?? 0.25));
await step(30);
await page.keyboard.press('Escape');
await step(300);
await page.evaluate((seed) => window.__test.G.FUNCS.start_run(null, { request: { seed, stake: 1, deck: 'b_red' } }), seed);
await page.waitForTimeout(500);
await step(400);
for (const key of (process.env.BOT_CARDS ?? 'j_joker,j_gros_michel,j_hiker,c_mercury,c_magician,j_greedy_joker').split(',')) {
  await page.evaluate((key) => window.__test.G.FUNCS.debug_command({ cmd: 'add_joker', key }), key);
  await page.waitForTimeout(150);
  await step(60);
}
await page.evaluate(() => window.__test.G.FUNCS.debug_command({ cmd: 'cheat', dollars: 60 }));
await page.waitForTimeout(150);
await step(60);

/** waits until no action is in flight and the screen settled */
async function settle(max = 1500) {
  for (let i = 0; i < max; i += 10) {
    const s = await page.evaluate(() => {
      const G = window.__test.G;
      const run = window.__test.run;
      return { busy: run?.busy, state: G.STATE, q: G.E_MANAGER.queues.base.length };
    });
    if (!s.busy && s.q < 12) return s;
    await step(10);
    await page.waitForTimeout(5);
  }
  return null;
}

const ACT = `(() => {
  const G = window.__test.G; const run = window.__test.run; const v = run.view; const S = G.STATES;
  const has = (t) => v.actions.some((a) => a.type === t);
  const rnd = (k) => Math.floor(Math.random() * k);
  if (v.phase === 'blind_select' && G.blind_select && G.STATE === S.BLIND_SELECT) {
    if (has('skip_blind') && Math.random() < window.__bot_skip) {
      const id = G.blind_select_opts[G.GAME.blind_on_deck.toLowerCase()];
      const tag = id && id.get_UIE_by_ID('tag_container');
      if (tag) { G.FUNCS.skip_blind({ UIBox: id }); return 'skip_blind'; }
    }
    G.FUNCS.select_blind({ config: { ref_table: G.P_BLINDS[G.GAME.round_resets.blind_choices[G.GAME.blind_on_deck]] } });
    return 'select_blind';
  }
  if (v.phase === 'playing' && G.STATE === S.SELECTING_HAND && G.buttons) {
    const cons = G.consumeables.cards.find((c) => v.actions.some((a) => a.type === 'use' && a.card === c.api_id));
    if (cons && Math.random() < 0.5) {
      const a = v.actions.find((x) => x.type === 'use' && x.card === cons.api_id);
      G.hand.unhighlight_all();
      for (let i = 0; i < (a.min_targets || 0); i++) G.hand.add_to_highlighted(G.hand.cards[i], true);
      G.FUNCS.use_card({ config: { ref_table: cons } });
      return 'use ' + cons.ability.name;
    }
    if (v.hands_left <= 2 && !window.__bot_lose) { G.FUNCS.debug_command({ cmd: 'cheat', win: true }); return 'cheat win'; }
    const sell = G.jokers.cards.length > 3 && Math.random() < 0.1 ? G.jokers.cards[0] : null;
    if (sell) { G.FUNCS.sell_card({ config: { ref_table: sell } }); return 'sell ' + sell.ability.name; }
    G.hand.unhighlight_all();
    const k = 1 + rnd(5);
    for (let i = 0; i < Math.min(k, G.hand.cards.length); i++) G.hand.add_to_highlighted(G.hand.cards[i], true);
    if (has('discard') && Math.random() < 0.3) { G.FUNCS.discard_cards_from_highlighted(); return 'discard ' + k; }
    return 'play-wait';
  }
  if (v.phase === 'round_eval') {
    const b = [...G.I.UIBOX].map((u) => u.get_UIE_by_ID && u.get_UIE_by_ID('cash_out_button')).find((x) => x);
    if (b) { G.FUNCS.cash_out(b); return 'cash_out'; }
    return 'wait-eval';
  }
  if (v.phase === 'shop' && G.STATE === S.SHOP && G.shop_jokers) {
    const buys = v.actions.filter((a) => a.type === 'buy');
    if (buys.length && Math.random() < 0.6) {
      const a = buys[rnd(buys.length)];
      const area = a.area === 'shop' ? G.shop_jokers : a.area === 'vouchers' ? G.shop_vouchers : G.shop_booster;
      const card = area.cards.find((c) => c.api_id === a.card);
      if (card) {
        if (a.area === 'shop') G.FUNCS.buy_from_shop({ config: { ref_table: card, id: a.use ? 'buy_and_use' : null } });
        else G.FUNCS.use_card({ config: { ref_table: card } });
        return 'buy ' + card.ability.name + (a.use ? ' (use)' : '');
      }
    }
    if (has('reroll') && Math.random() < 0.2) { G.FUNCS.reroll_shop(); return 'reroll'; }
    G.FUNCS.toggle_shop(); return 'end_shop';
  }
  if (v.phase === 'pack' && G.pack_cards && G.pack_cards.cards.length) {
    const picks = v.actions.filter((a) => a.type === 'pick');
    if (picks.length && Math.random() < 0.8) {
      const a = picks[0];
      const card = G.pack_cards.cards.find((c) => c.api_id === a.card);
      if (card) {
        G.hand.unhighlight_all();
        for (let i = 0; i < (a.min_targets || 0); i++) G.hand.add_to_highlighted(G.hand.cards[i], true);
        G.FUNCS.use_card({ config: { ref_table: card } });
        return 'pick ' + card.ability.name;
      }
    }
    G.FUNCS.skip_booster(); return 'skip_pack';
  }
  if (v.phase === 'game_over') return 'game_over';
  return 'wait ' + v.phase + ' ' + G.STATE;
})()`;

let done = 0;
let waits = 0;
for (let i = 0; i < Number(n) * 4 && done < Number(n); i++) {
  const s = await settle();
  if (!s) { logs.push('[bot] stuck: ' + JSON.stringify(await page.evaluate(() => ({ s: window.__test.G.STATE, p: window.__test.run.view?.phase, q: window.__test.G.E_MANAGER.queues.base.length })))); break; }
  // the HUD's tags must be the API's once the screen has settled (the game's
  // own events can still be running when a slow answer's events are done)
  const tags_differ = () => page.evaluate(() => {
    const G = window.__test.G;
    const hud = (G.GAME.tags ?? []).filter((t) => !t.triggered).map((t) => t.key).sort().join(',');
    const api = (window.__test.run.view?.tags ?? []).map((t) => t.key).sort().join(',');
    return hud === api ? null : `hud [${hud}] api [${api}]`;
  });
  if (await tags_differ()) {
    await step(180);
    const tags = await tags_differ();
    if (tags) logs.push(`[tags] after action ${done}: ${tags}`);
  }
  let r = await page.evaluate(ACT);
  if (r === 'play-wait') {
    await page.waitForTimeout(150); // the preview's answer (scoring cards)
    r = await page.evaluate(() => { window.__test.G.FUNCS.play_cards_from_highlighted(); return 'play'; });
  }
  await page.waitForTimeout(120);
  if (r.startsWith('wait')) { waits++; await step(30); if (waits > 200) { logs.push('[bot] too many waits ' + r); break; } continue; }
  done++;
  console.log(String(done).padStart(3), r);
  if (shots && done % 10 === 0) await page.screenshot({ path: `${shots}/bot_${done}.png` });
  if (r === 'game_over') break;
  await step(20);
}
const v = await page.evaluate(() => ({ phase: window.__test.run.view?.phase, ante: window.__test.run.view?.ante, round: window.__test.run.view?.round }));
console.log('end', JSON.stringify(v));
console.log(logs.join('\n'));
await browser.close();
