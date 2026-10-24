// The run's per-frame logic (Game:update's run part and the Game:update_*
// state functions of game.lua). What the game computes in them (drawing
// cards, ending the round) comes from the API; what they show is here.
import { G, UIBox, DynaText, Particles, Event, play_sound, lighten, HEX } from '@/shared/lib/engine';
import { localize } from '@/shared/lib/localization';
import {
  run, stop_use, ease_background_colour_blind, timeline_playing, create_card, card_by_id, playing,
} from '@/entities/run';
import { react_tags } from '@/entities/tag';
import { create_UIBox_buttons } from '../ui/play-buttons';
import { create_UIBox_blind_select } from '@/widgets/blind-select';
import { create_UIBox_round_evaluation, evaluate_round } from '../ui/round-eval';
import { create_UIDEF_shop, create_shop_card_ui } from '../ui/shop';
import { create_UIBox_pack, type PackKind } from '../ui/booster-pack';
import { show_game_over } from '../ui/game-over';

function remove_buttons() {
  if (G.buttons) { G.buttons.remove(); G.buttons = null; }
}
function remove_shop() {
  if (G.shop) { G.shop.remove(); G.shop = null; }
}

function update_selecting_hand(_dt: number) {
  const deck_hovered = G.deck && G.deck.cards[0] && G.deck.cards[0].states.collide.is && (!G.deck.cards[0].states.drag.is || G.CONTROLLER.HID.touch) && !G.CONTROLLER.HID.controller;
  if (!G.deck_preview && !G.OVERLAY_MENU && G.UIDEF.deck_preview && (deck_hovered || G.CONTROLLER.held_buttons?.triggerleft)) {
    if (G.buttons) G.buttons.states.visible = false;
    G.deck_preview = new UIBox({ definition: G.UIDEF.deck_preview(), config: { align: 'tm', offset: { x: 0, y: -0.8 }, major: G.hand, bond: 'Weak' } });
    G.E_MANAGER.add_event(new Event({
      blocking: false, blockable: false,
      func: () => {
        const still = G.deck && G.deck.cards[0] && G.deck.cards[0].states.collide.is && !G.CONTROLLER.HID.controller;
        if (G.deck_preview && !(still || G.CONTROLLER.held_buttons?.triggerleft)) {
          G.deck_preview.remove();
          G.deck_preview = null;
          return true;
        }
        return false;
      },
    }));
  }
  if (!G.buttons && !G.deck_preview) {
    G.buttons = new UIBox({ definition: create_UIBox_buttons(), config: { align: 'bm', offset: { x: 0, y: 0.3 }, major: G.hand, bond: 'Weak' } });
  }
  if (G.buttons && !G.buttons.states.visible && !G.deck_preview) G.buttons.states.visible = true;
  remove_shop();
  if (!G.STATE_COMPLETE) G.STATE_COMPLETE = true;
}

function update_shop(_dt: number) {
  if (!G.STATE_COMPLETE) {
    stop_use();
    ease_background_colour_blind(G.STATES.SHOP);
    const shop_exists = !!G.shop;
    G.shop = G.shop ?? new UIBox({ definition: create_UIDEF_shop(), config: { align: 'tmi', offset: { x: 0, y: G.ROOM.T.y + 11 }, major: G.hand, bond: 'Weak' } });
    G.E_MANAGER.add_event(new Event({
      func: () => {
        G.shop.alignment.offset.y = -5.3;
        G.shop.alignment.offset.x = 0;
        G.E_MANAGER.add_event(new Event({
          trigger: 'after', delay: 0.2, blockable: false,
          func: () => {
            if (Math.abs(G.shop.T.y - G.shop.VT.y) < 3) {
              G.ROOM.jiggle += 3;
              play_sound('cardFan2');
              // the tags that act once the shop is stocked (Voucher, Coupon)
              if (run.view) react_tags(run.view.tags, undefined, ['voucher_add', 'shop_final_pass']);
              if (!shop_exists && G.load_shop_from_view) {
                // a run opened in the shop: its cards are already there
                G.load_shop_from_view = null;
                const v = run.view?.shop;
                const put = (area: any, list: any[], big = false) => {
                  for (const cv of list ?? []) {
                    const c = card_by_id(cv.id) ?? create_card(cv, area.T.x + area.T.w / 2, area.T.y);
                    if (big) { c.T.w = G.CARD_W * 1.27; c.T.h = G.CARD_H * 1.27; }
                    create_shop_card_ui(c);
                    c.start_materialize();
                    area.emplace(c);
                  }
                };
                if (v) { put(G.shop_jokers, v.jokers); put(G.shop_vouchers, v.vouchers); put(G.shop_booster, v.boosters, true); }
              }
              return true;
            }
            return false;
          },
        }));
        // the tags that act as the shop fills (D6, Uncommon, Rare, Foil...): the game
        // queues their yep before the new cards materialize
        if (run.view) react_tags(run.view.tags, undefined, ['shop_start', 'store_joker_create', 'store_joker_modify']);
        return true;
      },
    }));
    G.STATE_COMPLETE = true;
  }
  remove_buttons();
}

function update_play_tarot() { remove_buttons(); }

function update_hand_played() {
  remove_buttons();
  remove_shop();
  if (!G.STATE_COMPLETE) G.STATE_COMPLETE = true;
}

function update_draw_to_hand() {
  remove_buttons();
  remove_shop();
  if (!G.STATE_COMPLETE) {
    G.STATE_COMPLETE = true;
    if (run.view) react_tags(run.view.tags, undefined, ['round_start_bonus']);
    ease_background_colour_blind(G.STATES.DRAW_TO_HAND);
  }
}

function update_new_round() {
  remove_buttons();
  remove_shop();
  if (!G.STATE_COMPLETE) G.STATE_COMPLETE = true;
}

function update_blind_select() {
  remove_buttons();
  remove_shop();
  if (!G.STATE_COMPLETE) {
    stop_use();
    ease_background_colour_blind(G.STATES.BLIND_SELECT);
    G.E_MANAGER.add_event(new Event({ func: () => true }));
    G.STATE_COMPLETE = true;
    G.CONTROLLER.interrupt.focus = true;
    G.E_MANAGER.add_event(new Event({
      func: () => {
        G.E_MANAGER.add_event(new Event({
          trigger: 'immediate',
          func: () => {
            play_sound('cancel');
            G.blind_select = new UIBox({ definition: create_UIBox_blind_select(), config: { align: 'bmi', offset: { x: 0, y: G.ROOM.T.y + 29 }, major: G.hand, bond: 'Weak' } });
            G.blind_select.alignment.offset.y = 0.8 - (G.hand.T.y - G.jokers.T.y) + G.blind_select.T.h;
            G.ROOM.jiggle += 3;
            G.blind_select.alignment.offset.x = 0;
            G.CONTROLLER.lock_input = false;
            // Tag:apply_to_run 'immediate' and 'new_blind_choice'
            G.FUNCS.blind_choice_tags?.(run.view, playing.tl);
            return true;
          },
        }));
        return true;
      },
    }));
  }
}

function update_round_eval() {
  remove_buttons();
  remove_shop();
  if (!G.STATE_COMPLETE) {
    stop_use();
    G.STATE_COMPLETE = true;
    G.E_MANAGER.add_event(new Event({
      trigger: 'immediate',
      func: () => {
        // the game queues this behind the round's last card moves
        if (timeline_playing()) return false;
        G.GAME.facing_blind = null;
        ease_background_colour_blind(G.STATES.ROUND_EVAL);
        G.round_eval = new UIBox({ definition: create_UIBox_round_evaluation(), config: { align: 'bm', offset: { x: 0, y: G.ROOM.T.y + 19 }, major: G.hand, bond: 'Weak' } });
        G.round_eval.alignment.offset.x = 0;
        G.E_MANAGER.add_event(new Event({
          trigger: 'immediate',
          func: () => {
            if (G.round_eval.alignment.offset.y !== -7.8) {
              G.round_eval.alignment.offset.y = -7.8;
            } else if (Math.abs(G.round_eval.T.y - G.round_eval.VT.y) < 3) {
              G.ROOM.jiggle += 3;
              play_sound('cardFan2');
              G.E_MANAGER.add_event(new Event({ trigger: 'after', delay: 0.1, func: () => true }));
              const ev = run.view?.round_eval;
              if (ev) evaluate_round(ev);
              return true;
            }
            return false;
          },
        }));
        return true;
      },
    }));
  }
}

const PACK_STATES: Record<number, PackKind> = {};

function sparkles(cfg: any) {
  const p = new Particles(1, 1, 0, 0, { timer: 0.015, initialize: true, padding: -1, attach: G.ROOM_ATTACH, fill: true, ...cfg });
  (p as any).fade_alpha = 1;
  p.fade(1, 0);
  return p;
}

function update_pack(kind: PackKind, state: number) {
  remove_buttons();
  if (G.shop) G.shop.alignment.offset.y = G.ROOM.T.y + 11;
  if (G.STATE_COMPLETE) return;
  G.STATE_COMPLETE = true;
  G.CONTROLLER.interrupt.focus = true;
  G.E_MANAGER.add_event(new Event({
    trigger: 'immediate',
    func: () => {
      if (kind === 'tarot') G.booster_pack_sparkles = sparkles({ scale: 0.2, lifespan: 1, speed: 1.1, colours: [G.C.WHITE, lighten(G.C.PURPLE, 0.4), lighten(G.C.PURPLE, 0.2), lighten(G.C.GOLD, 0.2)] });
      if (kind === 'spectral') G.booster_pack_sparkles = sparkles({ scale: 0.1, lifespan: 3, speed: 0.2, colours: [G.C.WHITE, lighten(G.C.GOLD, 0.2)] });
      if (kind === 'standard') G.booster_pack_sparkles = sparkles({ scale: 0.3, lifespan: 3, speed: 0.2, colours: [G.C.BLACK, G.C.RED] });
      if (kind === 'planet') {
        ease_background_colour_blind(state);
        G.booster_pack_stars = new Particles(1, 1, 0, 0, { timer: 0.07, scale: 0.1, initialize: true, lifespan: 15, speed: 0.1, padding: -4, attach: G.ROOM_ATTACH, colours: [G.C.WHITE, HEX('a7d6e0'), HEX('fddca0')], fill: true });
        G.booster_pack_meteors = new Particles(1, 1, 0, 0, { timer: 2, scale: 0.05, lifespan: 1.5, speed: 4, attach: G.ROOM_ATTACH, colours: [G.C.WHITE], fill: true });
      }
      G.booster_pack = new UIBox({ definition: create_UIBox_pack(kind), config: { align: 'tmi', offset: { x: 0, y: G.ROOM.T.y + 9 }, major: G.hand, bond: 'Weak' } });
      G.booster_pack.alignment.offset.y = -2.2;
      G.ROOM.jiggle += 3;
      if (kind !== 'planet') ease_background_colour_blind(state);
      if (G.load_pack_from_view) {
        // a run opened with a pack open: its cards are already chosen
        G.load_pack_from_view = null;
        for (const cv of run.view?.pack?.cards ?? []) {
          const c = card_by_id(cv.id) ?? create_card(cv, G.pack_cards.T.x, G.pack_cards.T.y);
          c.start_materialize([G.C.WHITE, G.C.WHITE], undefined, 1.5 * G.SETTINGS.GAMESPEED);
          G.pack_cards.emplace(c);
        }
      }
      G.E_MANAGER.add_event(new Event({
        trigger: 'immediate',
        func: () => {
          if (kind !== 'planet') G.E_MANAGER.add_event(new Event({ trigger: 'after', delay: 0.5, func: () => true }));
          return true;
        },
      }));
      return true;
    },
  }));
}

function update_game_over() {
  if (!G.STATE_COMPLETE) {
    play_sound('negative', 0.5, 0.7);
    play_sound('whoosh2', 0.9, 0.7);
    G.SETTINGS.paused = true;
    show_game_over();
    G.ROOM.jiggle += 3;
    G.STATE_COMPLETE = true;
  }
}

/** Game:update's run part: the boss warning, then each state's update in the game's order */
export function run_stage_update(dt: number) {
  const S = G.STATES;
  if (!PACK_STATES[S.TAROT_PACK]) {
    PACK_STATES[S.TAROT_PACK] = 'tarot'; PACK_STATES[S.PLANET_PACK] = 'planet'; PACK_STATES[S.SPECTRAL_PACK] = 'spectral';
    PACK_STATES[S.STANDARD_PACK] = 'standard'; PACK_STATES[S.BUFFOON_PACK] = 'buffoon';
  }
  if (G.STAGE !== G.STAGES.RUN) return;
  if (G.GAME.blind && G.boss_throw_hand && G.STATE === S.SELECTING_HAND) {
    if (!G.boss_warning_text) {
      G.boss_warning_text = new UIBox({
        definition: { n: G.UIT.ROOT, config: { align: 'cm', colour: G.C.CLEAR, padding: 0.2 }, nodes: [
          { n: G.UIT.R, config: { align: 'cm', maxw: 1 }, nodes: [
            { n: G.UIT.O, config: { object: new DynaText({ scale: 0.7, string: localize('ph_unscored_hand'), maxw: 9, colours: [G.C.WHITE], float: true, shadow: true, silent: true, pop_in: 0, pop_in_rate: 6 }) } },
          ] },
          { n: G.UIT.R, config: { align: 'cm', maxw: 1 }, nodes: [
            { n: G.UIT.O, config: { object: new DynaText({ scale: 0.6, string: G.GAME.blind.get_loc_debuff_text(), maxw: 9, colours: [G.C.WHITE], float: true, shadow: true, silent: true, pop_in: 0, pop_in_rate: 6 }) } },
          ] },
        ] },
        config: { align: 'cm', offset: { x: 0, y: -3.1 }, major: G.play },
      });
      G.boss_warning_text.attention_text = true;
      G.boss_warning_text.states.collide.can = false;
      G.GAME.blind.children.animatedSprite.juice_up(0.05, 0.02);
      play_sound('chips1', Math.random() * 0.1 + 0.55, 0.12);
    }
  } else {
    G.boss_throw_hand = null;
    if (G.boss_warning_text) { G.boss_warning_text.remove(); G.boss_warning_text = null; }
  }
  if (G.STATE === S.SELECTING_HAND) update_selecting_hand(dt);
  if (G.STATE === S.SHOP) update_shop(dt);
  if (G.STATE === S.PLAY_TAROT) update_play_tarot();
  if (G.STATE === S.HAND_PLAYED) update_hand_played();
  if (G.STATE === S.DRAW_TO_HAND) update_draw_to_hand();
  if (G.STATE === S.NEW_ROUND) update_new_round();
  if (G.STATE === S.BLIND_SELECT) update_blind_select();
  if (G.STATE === S.ROUND_EVAL) update_round_eval();
  if (PACK_STATES[G.STATE]) update_pack(PACK_STATES[G.STATE], G.STATE);
  if (G.STATE === S.GAME_OVER) update_game_over();
}
