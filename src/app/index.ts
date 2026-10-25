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
import { input_state, key_down, key_up, pointer_down, pointer_move, pointer_up } from '@/shared/lib/input';
import { recorder } from '@/shared/lib/recorder';
import { register_bug_report_funcs, start_replay_if_asked } from '@/features/bug-report';

const canvas = document.getElementById('screen') as HTMLCanvasElement;

function fit_canvas() {
  const dpr = window.devicePixelRatio || 1;
  const w = Math.max(100, Math.floor(window.innerWidth * dpr));
  const h = Math.max(100, Math.floor(window.innerHeight * dpr));
  if (canvas.width !== w || canvas.height !== h) {
    canvas.width = w;
    canvas.height = h;
    return true;
  }
  return false;
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
  const dpr = () => window.devicePixelRatio || 1;
  const pos = (e: MouseEvent): [number, number] => {
    const r = canvas.getBoundingClientRect();
    return [(e.clientX - r.left) * dpr(), (e.clientY - r.top) * dpr()];
  };
  // (during a bug report's replay, the replay is the player)
  const live = () => !input_state.replaying;
  canvas.addEventListener('mousemove', (e) => live() && pointer_move(...pos(e)));
  canvas.addEventListener('mousedown', (e) => {
    love.audio.resume();
    canvas.focus();
    if (live()) pointer_down(...pos(e), e.button);
  });
  window.addEventListener('mouseup', (e) => live() && pointer_up(...pos(e), e.button));
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
  window.addEventListener('resize', () => {
    if (fit_canvas() && G.window_prev) resize(canvas.width, canvas.height);
  });
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
  await ensure_signed_in();
  fit_canvas();
  initLove(canvas, `${import.meta.env.BASE_URL}resources/sounds`);
  set_globals();
  loading_bar(0);
  await start_up((p) => loading_bar(p));
  name_profile();
  register_all();
  register_bug_report_funcs();
  wire_input();
  show_splash(main_menu);
  void start_replay_if_asked(); // /play/?report=<id> (it waits for the main menu)
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
        for (let i = 0; i < n; i++) { this.frame++; tick(dt); record_state(); }
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
      tick(dt);
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
