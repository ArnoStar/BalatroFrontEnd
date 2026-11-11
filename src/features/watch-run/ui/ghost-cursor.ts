// The player's pointer while a run is watched again: where the player's own
// pointer went (a recorded trace, placed point by point), or, for runs played
// before traces were kept, a hand-like glide to each card and button the
// action needs, in the player's order.
import { G } from '@/shared/lib/engine';
import { to_screen } from '@/shared/lib/input';

const CSS = `
.wr-cursor { position: fixed; left: 0; top: 0; z-index: 19; pointer-events: none; will-change: transform;
  filter: drop-shadow(0 2px 2px rgba(0, 0, 0, 0.5)); }
.wr-cursor[hidden] { display: none; }
.wr-cursor svg { display: block; }
.wr-cursor__ring { position: absolute; left: -13px; top: -13px; width: 26px; height: 26px; box-sizing: border-box;
  border: 3px solid #fff; border-radius: 50%; opacity: 0; }
.wr-cursor--click .wr-cursor__ring { animation: wr-click 0.35s ease-out; }
@keyframes wr-click { from { transform: scale(0.3); opacity: 0.9; } to { transform: scale(1.15); opacity: 0; } }
@media (prefers-reduced-motion: reduce) { .wr-cursor--click .wr-cursor__ring { animation-duration: 0.01s; } }
`;

// an arrow whose tip is at (1, 1)
const ARROW = `<svg width="18" height="26" viewBox="0 0 18 26" aria-hidden="true">
<path d="M1 1 L1 20 L5.6 15.6 L8.8 23.4 L12.2 22 L9 14.4 L15.4 14.4 Z" fill="#fff" stroke="#1e2b2d" stroke-width="1.6" stroke-linejoin="round"/></svg>`;

let root: HTMLElement | null = null;
let at: [number, number] = [0, 0];

function place(x: number, y: number) {
  at = [x, y];
  if (root) root.style.transform = `translate(${x - 1}px, ${y - 1}px)`;
}

/** a point in game units (the room's coordinates) in the page's pixels */
function page_point(gx: number, gy: number): [number, number] | null {
  const canvas = document.getElementById('screen') as HTMLCanvasElement | null;
  if (!G.ROOM || !canvas?.width) return null;
  const [px, py] = to_screen(gx, gy);
  const r = canvas.getBoundingClientRect();
  return [r.left + (px * r.width) / canvas.width, r.top + (py * r.height) / canvas.height];
}

/** the middle of a card or UI element in the page's pixels (null: gone, or not on the screen yet) */
export function point_of(node: any): [number, number] | null {
  const T = node?.VT ?? node?.T;
  if (!T || node.REMOVED) return null;
  return page_point(T.x + T.w / 2, T.y + T.h / 2);
}

let glides = 0;

/** waits `ms` of time that isn't `held` */
export function wait(ms: number, held: () => boolean): Promise<void> {
  return new Promise((resolve) => {
    let last = performance.now();
    let left = ms;
    const frame = (now: number) => {
      if (!held()) left -= now - last;
      last = now;
      if (left <= 0) resolve(); else requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  });
}

export const ghost = {
  show() {
    if (!document.getElementById('wr-cursor-style')) {
      const s = document.createElement('style');
      s.id = 'wr-cursor-style';
      s.textContent = CSS;
      document.head.append(s);
    }
    if (!root) {
      root = document.createElement('div');
      root.className = 'wr-cursor';
      root.innerHTML = `${ARROW}<span class="wr-cursor__ring"></span>`;
      document.body.append(root);
      place(window.innerWidth / 2, window.innerHeight / 2);
    }
    root.hidden = false;
  },

  hide() { if (root) root.hidden = true; },

  /** puts the pointer where the player's was (game units) */
  place_game(gx: number, gy: number) {
    const p = page_point(gx, gy);
    if (p) place(p[0], p[1]);
  },

  /**
   * Glides to `node` in about `ms` of time that isn't `held` (it follows the
   * node while it moves): longer for a longer way, on a slight curve, slow at
   * both ends and fast in the middle, as a hand moves a mouse.
   */
  move(node: any, ms: number, held: () => boolean): Promise<void> {
    const from = at;
    const first = point_of(node);
    const dist = first ? Math.hypot(first[0] - from[0], first[1] - from[1]) : 0;
    const total = ms * (0.55 + Math.min(0.9, dist / 900));
    // the curve's side and depth change from one glide to the next
    const n = ++glides;
    const bend = (((n * 7919) % 13) / 13 - 0.5) * 0.35;
    return new Promise((resolve) => {
      let last = performance.now();
      let done = 0;
      const frame = (now: number) => {
        if (!held()) done += now - last;
        last = now;
        const to = point_of(node);
        if (!to) { resolve(); return; }
        const k = Math.min(1, done / Math.max(1, total));
        const e = k * k * k * (10 - 15 * k + 6 * k * k); // a hand's reach (minimum jerk)
        const dx = to[0] - from[0], dy = to[1] - from[1];
        const off = bend * Math.sin(Math.PI * e);
        place(from[0] + dx * e - dy * off, from[1] + dy * e + dx * off);
        if (k >= 1) { place(to[0], to[1]); resolve(); } else requestAnimationFrame(frame);
      };
      requestAnimationFrame(frame);
    });
  },

  click() {
    if (!root) return;
    root.classList.remove('wr-cursor--click');
    void root.offsetWidth; // restarts the ring's animation
    root.classList.add('wr-cursor--click');
  },
};
