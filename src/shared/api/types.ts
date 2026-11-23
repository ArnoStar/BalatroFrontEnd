// BalatroWebAPI's contract (/api/v1), from its OpenAPI schema.
export type Phase = 'blind_select' | 'playing' | 'round_eval' | 'shop' | 'pack' | 'game_over';
export type Area = 'deck' | 'hand' | 'play' | 'discard' | 'jokers' | 'consumables' | 'shop' | 'vouchers' | 'boosters' | 'pack';
export type Slot = 'Small' | 'Big' | 'Boss';

export interface SettingsView {
  seed: string; deck: string; stake: number; challenge: string | null; game_speed: number; seeded?: boolean;
  /** a multiplayer run's mode ('pvp': a lost round costs hit points instead of the run) */
  mode?: string | null;
  /** the version of the mode's rules (coop: 2, one deck for both; 1 or none, a deck each): send it back with the history */
  mode_rules?: number | null;
  /** the content mods the run is played with (their items are in the game's tables while it is open) */
  mods?: ModRefView[];
}

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
  /** a challenge's pinned joker: it stays leftmost */
  pinned?: boolean;
  cost: number | null;
  sell_value: number | null;
  bonus_chips: number | null;
  ability: Record<string, any> | null;
  /** coop: the seat of the player whose joker it is */
  owner?: number | null;
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
  /** consumables used this run by kind (Fortune Teller) and by key (Satellite); APIs before them leave them out */
  consumable_usage_total?: Record<string, number>; consumable_usage?: Record<string, number>;
  /** the hand size the next Ectoplasm takes */
  ecto_minus?: number;
}

export type ActionType = 'select_blind' | 'skip_blind' | 'reroll_boss' | 'play' | 'discard' | 'sort' | 'cash_out' | 'buy' | 'continue'
  | 'reroll' | 'end_shop' | 'use' | 'sell' | 'move' | 'pick' | 'skip_pack'
  /** (a legal action only: a run with a creative mod, POST /games/{id}/creative) */
  | 'creative';

export interface LegalAction {
  type: ActionType; card: number | null; area: Area | null; use: boolean | null; mode: 'rank' | 'suit' | null;
  min_cards: number | null; max_cards: number | null; min_targets: number | null; max_targets: number | null;
  cost: number | null; value: number | null;
}

export interface GameView {
  id: string; version: number; settings: SettingsView; phase: Phase; state: string; won: boolean;
  ante: number; round: number; dollars: number; hands_left: number; discards_left: number; hand_size: number;
  joker_slots: number; consumable_slots: number; round_score: number | null;
  /** the cards the shop offers besides vouchers and packs (2; Overstock and Overstock Plus add one each) */
  shop_slots?: number;
  blind: BlindView | null;
  /** the ante's blinds: in every phase but game_over (Run Info), the choice on the blind select */
  blind_select: BlindSelectView | null;
  hand: CardView[]; jokers: CardView[]; consumables: CardView[]; deck: DeckView; discard_count: number;
  shop: ShopView | null; pack: PackView | null; round_eval: RoundEvalView | null;
  tags: TagView[]; vouchers: string[]; poker_hands: PokerHandView[]; last_hand: HandScore | null; info: RunInfo;
  actions: LegalAction[];
  /** a coop run: whose turn it is, the jokers' halves (`actions` are your seat's) */
  coop?: CoopView | null;
}

export interface GameSummaryView {
  id: string; version: number; settings: SettingsView; phase: Phase; ante: number; round: number; dollars: number;
  won: boolean; created_at: string; updated_at: string;
}

export type GameEvent =
  | { type: 'card_moved'; t: number; card: number; to: Area }
  /** turned face up: `view` is how the card looks (it may end the action in the deck, which the GameView doesn't list) */
  | { type: 'card_flipped'; t: number; card: number; face_down: boolean; view?: CardView | null }
  | { type: 'card_removed'; t: number; card: number; area: Area }
  | { type: 'hand'; t: number; hand?: string | null; level?: number | string | null; chips?: number | string | null; mult?: number | string | null; hand_score?: number | null }
  | { type: 'card_text'; t: number; card: number | null; effect: 'chips' | 'mult' | 'x_mult' | 'dollars' | 'again' | 'debuffed' | 'swap' | 'message'; amount: number | null; message: string | null; held: boolean; edition: boolean }
  | { type: 'hand_scored'; t: number; hand: string; chips: number; mult: number; score: number; round_score: number }
  | { type: 'round_score'; t: number; chips: number }
  | { type: 'dollars'; t: number; amount: number; total: number }
  | { type: 'status_text'; t: number; text: string }
  /** the joker behind a scored or held card's effect wiggles (juice_card) */
  /** a card wiggles: juice_up(scale, rot), null: its defaults (APIs before shop_slots: juice_card's 0.7) */
  | { type: 'card_juiced'; t: number; card: number; scale?: number | null; rot?: number | null }
  /** the card shines with its new edition or seal (Aura, Hex, Deja Vu...); `view` is how it looks */
  | { type: 'card_changed'; t: number; card: number; change: 'edition' | 'seal' | 'enhancement'; view?: CardView | null }
  /** attention_text over a card; `key` is the text's localization key (k_nope_ex: The Wheel of Fortune missed) */
  | { type: 'attention_text'; t: number; card: number; key: string }
  /** the player has just unlocked a joker, voucher or deck (the game's "Unlocked!" notification) */
  | { type: 'card_unlocked'; t: number; key: string; set: string }
  /** coop: the turn passes to this seat (their hand comes up) */
  | { type: 'turn'; t: number; seat: number }
  /** coop: who has asked to leave the shop */
  | { type: 'shop_vote'; t: number; seats: number[] };

export interface ActionResult { game: GameView; events: GameEvent[] }

export interface HandPreview {
  selected: number[]; hand: string | null; display_name: string | null; level: number | null;
  chips: number | null; mult: number | null; scoring: number[]; not_allowed: boolean; hidden: boolean;
}

export type PlayerAction =
  | { type: 'select_blind' | 'skip_blind' | 'reroll_boss' | 'cash_out' | 'reroll' | 'end_shop' | 'skip_pack' | 'continue' }
  | { type: 'play' | 'discard'; cards: number[] }
  | { type: 'sort'; mode: 'rank' | 'suit' }
  | { type: 'buy'; card: number; use?: boolean }
  | { type: 'use' | 'pick'; card: number; targets?: number[] | null }
  | { type: 'sell'; card: number }
  | { type: 'move'; card: number; to: number };

/** a mod to play a run with: a package (an imported file), a published mod's id (and version), or a kept package's hash */
export interface ModChoice { package?: ModPackage; id?: string; version?: string; hash?: string }
export interface NewGameRequest { seed?: string | null; deck?: string; stake?: number; challenge?: string | null; game_speed?: number; mods?: ModChoice[] }

// ------------------------------------------------------------------ content mods
/** a content mod's package: BalatroEngine's format (its docs/mods.md), JSON */
export interface ModPackage {
  format: 1; id: string; name: string; version: string; author?: string; description?: string; tags?: string[];
  loc?: Record<string, { name?: string; description?: string }>;
  rules?: Record<string, number>; creative?: boolean;
  jokers?: any[]; consumables?: any[]; vouchers?: any[]; decks?: any[]; blinds?: any[];
  assets?: Record<string, string>;
}
/** a mod a run is played with: its package is GET /mods/packages/{hash} */
export interface ModRefView { id: string; version: string; hash: string; name: string; creative: boolean }
export interface ModCheck { valid: boolean; errors: string[]; id: string | null; version: string | null; name: string | null; hash: string | null; summary: Record<string, any>; size: number }
export interface ModSummaryView {
  id: string; name: string; version: string; hash: string; description: string; tags: string[]; author: string | null;
  official: boolean; installs: number; summary: Record<string, any>; created_at: string; updated_at: string;
  loc: Record<string, { name?: string; description?: string }>; yours: boolean;
}
export interface ModDetailView extends ModSummaryView { versions: { version: string; hash: string; created_at: string; size: number }[] }
export interface ModListView { items: ModSummaryView[]; total: number }
/** a creative mode change (BalatroEngine's docs/mods.md) */
export interface CreativeRequest {
  op: 'set' | 'level' | 'add' | 'add_card' | 'edit' | 'remove' | 'boss' | 'win';
  what?: string; value?: number; hand?: string; key?: string; card?: number; edition?: string; seal?: string;
  enhancement?: string; rank?: string; suit?: string; to?: 'hand' | 'deck'; eternal?: boolean; perishable?: boolean; rental?: boolean;
}

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
  settings: { seed: string; deck: string; stake: number; challenge: string | null; game_speed: number; seeded?: boolean; mods?: ModRefView[] };
  commands: Record<string, unknown>[];
  /** the player's progress the run started from (null: from before progress was kept, fully unlocked) */
  start_profile?: Record<string, unknown> | null;
  /** the logic of the run's mods, by hash (a rebuild sends them back) */
  mod_packages?: Record<string, Record<string, unknown>>;
}

/** the player's progress (GET /players/me): what the game's profile has unlocked and discovered */
export interface ProgressView {
  all_unlocked: boolean;
  can_unlock_all: boolean;
  unlocked: string[];
  discovered: string[];
  challenges_completed: string[];
  challenges_unlocked: number;
  deck_stakes: Record<string, number>;
  max_stakes: Record<string, number>;
  /** the profile's career stats and voucher redemptions: locked cards' unlock conditions show them */
  career_stats?: Record<string, number>;
  voucher_usage?: Record<string, number>;
}

export interface MeView { id: string; name: string | null; private: boolean; progress: ProgressView }

/** POST /games/{id}/watch: a copy of the run at its start, and the player's actions to play on it */
export interface WatchView {
  source: string;
  owner_name: string | null;
  game: GameView;
  /** `pointer`: the player's pointer before the action, as the game sent it (shared/lib/pointer-trace); null for older runs */
  steps: { version: number; action: Record<string, any>; pointer?: { v: 1; e: (number | string)[][] } | null }[];
  /** the step the copy is at (its first `start` steps played): the next to play (older APIs: none, 0) */
  start?: number;
}

// ------------------------------------------------------------------ multiplayer (/matches)
export type MatchMode = 'pvp' | 'coop';
export type BlindChoice = 'select' | 'skip';
export interface NewMatchRequest { mode: MatchMode; deck?: string; stake?: number; seed?: string | null; timer?: number; game_speed?: number }
export interface MatchSettingsView { deck: string; stake: number; seed: string | null; timer: number }
export interface MatchPlayerView { seat: number; name: string | null; you: boolean; host: boolean; left: boolean }
export interface OpponentView {
  version: number; phase: Phase; state: string; ante: number; round: number; dollars: number; hands_left: number;
  discards_left: number; hand_size: number; joker_slots: number; round_score: number | string; blind: BlindView | null;
  jokers: CardView[]; consumables: number; deck_size: number; vouchers: string[]; poker_hands: PokerHandView[]; won: boolean;
  /** their whole deck, by suit and rank (not its order) */
  full_deck?: DeckCardView[]; deck_remaining?: number;
}
export interface PvPBlindResult {
  index: number; ante: number; slot: Slot | null; chips: (number | string)[]; target: (number | string)[];
  lost: boolean[]; skipped: boolean[]; damage: number[]; hp: number[];
}
export interface BlindVoteView { index: number; yours: BlindChoice | null; theirs: BlindChoice | null; decision: BlindChoice | null }
export interface PvPView {
  start_hp: number; safe_antes: number; loss_damage: number; hp: number[]; blind_index: number; rounds: PvPBlindResult[];
  vote: BlindVoteView | null; waiting: 'round' | 'vote' | null; opponent_waiting: 'round' | 'vote' | null;
  deadline: string | null; can_cash_out: boolean; opponent: OpponentView | null;
}
export interface MatchResultView { winner: number | null; you_won: boolean; reason: string }
export interface MatchView {
  id: string; version: number; code: string; mode: MatchMode; status: 'lobby' | 'playing' | 'finished'; seat: number; host: boolean;
  settings: MatchSettingsView; players: MatchPlayerView[]; run_id: string | null; run_version: number | null;
  pvp: PvPView | null; result: MatchResultView | null; server_time: string;
  coop?: CoopMatchView | null;
  summary?: MatchSummaryView | null;
  rematch?: RematchView | null;
  emotes?: EmoteView[];
}

export type Score = number | string;
export type EmoteName = 'gg' | 'nice' | 'wow' | 'oops' | 'hurry' | 'thanks' | 'good_luck' | 'well_played';
export interface EmoteView { seq: number; seat: number; emote: EmoteName; at: string }
export interface RematchView { match_id: string; code: string; by_you: boolean; open: boolean }
export interface MatchSummaryPlayer {
  seat: number; name: string | null; best_hand: Score;
  hp?: number | null; damage_dealt?: number | null; damage_taken?: number | null; biggest_hit?: number | null;
  rounds_won?: number | null; rounds_lost?: number | null;
  hands?: number | null; chips?: Score | null; best_hand_name?: string | null; discards?: number | null;
}
export interface MatchSummaryView { ante: number; rounds: number; run_won: boolean | null; players: MatchSummaryPlayer[] }
export interface MatchHistoryEntry {
  id: string; mode: MatchMode; settings: MatchSettingsView; seed: string | null; created_at: string; finished_at: string | null;
  seat: number; players: MatchPlayerView[]; result: MatchResultView; summary: MatchSummaryView | null; runs: (string | null)[];
}
export interface MatchHistoryView { matches: MatchHistoryEntry[]; next_before: string | null }
export interface PvPStats {
  played: number; won: number; lost: number; drawn: number; gave_up: number; opponent_left: number; streak: number;
  best_streak: number; damage_dealt: number; damage_taken: number; biggest_hit: number; best_ante: number;
}
export interface CoopStats {
  played: number; runs_won: number; best_ante: number; best_round: number; hands: number; chips: Score;
  best_hand: Score; best_hand_name: string | null;
}
export interface MatchOpponentStats { name: string | null; played: number; won: number; lost: number; best_ante: number }
export interface MultiplayerStats { pvp: PvPStats; coop: CoopStats; rivals: MatchOpponentStats[]; partners: MatchOpponentStats[] }
export interface CoopDeckView { seat: number; full_deck: DeckCardView[]; remaining: DeckCardView[] }
export interface CoopDecksView { seats: CoopDeckView[] }

export interface CoopView {
  seat: number | null; turn: number; your_turn: boolean; joker_slots: number[]; shop_votes: number[];
  pack_seat: number | null; seats: CoopSeatView[];
  /** one deck and hand for both players (else each has their own: mode_rules 1) */
  shared_deck?: boolean;
}
export interface CoopSeatView {
  deck: number; hand: number; hands?: number; chips?: Score; best_hand?: Score; best_hand_name?: string | null; discards?: number;
}
export interface CoopMatchView {
  turn: number; your_turn: boolean; selection: number[]; selection_seq: number; over: boolean;
  /** whose selection it is: the turn's player's, or the pack's opener's while it is open */
  selecting?: number | null;
}
export interface CoopStep { version: number; seat: number; action: Record<string, any>; events: GameEvent[]; game: GameView }
export interface CoopStepsView { steps: CoopStep[]; complete: boolean }
