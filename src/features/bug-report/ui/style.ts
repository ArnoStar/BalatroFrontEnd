// The report dialog's and the replay bar's look: the game's colours (G.C)
// and its pixel font (m6x11plus, copied from the game by `npm run assets`).
const CSS = `
@font-face { font-family: 'm6x11'; src: url('${import.meta.env.BASE_URL}resources/fonts/m6x11plus.ttf'); }
.br-root { position: fixed; inset: 0; z-index: 50; display: grid; grid-template-columns: minmax(0, auto); place-content: safe center; padding: 16px; overflow-y: auto;
  background: rgba(0, 0, 0, 0.55); font: 22px/1.25 m6x11, 'Trebuchet MS', system-ui, sans-serif; color: #fff; }
.br-panel { box-sizing: border-box; width: min(560px, calc(100vw - 32px)); display: grid; gap: 10px;
  padding: 18px 20px; border-radius: 14px; background: #3a5055; border: 3px solid #1e2b2d;
  box-shadow: 0 8px 0 rgba(0, 0, 0, 0.45); }
.br-panel h2 { margin: 0; font-size: 34px; font-weight: normal; letter-spacing: 1px; text-shadow: 2px 2px 0 #1e2b2d; }
.br-panel label { color: #dfe8e9; }
.br-panel textarea { width: 100%; min-height: 120px; resize: vertical; box-sizing: border-box; padding: 10px;
  border: 2px solid #1e2b2d; border-radius: 8px; color: #fff; background: #1e2b2d; font: inherit; font-size: 20px; }
.br-panel textarea:focus-visible, .br-btn:focus-visible, .br-check input:focus-visible { outline: 3px solid #eac058; outline-offset: 2px; }
.br-check { display: flex; align-items: center; gap: 8px; cursor: pointer; }
.br-check input { width: 20px; height: 20px; accent-color: #009dff; }
.br-shot { width: 100%; max-height: 24vh; object-fit: contain; border-radius: 8px; border: 2px solid #1e2b2d; background: #1e2b2d; }
.br-what { margin: 0; color: #b7c3c5; font-size: 18px; }
.br-status { margin: 0; min-height: 1.25em; }
.br-status--error { color: #fe5f55; }
.br-status--ok { color: #4bc292; }
.br-buttons { display: flex; justify-content: flex-end; gap: 10px; flex-wrap: wrap; }
.br-btn { min-width: 110px; padding: 8px 18px; border: 0; border-radius: 10px; color: #fff; font: inherit; cursor: pointer; }
.br-btn:disabled { opacity: 0.55; cursor: default; }
.br-btn--grey { background: #5f7377; box-shadow: 0 4px 0 #3b4a4d; }
.br-btn--red { background: #fe5f55; box-shadow: 0 4px 0 #a8403a; }
.br-btn--blue { background: #009dff; box-shadow: 0 4px 0 #0069ad; }
.br-btn:active:not(:disabled) { transform: translateY(3px); box-shadow: 0 1px 0 rgba(0, 0, 0, 0.4); }
.br-toast { position: fixed; left: 16px; bottom: 16px; z-index: 40; display: flex; align-items: center; gap: 12px;
  max-width: calc(100vw - 32px); padding: 10px 14px; border-radius: 12px; background: #3a5055; border: 3px solid #1e2b2d;
  box-shadow: 0 6px 0 rgba(0, 0, 0, 0.45); font: 20px/1.2 m6x11, 'Trebuchet MS', system-ui, sans-serif; color: #fff; }
.br-hud { position: fixed; left: 50%; top: 10px; z-index: 40; transform: translateX(-50%); display: grid; gap: 4px;
  width: min(760px, calc(100vw - 32px)); padding: 10px 14px; border-radius: 12px; background: rgba(30, 43, 45, 0.92);
  border: 3px solid #009dff; font: 19px/1.2 m6x11, 'Trebuchet MS', system-ui, sans-serif; color: #fff; }
.br-hud__row { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
.br-hud__title { color: #009dff; }
.br-hud__desc { color: #dfe8e9; overflow-wrap: anywhere; }
.br-hud__warn { color: #fda200; overflow-wrap: anywhere; }
.br-hud .br-btn { min-width: 0; padding: 4px 12px; margin-left: auto; }
.br-hud .br-btn + .br-btn { margin-left: 0; }
`;

let added = false;

export function add_style() {
  if (added) return;
  added = true;
  const s = document.createElement('style');
  s.textContent = CSS;
  document.head.append(s);
}

/** an element with text (never HTML: report texts are the players') */
export function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls?: string, text?: string): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
}
