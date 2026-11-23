// Entry point: the window, the loading bar, the main loop (love.run) and the
// input events (love.mousepressed, love.keypressed...).
import { G, set_globals, resize } from '@/shared/lib/engine';
import { love, initLove } from '@/shared/lib/love';
import { start_up } from './boot/start-up';
import { ensure_signed_in, name_profile } from './boot/sign-in';
import { register_all } from './boot/register';
import { game_update, game_draw } from './loop/game-loop';
import { show_splash } from '@/pages/splash';
import { main_menu } from '@/pages/main-menu';
import { run } from '@/entities/run';
import { SigningIn } from '@/shared/api';
import { input_state, key_down, key_up, pointer_down, pointer_move, pointer_up, soft_keyboard } from '@/shared/lib/input';
import { recorder } from '@/shared/lib/recorder';
import { pointer_trace } from '@/shared/lib/pointer-trace';
import { register_bug_report_funcs, start_replay_if_asked } from '@/features/bug-report';
import { start_watch_if_asked } from '@/features/watch-run';
import { start_presence } from '@/features/social-presence';
import { open_seed_link_if_asked } from '@/features/seed-link';
import { open_match_link_if_asked } from '@/features/multiplayer';
import { start_notifications } from '@/features/notifications';
import { fill_screen, pixel_ratio, set_up_screen } from './mobile/screen';

const canvas = document.getElementById('screen') as HTMLCanvasElement;

function fit_canvas() {
  const dpr = pixel_ratio();
  const w = Math.max(100, Math.floor(window.innerWidth * dpr));
  const h = Math.max(100, Math.floor(window.innerHeight * dpr));
  if (canvas.width !== w || canvas.height !== h) {
    canvas.width = w;
    canvas.height = h;
    return true;
  }
  return false;
}

/** the window changed size (a phone turned, its browser bars came or went) */
function refit() {
  if (fit_canvas() && G.window_prev) resize(canvas.width, canvas.height);
}

/** boot_timer: the game's loading bar */
function loading_bar(progress: number) {
  const g = love.graphics;
  const w = g.getWidth(), h = g.getHeight();
  g.setCanvas(null);
  g.push();
  g.origin();
  g.setShader();
  g.clear(0, 0, 0, 1);
  g.setColor(0.6, 0.8, 0.9, 1);
  if (progress > 0) g.rectangle('fill', w / 2 - 150, h / 2 - 15, progress * 300, 30);
  g.setColor(1, 1, 1, 1);
  g.setLineWidth(3);
  g.rectangle('line', w / 2 - 150, h / 2 - 15, 300, 30);
  g.pop();
  g.present();
}

function wire_input() {
  const pos = (e: { clientX: number; clientY: number }): [number, number] => {
    const r = canvas.getBoundingClientRect();
    return [(e.clientX - r.left) * canvas.width / r.width, (e.clientY - r.top) * canvas.height / r.height];
  };
  // (during a bug report's replay, the replay is the player)
  const live = () => !input_state.replaying;
  // (a browser may follow a touch with the mouse events of a click: the touch was the input)
  let touched_at = -Infinity;
  const mouse = () => live() && performance.now() - touched_at > 1000;
  canvas.addEventListener('mousemove', (e) => mouse() && pointer_move(...pos(e)));
  canvas.addEventListener('mousedown', (e) => {
    love.audio.resume();
    canvas.focus();
    if (mouse()) pointer_down(...pos(e), e.button);
  });
  window.addEventListener('mouseup', (e) => mouse() && pointer_up(...pos(e), e.button));

  // Touch: the first finger is the pointer (tap = click, hold = hover, slide = drag); a second
  // finger is the right button (it unselects the hand's cards). The page doesn't scroll or zoom.
  let finger: number | null = null;
  let at: [number, number] = [0, 0]; // where it is
  const find = (e: TouchEvent) => Array.from(e.changedTouches).find((t) => t.identifier === finger);
  canvas.addEventListener('touchstart', (e) => {
    e.preventDefault();
    touched_at = performance.now();
    love.audio.resume();
    if (!live()) return;
    for (const t of Array.from(e.changedTouches)) {
      if (finger === null) {
        finger = t.identifier;
        at = pos(t);
        soft_keyboard.touched(...at);
        pointer_move(...at, true);
        pointer_down(...at, 0, true);
      } else {
        pointer_down(...at, 2, true);
      }
    }
  }, { passive: false });
  canvas.addEventListener('touchmove', (e) => {
    e.preventDefault();
    touched_at = performance.now();
    const t = find(e);
    if (!t) return;
    at = pos(t);
    if (live()) pointer_move(...at, true);
  }, { passive: false });
  const lift = (e: TouchEvent) => {
    e.preventDefault();
    touched_at = performance.now();
    // (a finger's lift is what browsers take as the player's gesture: sound, full screen, the keyboard)
    love.audio.resume();
    if (e.type === 'touchend') fill_screen();
    const t = find(e);
    if (!t) return;
    finger = null;
    if (!live()) return;
    const [x, y] = pos(t);
    pointer_up(x, y, 0, true);
    if (e.type === 'touchend') soft_keyboard.tapped(x, y);
  };
  canvas.addEventListener('touchend', lift, { passive: false });
  canvas.addEventListener('touchcancel', lift, { passive: false });
  // (Safari's pinch zoom ignores the viewport's user-scalable=no)
  document.addEventListener('gesturestart', (e) => e.preventDefault());

  canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  window.addEventListener('keydown', (e) => {
    if (input_state.blocked || !live()) return;
    love.audio.resume();
    if (!G.CONTROLLER) return;
    if (e.ctrlKey && e.key.toLowerCase() === 'v' && G.CONTROLLER.text_input_hook) return; // paste below
    key_down(e.key);
    if (['Tab', ' ', 'Backspace', 'ArrowUp', 'ArrowDown'].includes(e.key)) e.preventDefault();
  });
  window.addEventListener('keyup', (e) => live() && key_up(e.key));
  window.addEventListener('paste', (e) => {
    const text = e.clipboardData?.getData('text') ?? '';
    love.system.setClipboardText(text);
  });
  window.addEventListener('resize', refit);
  window.visualViewport?.addEventListener('resize', refit);
}

/** G.STATE and G.STAGE changes, for the recording */
let last_state: unknown = null, last_stage: unknown = null;
function record_state() {
  if (G.STATE === last_state && G.STAGE === last_stage) return;
  const name = (table: Record<string, unknown> | undefined, v: unknown) => Object.keys(table ?? {}).find((k) => table![k] === v) ?? v;
  recorder.record('state', { state: name(G.STATES, G.STATE), stage: name(G.STAGES, G.STAGE) });
  last_state = G.STATE;
  last_stage = G.STAGE;
}

async function main() {
  recorder.install();
  pointer_trace.install();
  await ensure_signed_in();
  fit_canvas();
  initLove(canvas, `${import.meta.env.BASE_URL}resources/sounds`);
  set_globals();
  loading_bar(0);
  await start_up((p) => loading_bar(p));
  name_profile();
  set_up_screen();
  register_all();
  register_bug_report_funcs();
  wire_input();
  show_splash(main_menu);
  void start_replay_if_asked(); // /play/?report=<id> (it waits for the main menu)
  void start_watch_if_asked(); // /play/?watch=<id>
  start_presence(); // friends see what the player is doing (the social service)
  void start_notifications(); // friend requests, messages and invites to a match, as they come
  void open_seed_link_if_asked(); // /play/?seed=<seed>&deck=<deck>&stake=<stake>: a shared seed
  void open_match_link_if_asked(); // /play/?match=<code>: an invite to a multiplayer match
  // the dev server: the game's objects for scripts (scripts/report-e2e.mjs ...)
  if (import.meta.env.DEV) (window as any).__game = { G, run, recorder };

  let dt_smooth = 1 / 100;
  const tick = (dt: number) => {
    dt_smooth = Math.min(0.8 * dt_smooth + 0.2 * dt, 0.1);
    game_update(dt_smooth);
  };

  // ?test: the loop is driven by the page (fixed 1/60 s steps), to compare
  // frames with the original game run the same way (tools/love/refshot)
  if (new URLSearchParams(window.location.search).has('test')) {
    (window as any).__test = {
      G,
      run,
      frame: 0,
      step(n: number, dt = 1 / 60) {
        for (let i = 0; i < n; i++) { this.frame++; tick(dt); soft_keyboard.update(); record_state(); }
        game_draw();
        recorder.after_draw(canvas);
        return this.frame;
      },
    };
    game_draw();
    return;
  }

  let last = performance.now() / 1000;
  const frame = () => {
    const now = performance.now() / 1000;
    const dt = now - last;
    last = now;
    try {
      refit();
      tick(dt);
      soft_keyboard.update();
      record_state();
      game_draw();
      recorder.after_draw(canvas);
    } catch (err) {
      console.error(err);
    }
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}

main().catch((err) => {
  if (err instanceof SigningIn) return; // on the way to the portal's sign-in page
  console.error(err);
  document.body.insertAdjacentHTML('beforeend',
    `<pre style="position:fixed;inset:20px;color:#fff;font:14px monospace;white-space:pre-wrap">${String(err?.stack ?? err)}</pre>`);
});
