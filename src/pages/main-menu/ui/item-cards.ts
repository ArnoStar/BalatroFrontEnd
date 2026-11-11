// Items drawn as the game draws its cards: the joker with the item's edition
// (the game's own shaders) and the stake sticker of the win it came from; a
// tag as the game's tag sprite. They are only looked at (no tooltip: an
// item's edition does nothing).
import { G, Sprite, Event, DynaText, play_sound } from '@/shared/lib/engine';
import { localize } from '@/shared/lib/localization';
import { create_UIBox_generic_options } from '@/shared/ui';
import { Card, CardArea } from '@/entities/card';
import type { PlayerItem } from '@/shared/api';
import { item_center } from '../model/items';

const EDITION_FLAG: Record<string, string> = { foil: 'foil', holographic: 'holo', polychrome: 'polychrome', negative: 'negative' };
const RARITY_KEY = ['', 'k_common', 'k_uncommon', 'k_rare', 'k_legendary'];

/** the joker card of an item (null: a tag, or a joker this game doesn't have) */
export function item_card(item: PlayerItem, x: number, y: number, w: number, h: number): any {
  const center = item_center(item);
  if (!center) return null;
  // (an item is the player's whatever they have unlocked or discovered in their runs)
  const card: any = new Card(x, y, w, h, G.P_CARDS.empty, center, { bypass_discovery_center: true, bypass_discovery_ui: true, bypass_lock: true });
  const flag = EDITION_FLAG[item.edition];
  if (flag) card.set_edition({ [flag]: true }, true, true);
  if (item.stake) card.sticker = G.sticker_map[item.stake - 1];
  card.no_ui = true;
  return card;
}

/** a tag item's sprite (the game's tag atlas) */
export function item_tag_sprite(item: PlayerItem, w: number): any {
  const tag = G.P_TAGS[item.key];
  if (!tag) return null;
  const s: any = new Sprite(0, 0, w, w, G.ASSET_ATLAS.tags, tag.pos);
  s.states.drag.can = false;
  s.states.collide.can = false;
  return s;
}

/** the item's name in the player's language (the game's own text) */
export function item_name(item: PlayerItem): string {
  const set = item.kind === 'joker' ? 'Joker' : 'Tag';
  const name = localize({ type: 'name_text', key: item.key, set });
  return typeof name === 'string' && name !== 'ERROR' ? name : item.name;
}

/** its edition and number: "Holographic #3" */
function item_line(item: PlayerItem): string {
  return `${item.edition !== 'base' ? `${localize(item.edition, 'labels')} ` : ''}#${item.serial}`;
}

/** the overlay revealing new items (the game's own overlay, cards and sounds) */
export function show_found(found: PlayerItem[]) {
  const shown = found.slice(0, 5);
  const area = new CardArea(G.ROOM.T.x + G.ROOM.T.w / 2, G.ROOM.T.h, Math.max(1, shown.length) * G.CARD_W * 1.1, 1.05 * G.CARD_H,
    { card_limit: shown.length, type: 'title', highlight_limit: 0 });
  const names: any[] = [];
  for (const item of shown) {
    const card = item_card(item, area.T.x + area.T.w / 2, area.T.y, G.CARD_W, G.CARD_H);
    if (card) {
      area.emplace(card);
    } else {
      // a tag: its sprite on the game's blank card
      const blank: any = new Card(area.T.x + area.T.w / 2, area.T.y, G.CARD_W, G.CARD_H, G.P_CARDS.empty, G.P_CENTERS.c_base, { bypass_discovery_center: true });
      blank.no_ui = true;
      const s = item_tag_sprite(item, 0.8 * G.CARD_W);
      if (s) {
        s.set_alignment({ major: blank, type: 'cm', bond: 'Strong', offset: { x: 0, y: 0 } });
        blank.children.item_tag = s;
      }
      area.emplace(blank);
    }
    names.push({ n: G.UIT.C, config: { align: 'cm', minw: G.CARD_W * 1.1, maxw: G.CARD_W * 1.1 }, nodes: [
      { n: G.UIT.R, config: { align: 'cm' }, nodes: [{ n: G.UIT.T, config: { text: item_name(item), scale: 0.32, colour: G.C.UI.TEXT_LIGHT, shadow: true } }] },
      { n: G.UIT.R, config: { align: 'cm' }, nodes: [{ n: G.UIT.T, config: { text: localize(RARITY_KEY[item.rarity] ?? 'k_common'), scale: 0.3, colour: G.C.RARITY[item.rarity] ?? G.C.WHITE, shadow: true } }] },
      { n: G.UIT.R, config: { align: 'cm' }, nodes: [{ n: G.UIT.T, config: { text: item_line(item), scale: 0.27, colour: item.edition === 'base' ? G.C.UI.TEXT_INACTIVE : G.C.DARK_EDITION, shadow: true } }] },
    ] });
  }
  const title = new DynaText({ string: [found.length > 1 ? `+${found.length}` : '+1'], colours: [G.C.WHITE], shadow: true, float: true, scale: 0.8, pop_in: 0.1, bump: true });
  G.FUNCS.overlay_menu({
    definition: create_UIBox_generic_options({ contents: [
      { n: G.UIT.R, config: { align: 'cm', padding: 0.1 }, nodes: [{ n: G.UIT.O, config: { object: title } }] },
      { n: G.UIT.R, config: { align: 'cm', padding: 0.15, r: 0.1, colour: G.C.BLACK, emboss: 0.05 }, nodes: [{ n: G.UIT.O, config: { object: area } }] },
      { n: G.UIT.R, config: { align: 'cm', padding: 0.05 }, nodes: names },
    ] }),
  });
  // each card turns up, as the game's shop and packs do
  shown.forEach((_, i) => {
    G.E_MANAGER.add_event(new Event({
      trigger: 'after', delay: 0.25 + 0.3 * i, blockable: false, blocking: false,
      func: () => {
        const c = area.cards[i];
        if (c) { c.juice_up(0.4, 0.4); c.start_materialize?.(); }
        play_sound(found[i]?.edition === 'negative' ? 'negative' : found[i]?.edition === 'polychrome' ? 'polychrome1'
          : found[i]?.edition === 'holographic' ? 'holo1' : found[i]?.edition === 'foil' ? 'foil1' : 'card1', 1, 0.5);
        return true;
      },
    }));
  });
}
