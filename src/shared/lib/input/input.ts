// The player's input, as love.mousepressed/love.keypressed... (main.lua): the
// page's listeners (app) and a bug report's replay (features/bug-report) both
// come through here, and every input is recorded (shared/lib/recorder) in
// game units, so a replay hits the same things on any screen size.
import { G } from '@/shared/lib/engine';
import { love } from '@/shared/lib/love';
import { recorder } from '@/shared/lib/recorder';

/** `blocked` (a report dialog is open): the game gets no input. `replaying`
 *  (a bug report's replay): the page's own events are ignored, the replay's go in */
export const input_state = { blocked: false, replaying: false };

const LOVE_KEYS: Record<string, string> = {
  Escape: 'escape', Enter: 'return', NumpadEnter: 'kpenter', Backspace: 'backspace', Delete: 'delete', Tab: 'tab',
  ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down', ' ': 'space', Shift: 'lshift', CapsLock: 'capslock',
  Control: 'lctrl', Alt: 'lalt',
};

export function love_key(key: string) {
  if (LOVE_KEYS[key]) return LOVE_KEYS[key];
  return key.toLowerCase();
}

const MOVE_EVERY = 1 / 30; // pointer moves recorded at most this often, unless a button is held (drags)
let last_move = -1;
let held = false;

function scale() {
  return G.TILESCALE * G.TILESIZE;
}

/** canvas pixels → game units (the room's coordinates), or null before the room exists */
export function to_game(x: number, y: number): [number, number] | null {
  if (!G.ROOM || !G.TILESCALE) return null;
  const k = scale();
  return [Math.round((x / k - G.ROOM.T.x) * 1000) / 1000, Math.round((y / k - G.ROOM.T.y) * 1000) / 1000];
}

/** game units → canvas pixels (on this screen) */
export function to_screen(gx: number, gy: number): [number, number] {
  const k = scale();
  return [(gx + G.ROOM.T.x) * k, (gy + G.ROOM.T.y) * k];
}

/** the game frame an input arrived in: inputs of different frames are replayed in different frames */
function frame() {
  return G.FRAMES?.MOVE ?? 0;
}

function record(type: string, x: number, y: number, extra: Record<string, unknown> = {}) {
  const g = to_game(x, y);
  if (g) recorder.record('input', { type, x: g[0], y: g[1], f: frame(), ...extra });
}

export function pointer_move(x: number, y: number) {
  if (input_state.blocked) return;
  love.mouse.x = x;
  love.mouse.y = y;
  G.CONTROLLER?.set_HID_flags('mouse');
  const t = recorder.now();
  if (held || t - last_move >= MOVE_EVERY) {
    last_move = t;
    record('move', x, y);
  }
}

export function pointer_down(x: number, y: number, button: number) {
  if (input_state.blocked || !G.CONTROLLER) return;
  love.mouse.x = x;
  love.mouse.y = y;
  G.CONTROLLER.set_HID_flags('mouse');
  record('down', x, y, { button });
  if (button === 0) {
    held = true;
    G.CONTROLLER.queue_L_cursor_press(x, y);
  }
  if (button === 2) G.CONTROLLER.queue_R_cursor_press(x, y);
}

export function pointer_up(x: number, y: number, button: number) {
  if (button === 0) held = false;
  if (input_state.blocked || !G.CONTROLLER) return;
  record('up', x, y, { button });
  if (button === 0) G.CONTROLLER.L_cursor_release(x, y);
}

/** a key down (`key`: the browser's KeyboardEvent.key) */
export function key_down(key: string) {
  if (input_state.blocked || !G.CONTROLLER) return;
  recorder.record('input', { type: 'key', key, f: frame() });
  G.CONTROLLER.set_HID_flags('mouse');
  // typed characters keep their case and symbols
  G.CONTROLLER.key_press(G.CONTROLLER.text_input_hook && key.length === 1 ? key : love_key(key));
}

export function key_up(key: string) {
  if (input_state.blocked || !G.CONTROLLER) return;
  recorder.record('input', { type: 'keyup', key, f: frame() });
  G.CONTROLLER.key_release(G.CONTROLLER.text_input_hook && key.length === 1 ? key : love_key(key));
}
