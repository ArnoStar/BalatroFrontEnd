// The run's playing cards (G.playing_cards), as the deck screens and the
// jokers that count cards (Steel Joker, Cloud 9...) read them. The API lists
// what is left in the deck; the cards out of it are those on screen (hand,
// play, discard pile) or, when they are not known, the difference with the
// last time the whole deck was in the pile.
import { G } from '@/shared/lib/engine';
import type { GameView, DeckCardView } from '@/shared/api';

const RANKS: Record<string, [number, number, number]> = {
  '2': [2, 0, 2], '3': [3, 0, 3], '4': [4, 0, 4], '5': [5, 0, 5], '6': [6, 0, 6], '7': [7, 0, 7], '8': [8, 0, 8],
  '9': [9, 0, 9], '10': [10, 0, 10], Jack: [10, 0.1, 11], Queen: [10, 0.2, 12], King: [10, 0.3, 13], Ace: [11, 0.4, 14],
};
const SUIT_NOM: Record<string, number> = { Diamonds: 0.01, Clubs: 0.02, Hearts: 0.03, Spades: 0.04 };

export interface DeckCard {
  base: { suit: string; id: number; value: string };
  ability: { name: string; effect: string; wheel_flipped?: boolean };
  config: { center: any; card: any };
  in_deck: boolean;
  debuff: boolean;
  card_key: string;
  center_key: string;
  edition: string | null;
  seal: string | null;
  get_nominal(mod?: string): number;
  is_suit(s: string): boolean;
  is_face(): boolean;
  get_id(): number;
}

function joker_named(name: string) {
  return (G.jokers?.cards ?? []).some((j: any) => j.ability.name === name && !j.debuff);
}

export function deck_card(card_key: string, center_key: string, edition: string | null, seal: string | null, in_deck: boolean, debuff = false, wheel = false): DeckCard {
  const front = G.P_CARDS[card_key] ?? { suit: 'Spades', value: 'Ace' };
  const center = G.P_CENTERS[center_key] ?? G.P_CENTERS.c_base;
  const r = RANKS[front.value] ?? [0, 0, 0];
  const stone = center.name === 'Stone Card';
  const wild = center.name === 'Wild Card';
  return {
    base: { suit: front.suit, id: r[2], value: front.value },
    ability: { name: center.name, effect: stone ? 'Stone Card' : (center.effect ?? ''), wheel_flipped: wheel },
    config: { center, card: front },
    in_deck, debuff, card_key, center_key, edition, seal,
    get_nominal(mod) {
      const mult = stone ? -1000 : mod === 'suit' ? 1000 : 1;
      return r[0] + (SUIT_NOM[front.suit] ?? 0) * mult + r[1];
    },
    is_suit(s) {
      if (stone) return false;
      if (wild && !debuff) return true;
      const red = (x: string) => x === 'Hearts' || x === 'Diamonds';
      if (joker_named('Smeared Joker') && red(front.suit) === red(s)) return true;
      return front.suit === s;
    },
    is_face() {
      if (debuff) return false;
      return r[2] === 11 || r[2] === 12 || r[2] === 13 || joker_named('Pareidolia');
    },
    get_id() { return stone ? -1 : r[2]; },
  };
}

const sig = (card_key: string, key: string, edition: string | null, seal: string | null) => `${card_key}|${key}|${edition ?? ''}|${seal ?? ''}`;

/** the whole deck, the last time it was all in the pile (per run) */
const snapshots = new Map<string, DeckCardView[]>();

/** G.playing_cards for a view */
export function full_deck(view: GameView): DeckCard[] {
  const out: DeckCard[] = [];
  if (view.deck.remaining === view.deck.total && view.deck.cards.length === view.deck.total) snapshots.set(view.id, view.deck.cards);
  for (const d of view.deck.cards) out.push(deck_card(d.card_key, d.key, d.edition, d.seal, true));
  for (const a of [G.hand, G.play, G.discard]) {
    for (const c of a?.cards ?? []) {
      if (!c.base || !c.base.value || !c.config.card_key) continue;
      out.push(deck_card(c.config.card_key, c.config.center.key, c.edition?.type ?? null, c.seal ?? null, false, c.debuff, a === G.hand && c.facing === 'back'));
    }
  }
  const snap = snapshots.get(view.id);
  if (snap && out.length < view.deck.total) {
    // the cards out of the deck that are not on screen: the snapshot minus what is known
    const left = new Map<string, number>();
    for (const d of snap) left.set(sig(d.card_key, d.key, d.edition, d.seal), (left.get(sig(d.card_key, d.key, d.edition, d.seal)) ?? 0) + 1);
    for (const c of out) {
      const k = sig(c.card_key, c.center_key, c.edition, c.seal);
      if (left.get(k)) left.set(k, left.get(k)! - 1);
    }
    for (const d of snap) {
      const k = sig(d.card_key, d.key, d.edition, d.seal);
      if (out.length >= view.deck.total) break;
      if (left.get(k)) { left.set(k, left.get(k)! - 1); out.push(deck_card(d.card_key, d.key, d.edition, d.seal, false)); }
    }
  }
  return out.sort((a, b) => b.get_nominal('suit') - a.get_nominal('suit'));
}
