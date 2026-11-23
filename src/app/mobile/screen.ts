// The game on a phone or a tablet: the screen it plays on. The game is drawn
// for a landscape screen, so a touch screen goes full screen and turns to
// landscape at the first touch (where the browser lets a page do that), and
// a phone held upright is asked to turn. On a phone (G.F_MOBILE_UI), card
// texts are the game's mobile size (descriptions half as big again) and the
// room fills the screen's height (shared/lib/engine init_window). A touch
// screen has no Esc key: a menu button in the corner is the key.
import { G } from '@/shared/lib/engine';
import { input_state, key_down, key_up } from '@/shared/lib/input';

/** a touch screen is the main pointer (phones, tablets) */
export const touch_screen = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;

/** a touch screen too small for the game's desktop texts */
export const phone = touch_screen && Math.min(screen.width, screen.height) < 600;

/** canvas pixels per CSS pixel: a phone's 3x screen draws at 2x (the same look, a third of the work) */
export function pixel_ratio() {
  const dpr = window.devicePixelRatio || 1;
  return touch_screen ? Math.min(dpr, 2) : dpr;
}

const TEXT = {
  en: { turn: 'Turn your phone sideways to play', anyway: 'Play like this', menu: 'Menu (Esc)' },
  ru: { turn: 'Поверните телефон, чтобы играть', anyway: 'Играть так', menu: 'Меню (Esc)' },
};

const text = () => (String(G.SETTINGS?.language ?? 'en-us').startsWith('ru') ? TEXT.ru : TEXT.en);

const CSS = `
@font-face { font-family: 'm6x11'; src: url('${import.meta.env.BASE_URL}resources/fonts/m6x11plus.ttf'); }
.turn-phone { position: fixed; inset: 0; z-index: 60; display: none; flex-direction: column; align-items: center; justify-content: center;
  gap: 28px; padding: 24px; background: #1e2b2d; color: #fff; text-align: center; font: 26px/1.25 m6x11, 'Trebuchet MS', system-ui, sans-serif; }
@media (orientation: portrait) { .turn-phone:not(.is-dismissed) { display: flex; } }
.turn-phone__phone { width: 56px; height: 96px; border: 5px solid #fff; border-radius: 12px; animation: turn-phone 2.4s ease-in-out infinite; }
@keyframes turn-phone { 0%, 25% { transform: rotate(0deg); } 50%, 85% { transform: rotate(-90deg); } 100% { transform: rotate(0deg); } }
.turn-phone button { padding: 8px 18px; border: 0; border-radius: 10px; background: #5f7377; box-shadow: 0 4px 0 #3b4a4d; color: #fff; font: inherit; font-size: 20px; }
.esc-key { position: fixed; z-index: 25; left: max(6px, env(safe-area-inset-left)); top: max(6px, env(safe-area-inset-top));
  width: 40px; height: 40px; padding: 0; border: 3px solid #1e2b2d; border-radius: 10px; background: #fda200; box-shadow: 0 3px 0 #a86b00;
  display: grid; place-content: center; gap: 4px; touch-action: manipulation; -webkit-tap-highlight-color: transparent; }
.esc-key span { display: block; width: 18px; height: 3px; border-radius: 2px; background: #fff; }
.esc-key:active { transform: translateY(2px); box-shadow: 0 1px 0 #a86b00; }
`;

function ask_to_turn() {
  const t = text();
  const root = document.createElement('div');
  root.className = 'turn-phone';
  const icon = document.createElement('div');
  icon.className = 'turn-phone__phone';
  const say = document.createElement('p');
  say.style.margin = '0';
  say.textContent = t.turn;
  const anyway = document.createElement('button');
  anyway.type = 'button';
  anyway.textContent = t.anyway;
  anyway.addEventListener('click', () => root.classList.add('is-dismissed'));
  root.append(icon, say, anyway);
  document.body.append(root);
}

let asked = false;

/** at a finger's lift (in its event, as browsers want): full screen, turned to landscape, once */
export function fill_screen() {
  if (!touch_screen || asked) return;
  asked = true;
  const page = document.documentElement;
  if (document.fullscreenElement || !page.requestFullscreen) return;
  page.requestFullscreen({ navigationUI: 'hide' })
    .then(() => (screen.orientation as ScreenOrientation & { lock?: (o: string) => Promise<void> }).lock?.('landscape'))
    .catch(() => { /* not on this browser (iPhones): the player turns the phone */ });
}

/** the Esc key, for a screen without keys: the Options menu, or back out of a menu (as the game's Esc) */
function esc_key() {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'esc-key';
  b.title = text().menu;
  b.setAttribute('aria-label', text().menu);
  b.append(document.createElement('span'), document.createElement('span'), document.createElement('span'));
  b.addEventListener('click', () => {
    if (input_state.replaying) return;
    key_down('Escape');
    key_up('Escape');
  });
  document.body.append(b);
}

/** once the settings are loaded (the language) */
export function set_up_screen() {
  if (!touch_screen) return;
  const s = document.createElement('style');
  s.textContent = CSS;
  document.head.append(s);
  esc_key();
  if (phone) ask_to_turn();
}
