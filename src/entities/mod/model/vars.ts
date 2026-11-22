// The values a mod item's description shows (its `vars`: #1#, #2# ...),
// evaluated as the engine would with what is on screen: the item's values
// (a joker's own, from the API's view of it), the run, the cards.
import { G } from '@/shared/lib/engine';
import { value_of, type Env } from '@/shared/lib/mod-expr';

const RANK_IDS: Record<string, number> = { Jack: 11, Queen: 12, King: 13, Ace: 14 };

function playing(c: any) { return c?.ability?.set === 'Default' || c?.ability?.set === 'Enhanced'; }

function card_field(c: any, name: string): unknown {
  if (!c || typeof c !== 'object' || !c.config) return null;
  const p = playing(c);
  switch (name) {
    case 'rank': return p ? (c.base?.id ?? RANK_IDS[c.base?.value] ?? Number(c.base?.value)) : null;
    case 'rank_name': return p ? c.base?.value ?? null : null;
    case 'suit': return p ? c.base?.suit ?? null : null;
    case 'face': return p ? !!c.is_face?.() : false;
    case 'chips': return p ? c.base?.nominal ?? null : null;
    case 'enhancement': return c.ability?.set === 'Enhanced' ? c.config.center.key : null;
    case 'seal': return c.seal ?? null;
    case 'edition': return c.edition?.type ?? null;
    case 'debuffed': return !!c.debuff;
    case 'key': return c.config.center?.key ?? null;
    case 'set': return c.ability?.set ?? null;
    case 'rarity': return c.config.center?.rarity ?? null;
    case 'sell_value': return c.sell_cost ?? null;
    case 'cost': return c.cost ?? null;
    default: return null;
  }
}

function game_field(name: string): unknown {
  const GAME = G.GAME ?? {};
  const cr = GAME.current_round ?? {};
  const rr = GAME.round_resets ?? {};
  switch (name) {
    case 'money': return (GAME.dollars ?? 0) + (GAME.dollar_buffer ?? 0);
    case 'ante': return rr.ante ?? 1;
    case 'round': return GAME.round ?? 0;
    case 'hands_left': return cr.hands_left ?? null;
    case 'discards_left': return cr.discards_left ?? null;
    case 'hands_played': return cr.hands_played ?? 0;
    case 'discards_used': return cr.discards_used ?? 0;
    case 'hand_size': return G.hand?.config?.card_limit ?? 8;
    case 'deck_count': return G.deck?.cards?.length ?? 0;
    case 'full_deck_count': return G.playing_cards?.length ?? 52;
    case 'joker_count': return G.jokers?.cards?.length ?? 0;
    case 'joker_slots': return G.jokers?.config?.card_limit ?? 5;
    case 'consumable_count': return G.consumeables?.cards?.length ?? 0;
    case 'consumable_slots': return G.consumeables?.config?.card_limit ?? 2;
    case 'probability': return GAME.probabilities?.normal ?? 1;
    case 'blind_boss': return !!GAME.blind?.boss;
    case 'blind_chips': return GAME.blind?.chips ?? 0;
    case 'round_chips': return GAME.chips ?? 0;
    case 'skips': return GAME.skips ?? 0;
    case 'rerolls': return GAME.round_scores?.times_rerolled?.amt ?? 0;
    case 'interest_cap': return GAME.interest_cap ?? 25;
    case 'stake': return GAME.stake ?? 1;
    case 'hands_per_round': return rr.hands ?? null;
    case 'discards_per_round': return rr.discards ?? null;
    default: return null;
  }
}

class DescEnv implements Env {
  constructor(private values: Record<string, unknown>, private card: any) {}
  lookup(root: string, path: string[]): unknown {
    const first = path[0];
    if (root === 'self') return path.length === 1 ? (this.values[first] ?? null) : null;
    if (root === 'game') return path.length === 1 ? game_field(first) : null;
    if (root === 'joker') {
      const j = this.card;
      if (!j || path.length !== 1) return null;
      if (first === 'position') { const i = (G.jokers?.cards ?? []).indexOf(j); return i >= 0 ? i + 1 : null; }
      if (first === 'sell_value') return j.sell_cost ?? null;
      if (first === 'edition') return j.edition?.type ?? null;
      return null;
    }
    const lists: Record<string, () => any[]> = {
      jokers: () => G.jokers?.cards ?? [], consumables: () => G.consumeables?.cards ?? [], full_deck: () => G.playing_cards ?? [],
      deck: () => G.deck?.cards ?? [], held: () => G.hand?.cards ?? [],
    };
    if (lists[root] && !path.length) return [...lists[root]()];
    return null;
  }
  field(value: unknown, name: string) { return card_field(value, name); }
  call(name: string, args: unknown[]): unknown {
    const [a, b] = args as any[];
    const list: any[] = Array.isArray(a) ? a : [];
    const is_rank = (c: any, r: any) => playing(c) && (typeof r === 'number' ? card_field(c, 'rank') === r : c.base?.value === r);
    switch (name) {
      case 'is_suit': return !!a?.is_suit?.(b);
      case 'is_rank': return is_rank(a, b);
      case 'is_face': return playing(a) && !!a.is_face?.();
      case 'count': return list.length;
      case 'count_suit': return list.filter((c) => c?.is_suit?.(b)).length;
      case 'count_rank': return list.filter((c) => is_rank(c, b)).length;
      case 'count_face': return list.filter((c) => playing(c) && c.is_face?.()).length;
      case 'count_enhancement': case 'count_key': return list.filter((c) => c?.config?.center?.key === b).length;
      case 'count_seal': return list.filter((c) => c?.seal === b).length;
      case 'count_edition': return list.filter((c) => c?.edition?.type === b).length;
      case 'hand_level': return G.GAME?.hands?.[a]?.level ?? null;
      case 'times_played': return G.GAME?.hands?.[a]?.played ?? null;
      case 'has_joker': return (G.jokers?.cards ?? []).some((j: any) => j.config?.center?.key === a);
      case 'has_voucher': return !!G.GAME?.used_vouchers?.[a];
      default: return null; // (chance, random: never in a description)
    }
  }
}

function shown(v: unknown): unknown {
  if (v === null || v === undefined) return '-';
  if (typeof v === 'number' && !Number.isInteger(v)) return Math.round(v * 100) / 100;
  if (typeof v === 'boolean') return v ? 'yes' : 'no';
  return v;
}

/** an item's description values, with its own values (a joker's ability.extra) and the card it is on */
export function mod_loc_vars(item: any, values?: Record<string, unknown> | null, card?: any): unknown[] {
  const env = new DescEnv({ ...(item?.config ?? {}), ...(values ?? {}) }, card ?? null);
  return (item?.vars ?? []).map((e: string | number) => shown(value_of(e, env)));
}

/** the values of an item whose description doesn't change (a deck, a blind) */
export function static_vars(item: any, values: Record<string, unknown>): unknown[] {
  return mod_loc_vars(item, values, null);
}
