// Items drawn as the game draws its cards: a joker, a tarot, planet or spectral
// card, or a playing card with its enhancement and seal, each with the item's
// edition (the game's own shaders) and the stake sticker of the win it came
// from. They are only looked at (no tooltip: an item does nothing). And the
// coins the player's runs earned, told on the title screen in the game's own
// overlay.
import { G, DynaText, Event, play_sound } from '@/shared/lib/engine';
import { create_UIBox_generic_options, UIBox_button } from '@/shared/ui';
import { Card } from '@/entities/card';
import { portal_base, type EarnedCoins, type PlayerItem } from '@/shared/api';
import { item_center } from '../model/items';

const EDITION_FLAG: Record<string, string> = { foil: 'foil', holographic: 'holo', polychrome: 'polychrome', negative: 'negative' };

/** the card of an item (null: a key this game doesn't have, or an item of before, a tag) */
export function item_card(item: PlayerItem, x: number, y: number, w: number, h: number): any {
  const center = item_center(item);
  if (!center) return null;
  // (an item is the player's whatever they have unlocked or discovered in their runs)
  const front = item.kind === 'card' ? G.P_CARDS[item.key] : G.P_CARDS.empty;
  const card: any = new Card(x, y, w, h, front, center, { bypass_discovery_center: true, bypass_discovery_ui: true, bypass_lock: true });
  if (item.kind === 'card' && item.seal) card.set_seal(item.seal, true, true);
  const flag = EDITION_FLAG[item.edition];
  if (flag) card.set_edition({ [flag]: true }, true, true);
  if (item.stake && item.kind === 'joker') card.sticker = G.sticker_map[item.stake - 1];
  card.no_ui = true;
  return card;
}

// the coins' texts (the game's localization has none): English, and Russian when the game is in Russian
const TEXT = {
  en: {
    coins: 'COINS', weekly: 'This week\'s run', weekly_win: 'This week\'s win', first_deck_win: 'A first win with a deck',
    first_stake_win: 'A first win at a stake', balance: 'You have {n} coins', spend: 'Boosters and the market are on the site',
    shop: 'Shop',
  },
  ru: {
    coins: 'МОНЕТЫ', weekly: 'Забег этой недели', weekly_win: 'Победа этой недели', first_deck_win: 'Первая победа с колодой',
    first_stake_win: 'Первая победа на ставке', balance: 'У вас монет: {n}', spend: 'Бустеры и рынок — на сайте', shop: 'Магазин',
  },
};
type TextKey = keyof typeof TEXT.en;

function tr(key: TextKey, vars: Record<string, string | number> = {}): string {
  const table = String(G.SETTINGS?.language ?? 'en-us').startsWith('ru') ? TEXT.ru : TEXT.en;
  return table[key].replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? ''));
}

const number = (n: number) => n.toLocaleString(String(G.SETTINGS?.language ?? 'en-us').startsWith('ru') ? 'ru' : 'en');

/** the overlay telling the coins just earned (the game's own overlay, text and sounds) */
export function show_earned(earned: EarnedCoins[], balance: number) {
  // (the overlay's button: the portal's shop, in another tab)
  G.FUNCS.items_open_shop = () => {
    window.open(`${portal_base()}/shop`, '_blank', 'noopener');
  };
  const total = earned.reduce((n, e) => n + e.coins, 0);
  const title = new DynaText({
    string: [`+${number(total)}`], colours: [G.C.MONEY], shadow: true, float: true, scale: 1, pop_in: 0.1, bump: true,
  });
  const lines = earned.slice(0, 8).map((e) => ({
    n: G.UIT.R, config: { align: 'cm', padding: 0.03 }, nodes: [
      { n: G.UIT.C, config: { align: 'cl', minw: 4.2 }, nodes: [
        { n: G.UIT.T, config: { text: e.reason in TEXT.en ? tr(e.reason as TextKey) : e.reason, scale: 0.36, colour: G.C.UI.TEXT_LIGHT, shadow: true } },
      ] },
      { n: G.UIT.C, config: { align: 'cr', minw: 1.4 }, nodes: [
        { n: G.UIT.T, config: { text: `+${number(e.coins)}`, scale: 0.36, colour: G.C.MONEY, shadow: true } },
      ] },
    ],
  }));
  G.FUNCS.overlay_menu({
    definition: create_UIBox_generic_options({ contents: [
      { n: G.UIT.R, config: { align: 'cm', padding: 0.05 }, nodes: [
        { n: G.UIT.T, config: { text: tr('coins'), scale: 0.45, colour: G.C.UI.TEXT_LIGHT, shadow: true } },
      ] },
      { n: G.UIT.R, config: { align: 'cm', padding: 0.1 }, nodes: [{ n: G.UIT.O, config: { object: title } }] },
      { n: G.UIT.R, config: { align: 'cm', padding: 0.15, r: 0.1, colour: G.C.BLACK, emboss: 0.05 }, nodes: [
        { n: G.UIT.C, config: { align: 'cm' }, nodes: lines },
      ] },
      { n: G.UIT.R, config: { align: 'cm', padding: 0.05 }, nodes: [
        { n: G.UIT.T, config: { text: tr('balance', { n: number(balance) }), scale: 0.36, colour: G.C.MONEY, shadow: true } },
      ] },
      { n: G.UIT.R, config: { align: 'cm', padding: 0.02 }, nodes: [
        { n: G.UIT.T, config: { text: tr('spend'), scale: 0.3, colour: G.C.UI.TEXT_LIGHT, shadow: true } },
      ] },
      { n: G.UIT.R, config: { align: 'cm', padding: 0.1 }, nodes: [
        UIBox_button({ button: 'items_open_shop', label: [tr('shop')], colour: G.C.ORANGE, minw: 2.6, minh: 0.7, scale: 0.45 }),
      ] },
    ] }),
  });
  // the coins ring in, as the game's cash out does
  earned.slice(0, 8).forEach((_, i) => {
    G.E_MANAGER.add_event(new Event({
      trigger: 'after', delay: 0.2 + 0.18 * i, blockable: false, blocking: false,
      func: () => {
        play_sound('coin3', 0.9 + 0.05 * i, 0.6);
        return true;
      },
    }));
  });
}
