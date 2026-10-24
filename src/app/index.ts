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

const LOVE_KEYS: Record<string, string> = {
  Escape: 'escape', Enter: 'return', NumpadEnter: 'kpenter', Backspace: 'backspace', Delete: 'delete', Tab: 'tab',
  ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down', ' ': 'space', Shift: 'lshift', CapsLock: 'capslock',
  Control: 'lctrl', Alt: 'lalt',
};

function love_key(e: KeyboardEvent) {
  if (LOVE_KEYS[e.key]) return LOVE_KEYS[e.key];
  if (e.key.length === 1) return e.key.toLowerCase();
  return e.key.toLowerCase();
}

function wire_input() {
  const dpr = () => window.devicePixelRatio || 1;
  const pos = (e: MouseEvent): [number, number] => {
    const r = canvas.getBoundingClientRect();
    return [(e.clientX - r.left) * dpr(), (e.clientY - r.top) * dpr()];
  };
  canvas.addEventListener('mousemove', (e) => {
    [love.mouse.x, love.mouse.y] = pos(e);
    G.CONTROLLER?.set_HID_flags('mouse');
  });
  canvas.addEventListener('mousedown', (e) => {
    love.audio.resume();
    canvas.focus();
    const [x, y] = pos(e);
    love.mouse.x = x; love.mouse.y = y;
    G.CONTROLLER.set_HID_flags('mouse');
    if (e.button === 0) G.CONTROLLER.queue_L_cursor_press(x, y);
    if (e.button === 2) G.CONTROLLER.queue_R_cursor_press(x, y);
  });
  window.addEventListener('mouseup', (e) => {
    if (e.button === 0 && G.CONTROLLER) {
      const [x, y] = pos(e);
      G.CONTROLLER.L_cursor_release(x, y);
    }
  });
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  window.addEventListener('keydown', (e) => {
    love.audio.resume();
    if (!G.CONTROLLER) return;
    if (e.ctrlKey && e.key.toLowerCase() === 'v' && G.CONTROLLER.text_input_hook) return; // paste below
    const key = love_key(e);
    G.CONTROLLER.set_HID_flags('mouse');
    if (G.CONTROLLER.text_input_hook && e.key.length === 1) {
      // typed characters keep their case and symbols
      G.CONTROLLER.key_press(e.key);
    } else {
      G.CONTROLLER.key_press(key);
    }
    if (['Tab', ' ', 'Backspace', 'ArrowUp', 'ArrowDown'].includes(e.key)) e.preventDefault();
  });
  window.addEventListener('keyup', (e) => {
    if (!G.CONTROLLER) return;
    const key = G.CONTROLLER.text_input_hook && e.key.length === 1 ? e.key : love_key(e);
    G.CONTROLLER.key_release(key);
  });
  window.addEventListener('paste', (e) => {
    const text = e.clipboardData?.getData('text') ?? '';
    love.system.setClipboardText(text);
  });
  window.addEventListener('resize', () => {
    if (fit_canvas() && G.window_prev) resize(canvas.width, canvas.height);
  });
}

async function main() {
  await ensure_signed_in();
  fit_canvas();
  initLove(canvas, `${import.meta.env.BASE_URL}resources/sounds`);
  set_globals();
  loading_bar(0);
  await start_up((p) => loading_bar(p));
  name_profile();
  register_all();
  wire_input();
  show_splash(main_menu);

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
        for (let i = 0; i < n; i++) { this.frame++; tick(dt); }
        game_draw();
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
      game_draw();
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
