// The phone's own keyboard for the game's text boxes (create_text_input): a
// phone has no keys to press, and its keyboard only opens for a page's text
// field. While a finger has a text box selected (G.CONTROLLER.text_input_hook),
// an <input> at the top of the screen holds the focus: what the player types
// there goes to the game as keys, one per frame (the controller takes one
// press of a key per frame), and the field then shows the box's text again,
// so it reads what the game kept (its letters, its length).
import { G } from '@/shared/lib/engine';
import { key_down, key_up } from './input';

const CSS = `
@font-face { font-family: 'm6x11'; src: url('${import.meta.env.BASE_URL}resources/fonts/m6x11plus.ttf'); }
.soft-keyboard { position: fixed; left: 50%; top: max(8px, env(safe-area-inset-top)); z-index: 30; box-sizing: border-box;
  width: min(420px, calc(100vw - 32px)); transform: translateX(-50%); padding: 6px 12px; border-radius: 10px;
  border: 3px solid #1e2b2d; background: #3a5055; color: #fff; font: 20px/1.2 m6x11, 'Trebuchet MS', system-ui, sans-serif;
  text-align: center; outline: none; opacity: 0; pointer-events: none; caret-color: #eac058; }
.soft-keyboard.is-on { opacity: 1; pointer-events: auto; }
.soft-keyboard::placeholder { color: #b7c3c5; }
`;

let box: HTMLInputElement | null = null;
let shadow = ''; // the field's text when it last went to the game
let composing = false;
let pending: string[] = []; // keys for the game, one per frame
let resync = false;
let shown: unknown = null; // the text box the field shows
let opened_at = -Infinity; // (a tapped box is selected by the game a frame or two later)

/** the hooked text box's text, or null when none is selected */
function hooked_text(): string | null {
  const hook = G.CONTROLLER?.text_input_hook;
  if (!hook) return null;
  const text = hook.config?.ref_table?.text;
  return text ? String(text.ref_table[text.ref_value] ?? '') : '';
}

function show_game_text() {
  if (!box) return;
  const value = hooked_text() ?? '';
  box.placeholder = String(G.CONTROLLER?.text_input_hook?.config?.ref_table?.prompt_text ?? '');
  if (box.value !== value) box.value = value;
  box.setSelectionRange(value.length, value.length);
  shadow = value;
  resync = false;
  shown = G.CONTROLLER?.text_input_hook ?? null;
}

/** what the field gained or lost since the last time, as keys */
function take_changes() {
  if (!box) return;
  const now = box.value;
  let same = 0;
  while (same < shadow.length && same < now.length && shadow[same] === now[same]) same++;
  for (let i = same; i < shadow.length; i++) pending.push('Backspace');
  for (const c of now.slice(same)) pending.push(c);
  shadow = now;
  resync = true;
}

function make() {
  const s = document.createElement('style');
  s.textContent = CSS;
  document.head.append(s);
  box = document.createElement('input');
  box.type = 'text';
  box.className = 'soft-keyboard';
  box.setAttribute('autocomplete', 'off');
  box.setAttribute('autocorrect', 'off');
  box.setAttribute('autocapitalize', 'off');
  box.setAttribute('spellcheck', 'false');
  box.setAttribute('enterkeyhint', 'done');
  box.setAttribute('aria-label', 'Text');
  box.addEventListener('compositionstart', () => { composing = true; });
  box.addEventListener('compositionend', () => { composing = false; take_changes(); });
  box.addEventListener('input', () => take_changes());
  // the field types its letters itself; Enter (the box's callback) and Escape go on to the game's keys
  box.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' && e.key !== 'Escape') e.stopPropagation();
  });
  // the keyboard closed (Done, the back button, a tap elsewhere): the box lets go, as Escape does
  box.addEventListener('blur', () => {
    box!.classList.remove('is-on');
    pending = [];
    if (G.CONTROLLER?.text_input_hook) G.CONTROLLER.text_input_hook = null;
  });
  document.body.append(box);
}

function open_keyboard() {
  if (!box) make();
  show_game_text();
  box!.classList.add('is-on');
  box!.focus({ preventScroll: true });
}

/** the node a finger is on (canvas pixels), as the controller's collision finds it, without touching its state */
function node_at(x: number, y: number): any {
  const H = G.DRAW_HASH;
  if (!H || !G.TILESCALE) return null;
  const T = { x: x / (G.TILESCALE * G.TILESIZE), y: y / (G.TILESCALE * G.TILESIZE) };
  for (let i = H.length - 1; i >= 0; i--) {
    const v = H[i];
    if (!v.REMOVED && v.states.collide.can && v.collides_with_point(T)) return v;
  }
  return null;
}

/** is this node (or one it's in) a text box? */
function text_box_of(node: any): boolean {
  for (let n = node, depth = 0; n && depth < 6; n = n.parent, depth++) {
    if (n.config?.button === 'select_text_input') return true;
  }
  return false;
}

export const soft_keyboard = {
  /** a finger left the screen at x, y (in its event: a phone opens its keyboard only then) */
  tapped(x: number, y: number) {
    if (!G.CONTROLLER || !text_box_of(node_at(x, y))) return;
    opened_at = performance.now();
    open_keyboard();
  },

  /** a finger came down at x, y: elsewhere than a text box, the keyboard closes */
  touched(x: number, y: number) {
    if (box && document.activeElement === box && !text_box_of(node_at(x, y))) box.blur();
  },

  /** each frame, after the game's: the next key to the game; the keyboard follows the game's text box */
  update() {
    if (!G.CONTROLLER) return;
    const hook = G.CONTROLLER.text_input_hook;
    const focused = !!box && document.activeElement === box;
    if (hook && !focused && G.CONTROLLER.HID.touch) open_keyboard();
    else if (!hook && focused && performance.now() - opened_at > 500) box!.blur();
    // (the last key went last frame: the game has taken it by now)
    else if (focused && hook && !composing && pending.length === 0 && (resync || hook !== shown)) show_game_text();
    const key = pending.shift();
    if (key !== undefined) {
      key_down(key);
      key_up(key);
    }
  },
};
