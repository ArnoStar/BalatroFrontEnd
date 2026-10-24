// Cards on screen for the API's cards: a registry by API id, cards built from
// a CardView, and an area brought in line with the view's list.
import { G } from '@/shared/lib/engine';
import { Card, CardArea } from '@/entities/card/@x/run';
import type { CardView } from '@/shared/api';

const registry = new Map<number, Card>();

export function card_by_id(id: number): Card | undefined {
  const c = registry.get(id);
  if (c && c.REMOVED) { registry.delete(id); return undefined; }
  return c;
}

export function forget_card(id: number) { registry.delete(id); }
export function clear_cards() { registry.clear(); }

export function register_card(id: number, card: Card) {
  if (card.api_id !== undefined && registry.get(card.api_id) === card) registry.delete(card.api_id);
  const prev = registry.get(id);
  if (prev && prev !== card) prev.api_id = undefined;
  card.api_id = id;
  registry.set(id, card);
}

function center_of(cv: CardView) {
  if (cv.face_down || !cv.key) return G.P_CENTERS.c_base;
  return G.P_CENTERS[cv.key] ?? G.P_CENTERS.c_base;
}

function size_of(center: any): [number, number] {
  if (center?.set === 'Booster') return [G.CARD_W * 1.27, G.CARD_H * 1.27];
  return [G.CARD_W, G.CARD_H];
}

/**
 * a new card for a CardView, at (x, y). `fresh`: the card is new to the run,
 * so its edition shows as the game shows a new card's (sound and shine).
 */
export function create_card(cv: CardView, x = 0, y = 0, fresh = false): Card {
  const center = center_of(cv);
  const front = cv.kind === 'playing_card' && cv.card_key ? G.P_CARDS[cv.card_key] : undefined;
  const [w, h] = size_of(center);
  const card = new Card(x, y, w, h, front, center, {
    playing_card: cv.kind === 'playing_card' ? 1 : undefined, bypass_discovery_center: true, bypass_discovery_ui: true,
  });
  register_card(cv.id, card);
  apply_card_view(card, cv, fresh);
  if (cv.face_down) { card.facing = 'back'; card.sprite_facing = 'back'; }
  return card;
}

/** an anonymous face-down playing card (the deck pile, unknown cards) */
export function create_back_card(x = 0, y = 0): Card {
  const card = new Card(x, y, G.CARD_W, G.CARD_H, undefined, G.P_CENTERS.c_base, { playing_card: 1 });
  card.facing = 'back';
  card.sprite_facing = 'back';
  return card;
}

/** brings a card's identity and numbers in line with the API's view */
export function apply_card_view(card: Card, cv: CardView, fresh = false) {
  if (cv.face_down) return;
  const center = center_of(cv);
  if (card.config.center !== center) {
    const keep = card.ability ? { forced_selection: card.ability.forced_selection } : {};
    card.set_ability(center);
    Object.assign(card.ability, keep);
  }
  if (cv.kind === 'playing_card' && cv.card_key) {
    const front = G.P_CARDS[cv.card_key];
    if (card.config.card !== front) card.set_base(front);
  }
  const ed = cv.edition ?? null;
  if ((card.edition?.type ?? null) !== ed) card.set_edition(ed ? { [ed]: true } : null, !fresh, !fresh);
  if ((card.seal ?? null) !== (cv.seal ?? null)) card.set_seal(cv.seal, true);
  const a = card.ability;
  a.eternal = cv.stickers?.eternal || null;
  a.rental = cv.stickers?.rental || null;
  if (cv.stickers && cv.stickers.perishable !== null && cv.stickers.perishable !== undefined) {
    a.perishable = true;
    a.perish_tally = cv.stickers.perishable;
  } else {
    a.perishable = null;
  }
  card.debuff = !!cv.debuffed;
  a.forced_selection = cv.forced_selection || null;
  if (cv.bonus_chips !== null && cv.bonus_chips !== undefined) a.perma_bonus = cv.bonus_chips;
  if (cv.ability) {
    for (const k of Object.keys(cv.ability)) a[k] = cv.ability[k];
  }
  if (cv.cost !== null && cv.cost !== undefined) card.cost = cv.cost;
  if (cv.sell_value !== null && cv.sell_value !== undefined) card.sell_cost = cv.sell_value;
  card.sell_cost_label = card.facing === 'back' ? '?' : card.sell_cost;
}

/** the card for a view: the known one (updated), or a new one at the area */
export function card_for_view(cv: CardView, area?: CardArea): Card {
  const c = card_by_id(cv.id);
  if (c) { apply_card_view(c, cv); return c; }
  const T = area?.T ?? { x: G.ROOM.T.w / 2 - G.CARD_W / 2, y: G.ROOM.T.h / 2 - G.CARD_H / 2, w: G.CARD_W };
  return create_card(cv, T.x + (T.w - G.CARD_W) / 2, T.y);
}

/**
 * Makes `area` hold exactly the cards of `views`, in order, without
 * animations of its own (the moves the player saw were animated by the
 * timeline). Cards that left are removed unless another area claims them.
 */
export function reconcile_area(area: CardArea, views: CardView[], claimed: Set<number>) {
  const wanted = views.map((cv) => card_for_view(cv, area));
  for (const c of [...area.cards]) {
    if (!wanted.includes(c)) {
      area.remove_card(c);
      if (c.api_id === undefined || !claimed.has(c.api_id)) c.remove();
    }
  }
  wanted.forEach((c, i) => {
    const cv = views[i];
    if (c.area !== area) {
      if (c.area) c.area.remove_card(c);
      area.emplace(c, null, cv.face_down);
    }
    const want_facing = cv.face_down ? 'back' : 'front';
    if (c.facing !== want_facing) {
      if (cv.face_down) { c.facing = 'back'; c.sprite_facing = 'back'; } else c.flip();
    }
  });
  area.cards = wanted;
  area.set_ranks();
  area.highlighted = area.highlighted.filter((c) => wanted.includes(c));
  for (const c of wanted) if (c.highlighted && !area.highlighted.includes(c)) c.highlight(false);
}
