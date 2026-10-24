// Game:init_game_object (game.lua): G.GAME, the run state the UI reads. In
// this front end it mirrors the API's GameView (see sync.ts): the UI binds to
// these fields exactly as the game's UI does.
import { G } from '@/shared/lib/engine';

export function get_starting_params() {
  return {
    dollars: 4, hand_size: 8, discards: 3, hands: 4, reroll_cost: 5, joker_slots: 5, ante_scaling: 1, consumable_slots: 2,
    no_faces: false, erratic_suits_and_ranks: false,
  };
}

const HANDS: [string, boolean, number, number, number, number, number][] = [
  // name, visible, order, mult, chips, l_mult, l_chips
  ['Flush Five', false, 1, 16, 160, 3, 50],
  ['Flush House', false, 2, 14, 140, 4, 40],
  ['Five of a Kind', false, 3, 12, 120, 3, 35],
  ['Straight Flush', true, 4, 8, 100, 4, 40],
  ['Four of a Kind', true, 5, 7, 60, 3, 30],
  ['Full House', true, 6, 4, 40, 2, 25],
  ['Flush', true, 7, 4, 35, 2, 15],
  ['Straight', true, 8, 4, 30, 3, 30],
  ['Three of a Kind', true, 9, 3, 30, 2, 20],
  ['Two Pair', true, 10, 2, 20, 1, 20],
  ['Pair', true, 11, 2, 10, 1, 15],
  ['High Card', true, 12, 1, 5, 1, 10],
];

const EXAMPLES: Record<string, [string, boolean][]> = {
  'Flush Five': [['S_A', true], ['S_A', true], ['S_A', true], ['S_A', true], ['S_A', true]],
  'Flush House': [['D_7', true], ['D_7', true], ['D_7', true], ['D_4', true], ['D_4', true]],
  'Five of a Kind': [['S_A', true], ['H_A', true], ['H_A', true], ['C_A', true], ['D_A', true]],
  'Straight Flush': [['S_Q', true], ['S_J', true], ['S_T', true], ['S_9', true], ['S_8', true]],
  'Four of a Kind': [['S_J', true], ['H_J', true], ['C_J', true], ['D_J', true], ['C_3', false]],
  'Full House': [['H_K', true], ['C_K', true], ['D_K', true], ['S_2', true], ['D_2', true]],
  Flush: [['H_A', true], ['H_K', true], ['H_T', true], ['H_5', true], ['H_4', true]],
  Straight: [['D_J', true], ['C_T', true], ['C_9', true], ['S_8', true], ['H_7', true]],
  'Three of a Kind': [['S_T', true], ['C_T', true], ['D_T', true], ['H_6', false], ['D_5', false]],
  'Two Pair': [['H_A', true], ['D_A', true], ['C_Q', false], ['H_4', true], ['C_4', true]],
  Pair: [['S_K', false], ['S_9', true], ['D_9', true], ['H_6', false], ['D_3', false]],
  'High Card': [['S_A', true], ['D_Q', false], ['D_9', false], ['C_4', false], ['D_3', false]],
};

export function init_game_object(): any {
  const bosses_used: Record<string, number> = {};
  for (const k of Object.keys(G.P_BLINDS)) if (G.P_BLINDS[k].boss) bosses_used[k] = 0;
  const hands: Record<string, any> = {};
  for (const [name, visible, order, mult, chips, l_mult, l_chips] of HANDS) {
    hands[name] = { visible, order, mult, chips, s_mult: mult, s_chips: chips, level: 1, l_mult, l_chips, played: 0, played_this_round: 0, example: EXAMPLES[name] };
  }
  const cards_played: Record<string, any> = {};
  for (const r of ['Ace', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'Jack', 'Queen', 'King']) cards_played[r] = { suits: {}, total: 0 };
  return {
    won: false,
    round_scores: {
      furthest_ante: { label: 'Ante', amt: 0 },
      furthest_round: { label: 'Round', amt: 0 },
      hand: { label: 'Best Hand', amt: 0 },
      poker_hand: { label: 'Most Played Hand', amt: 0 },
      new_collection: { label: 'New Discoveries', amt: 0 },
      cards_played: { label: 'Cards Played', amt: 0 },
      cards_discarded: { label: 'Cards Discarded', amt: 0 },
      times_rerolled: { label: 'Times Rerolled', amt: 0 },
      cards_purchased: { label: 'Cards Purchased', amt: 0 },
    },
    joker_usage: {},
    consumeable_usage: {},
    hand_usage: {},
    last_tarot_planet: null,
    win_ante: 8,
    stake: 1,
    modifiers: {},
    starting_params: get_starting_params(),
    banned_keys: {},
    round: 0,
    probabilities: { normal: 1 },
    bosses_used,
    pseudorandom: {},
    starting_deck_size: 52,
    ecto_minus: 1,
    pack_size: 2,
    skips: 0,
    STOP_USE: 0,
    edition_rate: 1,
    joker_rate: 20,
    tarot_rate: 4,
    planet_rate: 4,
    spectral_rate: 0,
    playing_card_rate: 0,
    consumeable_buffer: 0,
    joker_buffer: 0,
    discount_percent: 0,
    interest_cap: 25,
    interest_amount: 1,
    inflation: 0,
    hands_played: 0,
    unused_discards: 0,
    perishable_rounds: 5,
    rental_rate: 3,
    blind: null,
    chips: 0,
    chips_text: '0',
    voucher_text: '',
    dollars: 0,
    max_jokers: 0,
    bankrupt_at: 0,
    current_boss_streak: 0,
    base_reroll_cost: 5,
    blind_on_deck: null,
    sort: 'desc',
    previous_round: { dollars: 4 },
    tags: [],
    tag_tally: 0,
    pool_flags: {},
    used_jokers: {},
    used_vouchers: {},
    current_round: {
      current_hand: {
        chips: 0, chip_text: '0', mult: 0, mult_text: '0', chip_total: 0, chip_total_text: '', handname: '', hand_level: '',
      },
      used_packs: {},
      cards_flipped: 0,
      round_text: 'Round ',
      idol_card: { suit: 'Spades', rank: 'Ace' },
      mail_card: { rank: 'Ace' },
      ancient_card: { suit: 'Spades' },
      castle_card: { suit: 'Spades' },
      hands_left: 0,
      hands_played: 0,
      discards_left: 0,
      discards_used: 0,
      dollars: 0,
      reroll_cost: 5,
      reroll_cost_increase: 0,
      jokers_purchased: 0,
      free_rerolls: 0,
      round_dollars: 0,
      dollars_to_be_earned: '!!!',
      most_played_poker_hand: 'High Card',
    },
    round_resets: {
      hands: 1,
      discards: 1,
      reroll_cost: 1,
      temp_reroll_cost: null,
      temp_handsize: null,
      ante: 1,
      blind_ante: 1,
      blind_states: { Small: 'Select', Big: 'Upcoming', Boss: 'Upcoming' },
      loc_blind_states: { Small: '', Big: '', Boss: '' },
      blind_choices: { Small: 'bl_small', Big: 'bl_big' },
      boss_rerolled: false,
    },
    round_bonus: { next_hands: 0, discards: 0 },
    shop: { joker_max: 2 },
    cards_played,
    hands,
  };
}
