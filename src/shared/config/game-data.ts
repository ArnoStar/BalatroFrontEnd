// The game's static data (Game:init_item_prototypes, challenges.lua and the
// English localization), extracted from the game by tools/lua/extract_ui_data.lua.
// The profile is a fully unlocked one: every deck, stake and card is unlocked
// and discovered, since the API lets any run be played.
import data from './generated/game.json';
import { G } from '@/shared/lib/engine';
import { ipairs } from '@/shared/lib/lua';

const STUBS = {
  j_locked: { unlocked: false, max: 1, name: 'Locked', pos: { x: 8, y: 9 }, set: 'Joker', cost_mult: 1.0, config: {} },
  v_locked: { unlocked: false, max: 1, name: 'Locked', pos: { x: 8, y: 3 }, set: 'Voucher', cost_mult: 1.0, config: {} },
  c_locked: { unlocked: false, max: 1, name: 'Locked', pos: { x: 4, y: 2 }, set: 'Tarot', cost_mult: 1.0, config: {} },
  j_undiscovered: { unlocked: false, max: 1, name: 'Locked', pos: { x: 9, y: 9 }, set: 'Joker', cost_mult: 1.0, config: {} },
  t_undiscovered: { unlocked: false, max: 1, name: 'Locked', pos: { x: 6, y: 2 }, set: 'Tarot', cost_mult: 1.0, config: {} },
  p_undiscovered: { unlocked: false, max: 1, name: 'Locked', pos: { x: 7, y: 2 }, set: 'Planet', cost_mult: 1.0, config: {} },
  s_undiscovered: { unlocked: false, max: 1, name: 'Locked', pos: { x: 5, y: 2 }, set: 'Spectral', cost_mult: 1.0, config: {} },
  v_undiscovered: { unlocked: false, max: 1, name: 'Locked', pos: { x: 8, y: 2 }, set: 'Voucher', cost_mult: 1.0, config: {} },
  booster_undiscovered: { unlocked: false, max: 1, name: 'Locked', pos: { x: 0, y: 5 }, set: 'Booster', cost_mult: 1.0, config: {} },
};

export function load_game_data() {
  const d: any = structuredClone(data);
  G.P_CENTERS = d.P_CENTERS;
  G.P_CARDS = d.P_CARDS;
  G.P_BLINDS = d.P_BLINDS;
  G.P_TAGS = d.P_TAGS;
  G.P_SEALS = d.P_SEALS;
  G.P_STAKES = d.P_STAKES;
  G.b_undiscovered = d.b_undiscovered;
  G.tag_undiscovered = d.tag_undiscovered;
  Object.assign(G, structuredClone(STUBS));

  for (const k of Object.keys(G.P_BLINDS)) {
    const b = G.P_BLINDS[k];
    b.key = k;
    // boss colours are tables in the game: keep them as colours
    if (b.boss_colour && !Array.isArray(b.boss_colour)) b.boss_colour = ipairs(b.boss_colour);
    if (b.vars && !Array.isArray(b.vars)) b.vars = ipairs(b.vars);
  }
  for (const k of Object.keys(G.P_CARDS)) G.P_CARDS[k].key = k;

  // a fully unlocked profile
  const unlock = (v: any) => { v.unlocked = true; v.discovered = true; v.alerted = true; };
  for (const v of Object.values<any>(G.P_CENTERS)) if (!v.wip && !v.demo) unlock(v);
  for (const v of Object.values<any>(G.P_BLINDS)) unlock(v);
  for (const v of Object.values<any>(G.P_TAGS)) unlock(v);
  for (const v of Object.values<any>(G.P_SEALS)) unlock(v);
  for (const v of Object.values<any>(G.P_STAKES)) v.unlocked = true;

  G.P_CENTER_POOLS = {};
  for (const k of Object.keys(d.P_CENTER_POOLS)) {
    G.P_CENTER_POOLS[k] = ipairs(d.P_CENTER_POOLS[k]).map((key: string) =>
      G.P_CENTERS[key] ?? G.P_TAGS[key] ?? G.P_SEALS[key] ?? G.P_STAKES[key]);
  }
  // the deck list is sorted with unlocked decks first (all are unlocked here)
  G.P_CENTER_POOLS.Back.sort((a: any, b: any) => a.order - b.order);
  G.P_JOKER_RARITY_POOLS = ipairs(d.P_JOKER_RARITY_POOLS).map((l: any) => ipairs(l).map((key: string) => G.P_CENTERS[key]));
  G.P_LOCKED = [];

  // empty Lua tables come out as {}: the challenge's lists are arrays here
  G.CHALLENGES = ipairs(d.CHALLENGES).map((c: any) => ({
    ...c,
    jokers: ipairs(c.jokers), consumeables: ipairs(c.consumeables), vouchers: ipairs(c.vouchers),
    rules: c.rules ? { custom: ipairs(c.rules.custom), modifiers: ipairs(c.rules.modifiers) } : undefined,
    restrictions: c.restrictions ? {
      banned_cards: ipairs(c.restrictions.banned_cards).map((b: any) => ({ ...b, ids: b.ids ? ipairs(b.ids) : undefined })),
      banned_tags: ipairs(c.restrictions.banned_tags), banned_other: ipairs(c.restrictions.banned_other),
    } : undefined,
    deck: c.deck ? { ...c.deck, cards: c.deck.cards ? ipairs(c.deck.cards) : undefined } : undefined,
  }));
  G.localization = d.localization;
}
