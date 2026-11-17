// The multiplayer screens' look: the game's colours (G.C) and its pixel font
// (m6x11plus), as the bug report's dialog.
const CSS = `
@font-face { font-family: 'm6x11'; src: url('${import.meta.env.BASE_URL}resources/fonts/m6x11plus.ttf'); }
.mp-root { position: fixed; inset: 0; z-index: 45; display: grid; place-content: safe center; padding: 16px; overflow-y: auto;
  background: rgba(0, 0, 0, 0.55); font: 22px/1.25 m6x11, 'Trebuchet MS', system-ui, sans-serif; color: #fff; }
.mp-panel { box-sizing: border-box; width: min(620px, calc(100vw - 32px)); display: grid; gap: 12px; padding: 18px 20px;
  border-radius: 14px; background: #3a5055; border: 3px solid #1e2b2d; box-shadow: 0 8px 0 rgba(0, 0, 0, 0.45); }
.mp-panel h2 { margin: 0; font-size: 38px; font-weight: normal; letter-spacing: 1px; text-shadow: 2px 2px 0 #1e2b2d; }
.mp-panel h3 { margin: 0; font-size: 26px; font-weight: normal; color: #dfe8e9; }
.mp-panel p { margin: 0; color: #dfe8e9; font-size: 19px; }
.mp-modes { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
.mp-mode { display: grid; gap: 8px; align-content: start; padding: 12px; border-radius: 10px; background: #1e2b2d; }
.mp-mode--off { opacity: 0.55; }
.mp-mode__name { font-size: 30px; }
.mp-mode--pvp .mp-mode__name { color: #fe5f55; }
.mp-mode--coop .mp-mode__name { color: #009dff; }
.mp-rules { font-size: 17px !important; color: #b7c3c5 !important; }
.mp-row { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
.mp-row > label { min-width: 90px; color: #dfe8e9; }
.mp-input, .mp-select { box-sizing: border-box; padding: 6px 10px; border: 2px solid #1e2b2d; border-radius: 8px; color: #fff;
  background: #1e2b2d; font: inherit; font-size: 20px; }
.mp-input { width: 9em; text-transform: uppercase; letter-spacing: 2px; }
.mp-input:focus-visible, .mp-select:focus-visible, .mp-btn:focus-visible { outline: 3px solid #eac058; outline-offset: 2px; }
.mp-code { font-size: 44px; letter-spacing: 6px; color: #eac058; text-shadow: 2px 2px 0 #1e2b2d; }
.mp-players { display: grid; gap: 6px; margin: 0; padding: 0; list-style: none; }
.mp-players li { display: flex; gap: 8px; align-items: center; padding: 6px 10px; border-radius: 8px; background: #1e2b2d; }
.mp-tag { padding: 0 6px; border-radius: 6px; font-size: 16px; background: #5f7377; }
.mp-tag--host { background: #eac058; color: #1e2b2d; }
.mp-dim { color: #b7c3c5; }
.mp-status { margin: 0; min-height: 1.25em; }
.mp-status--error { color: #fe5f55; }
.mp-buttons { display: flex; justify-content: flex-end; gap: 10px; flex-wrap: wrap; }
.mp-btn { min-width: 110px; padding: 8px 18px; border: 0; border-radius: 10px; color: #fff; font: inherit; cursor: pointer; }
.mp-btn:disabled { opacity: 0.55; cursor: default; }
.mp-btn--grey { background: #5f7377; box-shadow: 0 4px 0 #3b4a4d; }
.mp-btn--red { background: #fe5f55; box-shadow: 0 4px 0 #a8403a; }
.mp-btn--blue { background: #009dff; box-shadow: 0 4px 0 #0069ad; }
.mp-btn--orange { background: #fda200; box-shadow: 0 4px 0 #a86c00; }
.mp-btn--green { background: #4bc292; box-shadow: 0 4px 0 #2f7c5d; }
.mp-btn:active:not(:disabled) { transform: translateY(3px); box-shadow: 0 1px 0 rgba(0, 0, 0, 0.4); }

/* (between the consumables and the deck, right of the hand) */
.mp-hud { position: fixed; right: 0.6vw; top: 27vh; z-index: 30; box-sizing: border-box; width: max(190px, 16.5vw);
  max-height: 45vh; overflow-y: auto; display: grid; gap: 5px; padding: 8px 10px; border-radius: 12px; background: rgba(30, 43, 45, 0.92);
  border: 3px solid #fe5f55; font: 16px/1.15 m6x11, 'Trebuchet MS', system-ui, sans-serif; color: #fff; pointer-events: auto; }
.mp-hud--min .mp-hud__more { display: none; }
.mp-hud__top { display: flex; align-items: center; gap: 6px; }
.mp-hud__title { color: #fe5f55; font-size: 20px; margin-right: auto; }
.mp-hud__tiny { border: 0; border-radius: 6px; padding: 0 8px; font: inherit; color: #fff; background: #5f7377; cursor: pointer; }
.mp-bar { display: grid; grid-template-columns: 4.6em 1fr 2em; align-items: center; gap: 6px; }
.mp-bar__name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.mp-bar__track { position: relative; height: 12px; border-radius: 6px; background: #1e2b2d; overflow: hidden; }
.mp-bar__fill { position: absolute; inset: 0 auto 0 0; border-radius: 6px; background: #4bc292; transition: width 0.6s ease; }
.mp-bar--them .mp-bar__fill { background: #fe5f55; }
.mp-bar__hp { text-align: right; }
.mp-hit { animation: mp-hit 0.9s ease; }
@keyframes mp-hit { 0%, 100% { transform: none; } 20% { transform: translateX(-4px); color: #fe5f55; } 40% { transform: translateX(4px); } }
.mp-hud__safe { font-size: 15px; color: #b7c3c5; }
.mp-hud__opp { display: grid; gap: 2px; padding: 5px 7px; border-radius: 8px; background: #1e2b2d; font-size: 15px; }
.mp-hud__opp b { font-weight: normal; color: #eac058; }
.mp-hud__jokers { display: flex; flex-wrap: wrap; gap: 3px; }
.mp-chip { padding: 0 5px; border-radius: 5px; background: #3a5055; font-size: 14px; }
.mp-chip--foil { background: #3b6c9c; } .mp-chip--holo { background: #8a4a6c; } .mp-chip--polychrome { background: #6a6a2a; }
.mp-chip--negative { background: #111; }
.mp-hud__status { padding: 5px 7px; border-radius: 8px; background: #3a5055; font-size: 15px; }
.mp-hud__status:empty { display: none; }
.mp-hud__status--urgent { background: #a8403a; }
.mp-hud__result { font-size: 15px; color: #dfe8e9; }
.mp-toast { position: fixed; left: 50%; top: 14px; z-index: 46; transform: translateX(-50%); padding: 10px 16px; border-radius: 12px;
  background: #3a5055; border: 3px solid #1e2b2d; box-shadow: 0 6px 0 rgba(0, 0, 0, 0.45); font: 21px/1.25 m6x11, system-ui, sans-serif;
  color: #fff; text-align: center; transition: opacity 0.4s; max-width: calc(100vw - 32px); }
.mp-toast b { font-weight: normal; color: #fe5f55; }
.mp-toast--corner { left: 16px; top: 16px; transform: none; }
.mp-end { text-align: center; }
.mp-end h2 { font-size: 64px; }
.mp-end--win h2 { color: #eac058; }
.mp-end--lose h2 { color: #fe5f55; }
`;

let added = false;

export function add_style() {
  if (added) return;
  added = true;
  const s = document.createElement('style');
  s.textContent = CSS;
  document.head.append(s);
}

/** an element with text (never HTML: names are the players') */
export function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls?: string, text?: string): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
}

export function button(label: string, cls: string, onclick: () => void): HTMLButtonElement {
  const b = el('button', `mp-btn ${cls}`, label);
  b.type = 'button';
  b.onclick = onclick;
  return b;
}

let toast_el: HTMLElement | null = null;
let toast_timer: ReturnType<typeof setTimeout> | null = null;

/** a short message at the top of the screen */
export function toast(lines: (string | [string, boolean])[], ms = 4500) {
  add_style();
  toast_el?.remove();
  if (toast_timer) clearTimeout(toast_timer);
  const t = el('div', 'mp-toast');
  t.setAttribute('role', 'status');
  for (const line of lines) {
    const row = el('div');
    if (Array.isArray(line)) row.append(line[1] ? el('b', undefined, line[0]) : line[0]);
    else row.textContent = line;
    t.append(row);
  }
  document.body.append(t);
  toast_el = t;
  toast_timer = setTimeout(() => {
    t.style.opacity = '0';
    setTimeout(() => t.remove(), 450);
  }, ms);
}
