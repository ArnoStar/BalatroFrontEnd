// Headless screenshots of the front end (system Chromium + playwright-core).
//   node scripts/shot.mjs <url> <out.png> [waitMs] [width] [height] [script.js]
import { chromium } from 'playwright-core';
import { readFileSync } from 'node:fs';

const [url, out, wait = '3000', w = '1600', h = '900', script] = process.argv.slice(2);
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM ?? '/usr/bin/chromium',
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'],
});
const page = await browser.newPage({ viewport: { width: Number(w), height: Number(h) }, deviceScaleFactor: 1 });
page.setDefaultTimeout(600000);
const logs = [];
page.on('console', (m) => logs.push(`[${m.type()}] ${m.text()}`));
page.on('response', (r) => { if (r.status() >= 400) logs.push(`[http ${r.status()}] ${r.url()}`); });
page.on('pageerror', (e) => logs.push(`[pageerror] ${e.stack ?? e}`));
await page.goto(url);
if (url.includes('test')) await page.waitForFunction(() => window.__test, null, { timeout: 120000 });
if (script) {
  const steps = JSON.parse(readFileSync(script, 'utf8'));
  for (const s of steps) {
    if (s.wait) await page.waitForTimeout(s.wait);
    if (s.click) await page.mouse.click(s.click[0], s.click[1]);
    if (s.button) {
      // the first UI element whose config.button is s.button (overlay first)
      const pos = await page.evaluate((name) => {
        const G = window.__test.G;
        const k = G.TILESCALE * G.TILESIZE;
        const find = (n) => {
          if (!n) return null;
          if (n.config && n.config.button === name && n.states && n.states.visible) return n;
          for (const c of (n.children ? Object.values(n.children) : [])) { const r = find(c); if (r) return r; }
          return null;
        };
        const boxes = [G.OVERLAY_MENU, ...G.I.UIBOX].filter((b) => b && b.UIRoot);
        for (const b of boxes) {
          const n = find(b.UIRoot);
          if (n) return [(n.T.x + n.T.w / 2 + G.ROOM.T.x) * k / devicePixelRatio, (n.T.y + n.T.h / 2 + G.ROOM.T.y) * k / devicePixelRatio];
        }
        return null;
      }, s.button);
      if (!pos) logs.push('[step] button not found: ' + s.button);
      else { await page.mouse.move(pos[0], pos[1]); await page.evaluate(() => window.__test.step(3)); await page.mouse.click(pos[0], pos[1]); }
    }
    if (s.ui || s.card) {
      // a UI element (by id, in a G box) or a card (area, index), in screen pixels
      const pos = await page.evaluate(([ui, card]) => {
        const G = window.__test.G;
        const k = G.TILESCALE * G.TILESIZE;
        let n = null;
        if (ui) {
          const boxes = ui[0] ? [G[ui[0]]] : [...G.I.UIBOX];
          for (const b of boxes) { n = b && b.get_UIE_by_ID ? b.get_UIE_by_ID(ui[1]) : null; if (n) break; }
        } else n = G[card[0]].cards[card[1]];
        if (!n) return null;
        return [(n.T.x + n.T.w / 2 + G.ROOM.T.x) * k / devicePixelRatio, (n.T.y + n.T.h / 2 + G.ROOM.T.y) * k / devicePixelRatio];
      }, [s.ui ?? null, s.card ?? null]);
      if (!pos) logs.push('[step] not found: ' + JSON.stringify(s.ui ?? s.card));
      else { await page.mouse.move(pos[0], pos[1]); await page.evaluate(() => window.__test.step(3)); await page.mouse.click(pos[0], pos[1]); }
    }
    if (s.move) await page.mouse.move(s.move[0], s.move[1]);
    if (s.key) await page.keyboard.press(s.key);
    if (s.step) await page.evaluate((n) => window.__test.step(n), s.step);
    if (s.eval) logs.push('[eval] ' + JSON.stringify(await page.evaluate(s.eval)));
    if (s.shot) await page.screenshot({ path: s.shot });
  }
}
await page.waitForTimeout(Number(wait));
await page.screenshot({ path: out });
console.log(logs.join('\n'));
await browser.close();
