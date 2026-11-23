// The bar over the game while a run is watched again (/play/?watch=<id>),
// with a seek bar: let go of it at an action, and the run goes on from there.

let root: HTMLElement | null = null;
const parts: Record<string, HTMLElement> = {};

const CSS = `
.wr-hud { position: fixed; top: 8px; left: 50%; transform: translateX(-50%); z-index: 20; display: flex; flex-direction: column;
  gap: 4px; max-width: min(720px, calc(100vw - 32px)); padding: 8px 12px; border-radius: 8px; background: rgba(30, 43, 45, 0.92);
  color: #fff; font: 14px/1.35 system-ui, sans-serif; box-shadow: 0 2px 8px rgba(0, 0, 0, 0.4); }
.wr-hud__row { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; }
.wr-hud__title { font-weight: 700; margin-right: auto; }
.wr-hud__warn { color: #ffb4a8; }
.wr-btn { border: 0; border-radius: 6px; padding: 4px 10px; font: inherit; font-weight: 600; color: #fff; cursor: pointer; background: #5f7377; }
.wr-btn:focus-visible { outline: 2px solid #fff; outline-offset: 2px; }
.wr-btn--blue { background: #0093ff; }
.wr-btn--red { background: #fe5f55; }
.wr-btn[hidden] { display: none; }
.wr-seek { display: flex; align-items: center; gap: 8px; }
.wr-seek input { flex: 1; min-width: 160px; accent-color: #0093ff; }
.wr-seek span { min-width: 9ch; text-align: right; font-variant-numeric: tabular-nums; }
`;

function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls?: string, text?: string): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
}

function button(label: string, cls: string, onclick: () => void) {
  const b = el('button', `wr-btn ${cls}`, label);
  b.type = 'button';
  b.onclick = onclick;
  return b;
}

export interface HudControls {
  pause: () => boolean; // returns the new paused state
  step: () => void;
  speed: () => number; // returns the new speed
  stop: () => void;
  seek: (step: number) => void; // the run from this action on (that many actions played)
}

let seeking = false; // the player holds the seek bar
let seek_bar: HTMLInputElement | null = null;

export const hud = {
  show(controls: HudControls) {
    if (!document.getElementById('wr-style')) {
      const s = el('style');
      s.id = 'wr-style';
      s.textContent = CSS;
      document.head.append(s);
    }
    root?.remove();
    root = el('div', 'wr-hud');
    root.setAttribute('role', 'status');
    const top = el('div', 'wr-hud__row');
    parts.title = el('span', 'wr-hud__title', 'Watching a run');
    parts.progress = el('span', undefined, '');
    const pause = button('Pause', 'wr-btn--blue', () => {
      const paused = controls.pause();
      pause.textContent = paused ? 'Play' : 'Pause';
      step.hidden = !paused;
    });
    const step = button('Next step', '', () => controls.step());
    step.hidden = true;
    const speed = button('Speed', '', () => { speed.textContent = `Speed x${controls.speed()}`; });
    const stop = button('Stop', 'wr-btn--red', () => controls.stop());
    const hide = button('Hide', '', () => root?.remove());
    parts.speed = speed;
    parts.pause = pause;
    parts.step = step;
    top.append(parts.title, parts.progress, pause, step, speed, stop, hide);
    const seek = el('label', 'wr-seek');
    seek_bar = el('input');
    seek_bar.type = 'range';
    seek_bar.min = '0';
    seek_bar.max = '0';
    seek_bar.value = '0';
    seek_bar.setAttribute('aria-label', 'Go to an action');
    const at = el('span', undefined, '');
    parts.seek_at = at;
    const show = () => { at.textContent = `→ ${seek_bar!.value}`; };
    seek_bar.addEventListener('pointerdown', () => { seeking = true; });
    seek_bar.addEventListener('input', () => { seeking = true; show(); });
    seek_bar.addEventListener('change', () => {
      seeking = false;
      at.textContent = '';
      controls.seek(Number(seek_bar!.value));
    });
    seek.append(seek_bar, at);
    parts.msg = el('div');
    parts.warn = el('div', 'wr-hud__warn');
    root.append(top, seek, parts.msg, parts.warn);
    document.body.append(root);
  },
  title(text: string) { if (parts.title) parts.title.textContent = text; },
  speed(x: number) { if (parts.speed) parts.speed.textContent = `Speed x${x}`; },
  progress(done: number, total: number) {
    if (parts.progress) parts.progress.textContent = `${done} / ${total} actions`;
    if (seek_bar && !seeking) {
      seek_bar.max = String(total);
      seek_bar.value = String(done);
    }
  },
  /** paused or not (a seek keeps it) */
  paused(paused: boolean) {
    if (parts.pause) parts.pause.textContent = paused ? 'Play' : 'Pause';
    if (parts.step) (parts.step as HTMLButtonElement).hidden = !paused;
  },
  message(text: string) { if (parts.msg) parts.msg.textContent = text; },
  warn(text: string) { if (parts.warn) parts.warn.textContent = text; },
  /** the replay is over: watch it again, or the main menu (the run is the player's, not the viewer's to play on) */
  ended(actions: { again: () => void; menu: () => void }) {
    if (!root) return;
    for (const b of root.querySelectorAll('.wr-hud__row button')) (b as HTMLButtonElement).hidden = true;
    root.querySelector('.wr-hud__ended')?.remove();
    const row = el('div', 'wr-hud__row wr-hud__ended');
    row.append(button('Watch again', 'wr-btn--blue', actions.again), button('Main menu', '', actions.menu));
    root.append(row);
    if (!root.isConnected) document.body.append(root);
  },
  /** watching again after the end (a seek back): the usual buttons */
  reopen(paused: boolean) {
    if (!root) return;
    root.querySelector('.wr-hud__ended')?.remove();
    for (const b of root.querySelectorAll('.wr-hud__row button')) (b as HTMLButtonElement).hidden = false;
    this.paused(paused);
    this.warn('');
  },
  close() { root?.remove(); root = null; },
};
