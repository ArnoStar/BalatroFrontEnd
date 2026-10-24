// GameView -> G.GAME: the API's numbers copied into the fields the game's UI
// reads (HUD texts, tooltips, blind choices...), and the card areas brought in
// line with the view once the animations are over.
import { G } from '@/shared/lib/engine';
import type { Area, GameView } from '@/shared/api';
import { Back } from '@/entities/back/@x/run';
import { Card, CardArea } from '@/entities/card/@x/run';
import { area_views, find_view } from './store';
import { card_by_id, create_back_card, reconcile_area, apply_card_view } from './cards';

/** the CardArea of an API area name (null when its screen is not up) */
export function area_of(name: Area | string): CardArea | null {
  switch (name) {
    case 'deck': return G.deck ?? null;
    case 'hand': return G.hand ?? null;
    case 'play': return G.play ?? null;
    case 'discard': return G.discard ?? null;
    case 'jokers': return G.jokers ?? null;
    case 'consumables': return G.consumeables ?? null;
    case 'shop': return G.shop_jokers && !G.shop_jokers.REMOVED ? G.shop_jokers : null;
    case 'vouchers': return G.shop_vouchers && !G.shop_vouchers.REMOVED ? G.shop_vouchers : null;
    case 'boosters': return G.shop_booster && !G.shop_booster.REMOVED ? G.shop_booster : null;
    case 'pack': return G.pack_cards && !G.pack_cards.REMOVED ? G.pack_cards : null;
    default: return null;
  }
}

const SLOTS = ['Small', 'Big', 'Boss'] as const;

/** the run's settings: deck, stake, challenge, seed, speed */
export function sync_settings(view: GameView) {
  const s = view.settings;
  G.GAME.stake = s.stake;
  G.GAME.selected_back = new Back(G.P_CENTERS[s.deck] ?? G.P_CENTERS.b_red);
  G.GAME.selected_back_key = G.P_CENTERS[s.deck];
  G.GAME.pseudorandom.seed = s.seed;
  G.GAME.challenge = s.challenge;
  G.GAME.challenge_tab = s.challenge ? G.CHALLENGES.find((c: any) => c.id === s.challenge) : null;
}

/** copies the view's numbers into G.GAME (no animation) */
export function sync_game(view: GameView, opts: { keep?: ('dollars' | 'chips')[] } = {}) {
  const GAME = G.GAME;
  const cr = GAME.current_round;
  const rr = GAME.round_resets;
  const keep = new Set(opts.keep ?? []);
  if (!keep.has('dollars')) GAME.dollars = view.dollars;
  rr.ante = view.ante;
  GAME.round = view.round;
  cr.hands_left = view.hands_left;
  cr.discards_left = view.discards_left;
  if (!keep.has('chips')) GAME.chips = view.round_score ?? 0;
  GAME.won = view.won;
  if (G.hand) G.hand.config.card_limit = view.hand_size;
  if (G.jokers) G.jokers.config.card_limit = view.joker_slots;
  if (G.consumeables) G.consumeables.config.card_limit = view.consumable_slots;

  GAME.modifiers.no_blind_reward = GAME.modifiers.no_blind_reward ?? {};
  const bs = view.blind_select;
  if (bs) {
    rr.blind_chips = rr.blind_chips ?? {};
    rr.blind_rewards = rr.blind_rewards ?? {};
    rr.blind_tag_views = rr.blind_tag_views ?? {};
    for (const c of bs.choices) {
      rr.blind_choices[c.slot] = c.key;
      rr.blind_states[c.slot] = c.state;
      rr.blind_chips[c.slot] = c.chips;
      rr.blind_rewards[c.slot] = c.reward;
      rr.blind_tag_views[c.slot] = c.skip_tag;
      rr.blind_tags = rr.blind_tags ?? {};
      if (c.slot !== 'Boss') rr.blind_tags[c.slot] = c.skip_tag ? c.skip_tag.key : null;
      GAME.modifiers.no_blind_reward[c.slot] = c.reward === 0;
    }
    GAME.blind_on_deck = bs.on_deck;
    rr.boss_reroll_cost = bs.boss_reroll_cost;
  }
  if (view.blind && view.blind.slot) GAME.modifiers.no_blind_reward[view.blind.slot] = view.blind.reward === 0;
  for (const s of SLOTS) if (!(s in rr.blind_states)) rr.blind_states[s] = 'Upcoming';

  GAME.hand_usage = {};
  for (const h of view.poker_hands) {
    if (h.played > 0) GAME.hand_usage[h.name] = { count: h.played, order: h.name };
    const gh = GAME.hands[h.name];
    if (!gh) continue;
    gh.level = h.level;
    gh.chips = h.chips;
    gh.mult = h.mult;
    gh.played = h.played;
    gh.visible = h.visible;
  }

  const info = view.info;
  GAME.probabilities.normal = info.probability_normal;
  GAME.last_tarot_planet = info.last_tarot_planet;
  GAME.interest_amount = info.interest_amount;
  GAME.interest_cap = info.interest_cap;
  GAME.discount_percent = info.discount_percent;
  GAME.bankrupt_at = info.bankrupt_at;
  GAME.skips = info.skips;
  GAME.hands_played = info.hands_played;
  GAME.unused_discards = info.unused_discards;
  const rt = info.round_targets;
  if (rt.idol_rank) cr.idol_card = { rank: rt.idol_rank, suit: rt.idol_suit, id: null };
  if (rt.mail_rank) cr.mail_card = { rank: rt.mail_rank };
  if (rt.ancient_suit) cr.ancient_card = { suit: rt.ancient_suit };
  if (rt.castle_suit) cr.castle_card = { suit: rt.castle_suit };
  if (rt.most_played_hand) cr.most_played_poker_hand = rt.most_played_hand;

  GAME.used_vouchers = {};
  for (const v of view.vouchers) GAME.used_vouchers[v] = true;
  if (view.shop) {
    cr.reroll_cost = view.shop.reroll_cost;
    cr.free_rerolls = view.shop.free_rerolls;
  }
  if (view.pack) GAME.pack_choices = view.pack.choices_left;
  GAME.starting_deck_size = view.deck.total;
}

/** keeps `n` cards in a pile area (deck, discard): known cards first, then backs */
function fill_pile(area: CardArea, n: number) {
  while (area.cards.length > n) {
    const c = area.cards[area.cards.length - 1];
    area.remove_card(c);
    c.remove();
  }
  while (area.cards.length < n) {
    const c = create_back_card(area.T.x, area.T.y);
    area.emplace(c);
  }
}

/**
 * Brings every card area in line with the view: what the animations left
 * behind is replaced by the API's truth (they normally agree).
 */
export function reconcile_all(view: GameView) {
  const claimed = new Set<number>();
  const areas: Area[] = ['hand', 'jokers', 'consumables', 'shop', 'vouchers', 'boosters', 'pack'];
  for (const a of areas) for (const cv of area_views(view, a) ?? []) claimed.add(cv.id);
  for (const a of areas) {
    const area = area_of(a);
    const views = area_views(view, a);
    if (area && views) reconcile_area(area, views, claimed);
  }
  if (G.play) {
    for (const c of [...G.play.cards]) {
      if (c.api_id !== undefined && claimed.has(c.api_id)) continue;
      G.play.remove_card(c);
      if (!c.REMOVED) c.remove();
    }
  }
  if (G.deck) fill_pile(G.deck, view.deck.remaining);
  if (G.discard) fill_pile(G.discard, view.discard_count);
  for (const a of areas) {
    for (const cv of area_views(view, a) ?? []) {
      const c = card_by_id(cv.id);
      if (c) apply_card_view(c, cv);
    }
  }
}

export { find_view, Card };
