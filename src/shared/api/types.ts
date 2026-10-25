// BalatroWebAPI's contract (/api/v1), from its OpenAPI schema.
export type Phase = 'blind_select' | 'playing' | 'round_eval' | 'shop' | 'pack' | 'game_over';
export type Area = 'deck' | 'hand' | 'play' | 'discard' | 'jokers' | 'consumables' | 'shop' | 'vouchers' | 'boosters' | 'pack';
export type Slot = 'Small' | 'Big' | 'Boss';

export interface SettingsView { seed: string; deck: string; stake: number; challenge: string | null; game_speed: number }

export interface Stickers { eternal: boolean; perishable: number | null; rental: boolean }

export interface CardView {
  id: number;
  kind: 'playing_card' | 'joker' | 'tarot' | 'planet' | 'spectral' | 'voucher' | 'booster';
  face_down: boolean;
  key: string | null;
  name: string | null;
  rank: string | null;
  suit: string | null;
  card_key: string | null;
  enhancement: string | null;
  edition: 'foil' | 'holo' | 'polychrome' | 'negative' | null;
  seal: 'Gold' | 'Red' | 'Blue' | 'Purple' | null;
  stickers: Stickers | null;
  rarity: number | null;
  debuffed: boolean;
  selected: boolean;
  forced_selection: boolean;
  cost: number | null;
  sell_value: number | null;
  bonus_chips: number | null;
  ability: Record<string, any> | null;
}

export interface TagView { key: string; name: string; orbital_hand: string | null }
export interface BlindChoiceView {
  slot: Slot; key: string; name: string; state: 'Select' | 'Upcoming' | 'Current' | 'Defeated' | 'Skipped' | 'Hide';
  chips: number; reward: number; skip_tag: TagView | null;
}
export interface BlindSelectView { on_deck: Slot; choices: BlindChoiceView[]; boss_reroll_cost: number | null }
export interface BlindView { key: string; name: string; slot: Slot | null; chips: number; reward: number; boss: boolean; disabled: boolean }
export interface DeckCardView { key: string; card_key: string; rank: string; suit: string; enhancement: string | null; edition: string | null; seal: string | null }
export interface DeckView { remaining: number; total: number; cards: DeckCardView[] }
export interface ShopView { jokers: CardView[]; vouchers: CardView[]; boosters: CardView[]; reroll_cost: number; free_rerolls: number }
export interface PackView { kind: 'tarot' | 'planet' | 'spectral' | 'standard' | 'buffoon'; cards: CardView[]; choices_left: number }
export interface RoundEvalRow { kind: 'blind' | 'hands' | 'discards' | 'joker' | 'tag' | 'interest'; dollars: number; key: string | null }
export interface RoundEvalView { rows: RoundEvalRow[]; total: number }
export interface PokerHandView { name: string; display_name: string; level: number; chips: number; mult: number; played: number; visible: boolean }
export interface HandScore { hand: string; chips: number; mult: number; score: number }
export interface RoundTargets {
  idol_rank: string | null; idol_suit: string | null; mail_rank: string | null; ancient_suit: string | null;
  castle_suit: string | null; most_played_hand: string | null;
}
export interface RunInfo {
  probability_normal: number; last_tarot_planet: string | null; interest_amount: number; interest_cap: number;
  discount_percent: number; bankrupt_at: number; skips: number; hands_played: number; unused_discards: number;
  round_targets: RoundTargets;
}

export type ActionType = 'select_blind' | 'skip_blind' | 'reroll_boss' | 'play' | 'discard' | 'sort' | 'cash_out' | 'buy'
  | 'reroll' | 'end_shop' | 'use' | 'sell' | 'move' | 'pick' | 'skip_pack';

export interface LegalAction {
  type: ActionType; card: number | null; area: Area | null; use: boolean | null; mode: 'rank' | 'suit' | null;
  min_cards: number | null; max_cards: number | null; min_targets: number | null; max_targets: number | null;
  cost: number | null; value: number | null;
}

export interface GameView {
  id: string; version: number; settings: SettingsView; phase: Phase; state: string; won: boolean;
  ante: number; round: number; dollars: number; hands_left: number; discards_left: number; hand_size: number;
  joker_slots: number; consumable_slots: number; round_score: number | null;
  blind: BlindView | null; blind_select: BlindSelectView | null;
  hand: CardView[]; jokers: CardView[]; consumables: CardView[]; deck: DeckView; discard_count: number;
  shop: ShopView | null; pack: PackView | null; round_eval: RoundEvalView | null;
  tags: TagView[]; vouchers: string[]; poker_hands: PokerHandView[]; last_hand: HandScore | null; info: RunInfo;
  actions: LegalAction[];
}

export interface GameSummaryView {
  id: string; version: number; settings: SettingsView; phase: Phase; ante: number; round: number; dollars: number;
  won: boolean; created_at: string; updated_at: string;
}

export type GameEvent =
  | { type: 'card_moved'; t: number; card: number; to: Area }
  | { type: 'card_flipped'; t: number; card: number; face_down: boolean }
  | { type: 'card_removed'; t: number; card: number; area: Area }
  | { type: 'hand'; t: number; hand?: string | null; level?: number | string | null; chips?: number | string | null; mult?: number | string | null; hand_score?: number | null }
  | { type: 'card_text'; t: number; card: number | null; effect: 'chips' | 'mult' | 'x_mult' | 'dollars' | 'again' | 'debuffed' | 'swap' | 'message'; amount: number | null; message: string | null; held: boolean; edition: boolean }
  | { type: 'hand_scored'; t: number; hand: string; chips: number; mult: number; score: number; round_score: number }
  | { type: 'round_score'; t: number; chips: number }
  | { type: 'dollars'; t: number; amount: number; total: number }
  | { type: 'status_text'; t: number; text: string };

export interface ActionResult { game: GameView; events: GameEvent[] }

export interface HandPreview {
  selected: number[]; hand: string | null; display_name: string | null; level: number | null;
  chips: number | null; mult: number | null; scoring: number[]; not_allowed: boolean; hidden: boolean;
}

export type PlayerAction =
  | { type: 'select_blind' | 'skip_blind' | 'reroll_boss' | 'cash_out' | 'reroll' | 'end_shop' | 'skip_pack' }
  | { type: 'play' | 'discard'; cards: number[] }
  | { type: 'sort'; mode: 'rank' | 'suit' }
  | { type: 'buy'; card: number; use?: boolean }
  | { type: 'use' | 'pick'; card: number; targets?: number[] | null }
  | { type: 'sell'; card: number }
  | { type: 'move'; card: number; to: number };

export interface NewGameRequest { seed?: string | null; deck?: string; stake?: number; challenge?: string | null; game_speed?: number }

export interface Sprite { atlas: string; pos: { x: number; y: number }; soul_pos: { x: number; y: number } | null }
export interface ChallengeItem { id: string; name: string; deck: string; jokers: string[]; consumables: string[]; vouchers: string[] }

export interface ProblemDetails {
  type: string; title: string; status: number; detail: string; code: string;
  expected_version?: number; current_version?: number;
}

/** GET /games/{id}/history: the run's settings and the engine commands that rebuild it */
export interface HistoryView {
  id: string;
  version: number;
  engine_version: string;
  settings: { seed: string; deck: string; stake: number; challenge: string | null; game_speed: number; seeded?: boolean };
  commands: Record<string, unknown>[];
}
