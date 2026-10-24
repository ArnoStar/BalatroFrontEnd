// Game:start_run (game.lua): the run's room (card areas, background, HUD) set
// up from a GameView, either at a new run's blind select or mid-run when a
// saved run is opened.
import { G, Sprite, UIBox, Event, prep_stage, delay } from '@/shared/lib/engine';
import type { GameView } from '@/shared/api';
import { CardArea } from '@/entities/card';
import { Blind } from '@/entities/blind';
import { Tag, add_tag } from '@/entities/tag';
import {
  init_game_object, set_view, sync_game, full_deck, sync_settings, clear_cards, create_card, create_back_card, ease_background_colour_blind,
} from '@/entities/run';
import { create_UIBox_HUD, create_UIBox_HUD_blind } from '@/widgets/hud';
import { run_stage_update } from './states';

/** set_screen_positions (common_events.lua) */
export function set_screen_positions() {
  if (G.STAGE !== G.STAGES.RUN) return;
  G.hand.T.x = G.TILE_W - G.hand.T.w - 2.85;
  G.hand.T.y = G.TILE_H - G.hand.T.h;
  G.play.T.x = G.hand.T.x + (G.hand.T.w - G.play.T.w) / 2;
  G.play.T.y = G.hand.T.y - 3.6;
  G.jokers.T.x = G.hand.T.x - 0.1;
  G.jokers.T.y = 0;
  G.consumeables.T.x = G.jokers.T.x + G.jokers.T.w + 0.2;
  G.consumeables.T.y = 0;
  G.deck.T.x = G.TILE_W - G.deck.T.w - 0.5;
  G.deck.T.y = G.TILE_H - G.deck.T.h;
  G.discard.T.x = G.jokers.T.x + G.jokers.T.w / 2 + 0.3 + 15;
  G.discard.T.y = 4.2;
  for (const a of [G.hand, G.play, G.jokers, G.consumeables, G.deck, G.discard]) a.hard_set_VT();
}

const STATE_OF: Record<string, string> = {
  BLIND_SELECT: 'BLIND_SELECT', SELECTING_HAND: 'SELECTING_HAND', ROUND_EVAL: 'ROUND_EVAL', SHOP: 'SHOP',
  TAROT_PACK: 'TAROT_PACK', PLANET_PACK: 'PLANET_PACK', SPECTRAL_PACK: 'SPECTRAL_PACK', STANDARD_PACK: 'STANDARD_PACK',
  BUFFOON_PACK: 'BUFFOON_PACK', GAME_OVER: 'GAME_OVER',
};

function state_of(view: GameView) {
  return G.STATES[STATE_OF[view.state] ?? 'BLIND_SELECT'] ?? G.STATES.BLIND_SELECT;
}

/** the run's screen for `view` */
export function start_run(view: GameView) {
  set_view(view);
  clear_cards();
  const state = state_of(view);
  prep_stage(G.STAGES.RUN, state);
  G.STAGE = G.STAGES.RUN;
  G.STAGE_UPDATE = run_stage_update;
  G.STATE_COMPLETE = false;
  G.RESET_BLIND_STATES = true;
  G.GAME = init_game_object();
  G.GAME.modifiers = G.GAME.modifiers ?? {};
  G.GAME.STOP_USE = 0;
  sync_settings(view);
  const mid_round = view.phase === 'playing' || view.phase === 'round_eval' || (view.phase === 'game_over' && view.blind?.key);
  ease_background_colour_blind(G.STATE, mid_round && view.blind?.name ? view.blind.name : 'Small Blind');

  for (let i = 0; i < 4; i++) { G.C.UI_CHIPS[i] = G.C.BLUE[i]; G.C.UI_MULT[i] = G.C.RED[i]; }
  G.GAME.chips_text = '';

  G.CONTROLLER.locks.load = true;
  G.E_MANAGER.add_event(new Event({
    no_delete: true, trigger: 'after', blocking: false, blockable: false, delay: 3.5, timer: 'TOTAL',
    func: () => { G.CONTROLLER.locks.load = null; return true; },
  }));

  const CAI = {
    discard_W: G.CARD_W, discard_H: G.CARD_H, deck_W: G.CARD_W * 1.1, deck_H: 0.95 * G.CARD_H, hand_W: 6 * G.CARD_W, hand_H: 0.95 * G.CARD_H,
    play_W: 5.3 * G.CARD_W, play_H: 0.95 * G.CARD_H, joker_W: 4.9 * G.CARD_W, joker_H: 0.95 * G.CARD_H, consumeable_W: 2.3 * G.CARD_W,
    consumeable_H: 0.95 * G.CARD_H,
  };
  const sp = G.GAME.starting_params;
  G.consumeables = new CardArea(0, 0, CAI.consumeable_W, CAI.consumeable_H, { card_limit: view.consumable_slots ?? sp.consumable_slots, type: 'joker', highlight_limit: 1 });
  G.jokers = new CardArea(0, 0, CAI.joker_W, CAI.joker_H, { card_limit: view.joker_slots ?? sp.joker_slots, type: 'joker', highlight_limit: 1 });
  G.discard = new CardArea(0, 0, CAI.discard_W, CAI.discard_H, { card_limit: 500, type: 'discard' });
  G.deck = new CardArea(0, 0, CAI.deck_W, CAI.deck_H, { card_limit: 52, type: 'deck' });
  G.hand = new CardArea(0, 0, CAI.hand_W, CAI.hand_H, { card_limit: view.hand_size ?? sp.hand_size, type: 'hand' });
  G.play = new CardArea(0, 0, CAI.play_W, CAI.play_H, { card_limit: 5, type: 'play' });
  G.playing_cards = [];
  set_screen_positions();

  G.SPLASH_BACK = new Sprite(-30, -6, G.ROOM.T.w + 60, G.ROOM.T.h + 12, G.ASSET_ATLAS.ui_1, { x: 2, y: 0 });
  G.SPLASH_BACK.set_alignment({ major: G.play, type: 'cm', bond: 'Strong', offset: { x: 0, y: 0 } });
  G.ARGS.spin = { amount: 0, real: 0, eased: 0 };
  G.SPLASH_BACK.define_draw_steps([{
    shader: 'background',
    send: [
      { name: 'time', ref_table: G.TIMERS, ref_value: 'REAL_SHADER' },
      { name: 'spin_time', ref_table: G.TIMERS, ref_value: 'BACKGROUND' },
      { name: 'colour_1', ref_table: G.C.BACKGROUND, ref_value: 'C' },
      { name: 'colour_2', ref_table: G.C.BACKGROUND, ref_value: 'L' },
      { name: 'colour_3', ref_table: G.C.BACKGROUND, ref_value: 'D' },
      { name: 'contrast', ref_table: G.C.BACKGROUND, ref_value: 'contrast' },
      { name: 'spin_amount', ref_table: G.ARGS.spin, ref_value: 'amount' },
    ],
  }]);
  G.E_MANAGER.add_event(new Event({
    trigger: 'immediate', blocking: false, blockable: false,
    func: () => {
      const s = G.ARGS.spin;
      const _dt = s.amount > s.eased ? G.real_dt * 2 : 0.3 * G.real_dt;
      let delta = s.real - s.eased;
      if (Math.abs(delta) > _dt) delta = delta * _dt / Math.abs(delta);
      s.eased += delta;
      s.amount = _dt * s.eased + (1 - _dt) * s.amount;
      G.TIMERS.BACKGROUND -= 60 * (s.eased - s.amount) * _dt;
      return false;
    },
  }));

  for (let i = 0; i < view.deck.remaining; i++) {
    const c = create_back_card(G.deck.T.x, G.deck.T.y);
    G.deck.emplace(c);
  }
  for (let i = 0; i < view.discard_count; i++) {
    const c = create_back_card(G.discard.T.x, G.discard.T.y);
    G.discard.emplace(c);
  }
  delay(0.5);

  G.GAME.blind = new Blind(0, 0, 2, 1);
  G.deck.align_cards();
  G.deck.hard_set_cards();

  sync_game(view);
  G.HUD = new UIBox({ definition: create_UIBox_HUD(), config: { align: 'cli', offset: { x: -0.7, y: 0 }, major: G.ROOM_ATTACH } });
  G.HUD_blind = new UIBox({ definition: create_UIBox_HUD_blind(), config: { major: G.HUD.get_UIE_by_ID('row_blind'), align: 'cm', offset: { x: 0, y: -10 }, bond: 'Weak' } });
  G.HUD_tags = [];
  G.hand_text_area = {
    chips: G.HUD.get_UIE_by_ID('hand_chips'),
    mult: G.HUD.get_UIE_by_ID('hand_mult'),
    ante: G.HUD.get_UIE_by_ID('ante_UI_count'),
    round: G.HUD.get_UIE_by_ID('round_UI_count'),
    chip_total: G.HUD.get_UIE_by_ID('hand_chip_total'),
    handname: G.HUD.get_UIE_by_ID('hand_name'),
    hand_level: G.HUD.get_UIE_by_ID('hand_level'),
    game_chips: G.HUD.get_UIE_by_ID('chip_UI_count'),
    blind_chips: G.HUD_blind.get_UIE_by_ID('HUD_blind_count'),
    blind_spacer: G.HUD.get_UIE_by_ID('blind_spacer'),
  };

  const b = view.blind;
  if (mid_round && b && b.key) {
    G.GAME.blind.show_set(G.P_BLINDS[b.key], b.chips, b.reward, b.disabled);
  } else {
    G.GAME.blind.set_blind(null, null, true);
  }
  G.GAME.tags = [];
  for (const t of view.tags) add_tag(new Tag(t.key, false, undefined, t.orbital_hand));

  G.FUNCS.blind_chip_UI_scale(G.hand_text_area.blind_chips);
  G.HUD.recalculate();

  // the cards on screen
  for (const cv of view.jokers) { const c = create_card(cv, G.jokers.T.x, G.jokers.T.y); G.jokers.emplace(c); }
  for (const cv of view.consumables) { const c = create_card(cv, G.consumeables.T.x, G.consumeables.T.y); G.consumeables.emplace(c); }
  for (const cv of view.hand) { const c = create_card(cv, G.hand.T.x, G.hand.T.y); G.hand.emplace(c, null, cv.face_down); }
  for (const a of [G.jokers, G.consumeables, G.hand]) { a.align_cards(); a.hard_set_cards(); }
  G.playing_cards = full_deck(view);

  try {
    G.GAME.round_scores.hand.amt = Number(localStorage.getItem('balatro-fe.best.' + view.id) ?? 0);
    G.GAME.seeded = !!localStorage.getItem('balatro-fe.seeded.' + view.id);
  } catch { /* no storage */ }
  if (view.phase === 'shop') G.load_shop_from_view = true;
  if (view.phase === 'pack') {
    G.load_pack_from_view = true;
    G.GAME.PACK_INTERRUPT = view.shop ? G.STATES.SHOP : G.STATES.BLIND_SELECT;
    G.GAME.pack_size = view.pack?.cards.length ?? 2;
    G.GAME.pack_choices = view.pack?.choices_left ?? 1;
  }
}
