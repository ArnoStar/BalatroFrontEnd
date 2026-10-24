// The run: G.GAME (the client mirror of the API's GameView), the cards on
// screen for the API's cards, and the pipeline that plays an action.
export { init_game_object, get_starting_params } from './model/game-object';
export { run, set_view, clear_run, legal, is_legal, area_views, find_view, VIEW_AREAS } from './model/store';
export { sync_game, sync_settings, reconcile_all, area_of } from './model/sync';
export {
  card_by_id, register_card, forget_card, clear_cards, create_card, create_back_card, apply_card_view, card_for_view, reconcile_area,
} from './model/cards';
export {
  ease_dollars, ease_dollars_now, ease_chips, ease_chips_now, ease_hands_played, ease_discard, ease_ante, ease_round,
  update_hand_text, update_hand_text_now, card_eval_status_text_now, play_area_status_text_now, highlight_card,
  ease_background_colour_blind, stop_use, alert_no_space,
} from './model/effects';
export type { HandTextConfig, HandTextVals, StatusExtra } from './model/effects';
export { Timeline, default_hooks } from './model/timeline';
export type { TimelineHooks, Removal } from './model/timeline';
export { perform, perform_debug, resync, playing, timeline_playing, finish_action } from './model/perform';
export type { Choreography } from './model/perform';
export { full_deck, deck_card } from './model/deck';
export type { DeckCard } from './model/deck';
