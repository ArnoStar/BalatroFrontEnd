// The words of a `card_text` event of effect `message`. The API names a few of
// them (plus_planet, boss_disabled...); for the others the text depends on the
// joker that spoke, as in Card:calculate_joker (card.lua), filled in with the
// joker's numbers after the action.
import { G } from '@/shared/lib/engine';
import { localize } from '@/shared/lib/localization';
import type { GameView } from '@/shared/api';
import type { Card } from '@/entities/card/@x/run';
import type { StatusExtra } from './effects';

export interface MessageContext {
  /** the card leaves later in this action (eaten, melted, extinct...) */
  removed: boolean;
  /** the action's type */
  action: string;
  view: GameView;
}

const v = (key: string, vars: any[]) => localize({ type: 'variable', key, vars });
const k = (key: string) => localize(key);

type Msg = [string, any?];
const JOKERS: Record<string, (ab: any, c: MessageContext) => Msg | null> = {
  Perkeo: () => [k('k_duplicated_ex')],
  Hallucination: () => [k('k_plus_tarot'), G.C.PURPLE],
  Luchador: () => [k('ph_boss_disabled')],
  Chicot: () => [k('ph_boss_disabled')],
  'Invisible Joker': (ab, c) => {
    if (c.action === 'sell') return [k('k_duplicated_ex')];
    const r = ab.invis_rounds ?? 0, n = ab.extra ?? 2;
    return [r < n ? `${r}/${n}` : k('k_active_ex'), G.C.FILTER];
  },
  Campfire: (_ab, c) => (c.action === 'sell' ? [k('k_upgrade_ex')] : [k('k_reset'), G.C.RED]),
  'Flash Card': (ab) => [v('a_mult', [ab.mult]), G.C.MULT],
  Throwback: (ab) => [v('a_xmult', [ab.x_mult]), G.C.RED],
  'Red Card': (ab) => [v('a_mult', [ab.extra]), G.C.RED],
  Hologram: (ab) => [v('a_xmult', [ab.x_mult])],
  Madness: (ab) => [v('a_xmult', [ab.x_mult])],
  Burglar: (ab) => [v('a_hands', [ab.extra])],
  'Riff-raff': () => [k('k_plus_joker'), G.C.BLUE],
  Cartomancer: () => [k('k_plus_tarot'), G.C.PURPLE],
  'Ceremonial Dagger': (ab) => [v('a_mult', [ab.mult]), G.C.RED],
  'Marble Joker': () => [k('k_plus_stone'), G.C.SECONDARY_SET.Enhanced],
  'Sixth Sense': () => [k('k_plus_spectral'), G.C.SECONDARY_SET.Spectral],
  Caino: (ab) => [v('a_xmult', [ab.caino_xmult])],
  'Glass Joker': (ab) => [v('a_xmult', [ab.x_mult])],
  'Fortune Teller': () => [k('k_upgrade_ex')],
  Constellation: (ab) => [v('a_xmult', [ab.x_mult])],
  'Burnt Joker': () => [k('k_upgrade_ex')],
  Ramen: (ab, c) => (c.removed ? [k('k_eaten_ex'), G.C.FILTER] : [v('a_xmult_minus', [ab.extra]), G.C.RED]),
  Yorick: (ab) => [v('a_xmult', [ab.x_mult]), G.C.RED],
  Castle: () => [k('k_upgrade_ex'), G.C.CHIPS],
  'Hit the Road': (ab, c) => (c.action === 'discard' ? [v('a_xmult', [ab.x_mult]), G.C.RED] : [k('k_reset'), G.C.RED]),
  'Green Joker': (ab, c) => (c.action === 'discard'
    ? [v('a_mult_minus', [ab.extra?.discard_sub]), G.C.RED]
    : [v('a_mult', [ab.extra?.hand_add])]),
  Rocket: () => [k('k_upgrade_ex'), G.C.MONEY],
  'Turtle Bean': (ab, c) => (c.removed ? [k('k_eaten_ex'), G.C.FILTER] : [v('a_handsize_minus', [ab.extra?.h_mod]), G.C.FILTER]),
  Popcorn: (ab, c) => (c.removed ? [k('k_eaten_ex'), G.C.RED] : [v('a_mult_minus', [ab.extra]), G.C.MULT]),
  'To Do List': () => [k('k_reset')],
  Egg: () => [k('k_val_up'), G.C.MONEY],
  'Gift Card': () => [k('k_val_up'), G.C.MONEY],
  'Gros Michel': (_ab, c) => [c.removed ? k('k_extinct_ex') : k('k_safe_ex')],
  Cavendish: (_ab, c) => [c.removed ? k('k_extinct_ex') : k('k_safe_ex')],
  'Mr. Bones': () => [k('k_saved_ex'), G.C.RED],
  Hiker: () => [k('k_upgrade_ex'), G.C.CHIPS],
  'Lucky Cat': () => [k('k_upgrade_ex'), G.C.MULT],
  'Wee Joker': () => [k('k_upgrade_ex'), G.C.CHIPS],
  '8 Ball': () => [k('k_plus_tarot')],
  'Spare Trousers': () => [k('k_upgrade_ex'), G.C.RED],
  'Space Joker': () => [k('k_level_up_ex')],
  'Square Joker': () => [k('k_upgrade_ex'), G.C.CHIPS],
  Runner: () => [k('k_upgrade_ex'), G.C.CHIPS],
  'Midas Mask': () => [k('k_gold'), G.C.MONEY],
  Vampire: (ab) => [v('a_xmult', [ab.x_mult]), G.C.MULT],
  DNA: () => [k('k_copied_ex'), G.C.CHIPS],
  'Ride the Bus': () => [k('k_reset')],
  Obelisk: () => [k('k_reset')],
  'Ice Cream': (ab, c) => (c.removed ? [k('k_melted_ex'), G.C.CHIPS] : [v('a_chips_minus', [ab.extra?.chip_mod]), G.C.CHIPS]),
  Seltzer: (_ab, c) => (c.removed ? [k('k_drank_ex'), G.C.FILTER] : [k('k_again_ex')]),
  Vagabond: () => [k('k_plus_tarot')],
  Superposition: () => [k('k_plus_tarot'), G.C.SECONDARY_SET.Tarot],
  Seance: () => [k('k_plus_spectral'), G.C.SECONDARY_SET.Spectral],
  Matador: (ab) => [localize('$') + ab.extra, G.C.MONEY],
  'Trading Card': (ab) => [localize('$') + ab.extra, G.C.MONEY],
  'Mail-In Rebate': (ab) => [localize('$') + ab.extra, G.C.MONEY],
  'Faceless Joker': (ab) => [localize('$') + ab.extra?.dollars, G.C.MONEY],
  'Diet Cola': () => [k('k_plus_tag') ?? '', G.C.FILTER],
};

const KEYS: Record<string, (card: Card) => Msg> = {
  plus_planet: () => [k('k_plus_planet'), G.C.SECONDARY_SET.Planet],
  plus_tarot: () => [k('k_plus_tarot'), G.C.PURPLE],
  boss_disabled: () => [k('ph_boss_disabled')],
  disabled: () => [k('k_disabled_ex'), G.C.FILTER],
  remaining: (card) => [v('a_remaining', [card.ability.perish_tally]), G.C.FILTER],
  again: () => [k('k_again_ex')],
};

export function joker_message(card: Card, key: string | null, c: MessageContext): StatusExtra | null {
  let m: Msg | null = null;
  if (key && KEYS[key]) m = KEYS[key](card);
  else if (card.ability?.set === 'Joker' && JOKERS[card.ability.name]) m = JOKERS[card.ability.name](card.ability, c);
  else if (card.debuff) m = [k('k_debuffed'), G.C.RED];
  if (!m || !m[0]) return null;
  const ex: StatusExtra = { message: m[0] };
  if (m[1]) ex.colour = m[1];
  if (key === 'disabled' || key === 'remaining') ex.delay = 0.45;
  return ex;
}
