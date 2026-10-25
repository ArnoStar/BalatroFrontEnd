// Using, picking, selling and moving cards (button_callbacks.lua: use_card,
// sell_card, skip_booster, end_consumeable, can_*; card.lua: Card:open,
// Card:redeem, Card:sell_card; UI_definitions.lua: use_and_sell_buttons).
import { G, Event, UIBox, DynaText, play_sound, delay } from '@/shared/lib/engine';
import { localize } from '@/shared/lib/localization';
import type { PlayerAction, LegalAction } from '@/shared/api';
import { Card } from '@/entities/card';
import { count_usage } from '@/shared/config';
import { Tag } from '@/entities/tag';
import {
  run, perform, legal, stop_use, register_card, card_by_id, playing, ease_background_colour_blind, update_hand_text_now, sync_game, type Timeline, type Choreography,
} from '@/entities/run';

const PACK_STATE = (name: string) => {
  if (name.includes('Arcana')) return G.STATES.TAROT_PACK;
  if (name.includes('Celestial')) return G.STATES.PLANET_PACK;
  if (name.includes('Spectral')) return G.STATES.SPECTRAL_PACK;
  if (name.includes('Standard')) return G.STATES.STANDARD_PACK;
  return G.STATES.BUFFOON_PACK;
};

const is_pack_state = (s: number) => [G.STATES.TAROT_PACK, G.STATES.PLANET_PACK, G.STATES.SPECTRAL_PACK, G.STATES.STANDARD_PACK, G.STATES.BUFFOON_PACK].includes(s);

/** the targets a legal action takes from the hand's selection, or null if they don't fit */
function targets_for(a: LegalAction): number[] | null | undefined {
  if (a.min_targets === null || a.min_targets === undefined) return undefined;
  const sel = G.hand.highlighted.map((c: any) => c.api_id).filter((x: any) => x !== undefined);
  if (sel.length < a.min_targets || sel.length > (a.max_targets ?? a.min_targets)) return null;
  return sel;
}

/** the legal action a card's Use / Select / Redeem / Open button sends */
function action_for(card: Card): PlayerAction | null {
  const id = card.api_id;
  if (id === undefined) return null;
  const area = card.area;
  if (area === G.pack_cards) {
    const a = legal('pick', id)[0];
    if (!a) return null;
    const t = targets_for(a);
    if (t === null) return null;
    return { type: 'pick', card: id, targets: t ?? null };
  }
  if (area === G.shop_vouchers || area === G.shop_booster) {
    return legal('buy', id).length ? { type: 'buy', card: id } : null;
  }
  const a = legal('use', id)[0];
  if (!a) return null;
  const t = targets_for(a);
  if (t === null) return null;
  return { type: 'use', card: id, targets: t ?? null };
}

/**
 * The game's draw of the card to the play area (use_card's draw_card, a
 * 'before' event of 0.1s), here the API's move: wait until 0.1s after it.
 */
function wait_draw_to_play(card: Card, tl?: Timeline) {
  const t = tl?.find((e) => e.type === 'card_moved' && e.card === card.api_id && e.to === 'play');
  if (tl && t !== null && t !== undefined) G.E_MANAGER.add_event(tl.until(t + 0.1));
}

/** Card:open: the pack bursts, its cards appear (they come from the API) */
function open_booster(card: Card, tl?: Timeline) {
  stop_use();
  G.STATE_COMPLETE = false;
  card.opening = true;
  card.states.hover.can = false;
  G.STATE = PACK_STATE(card.ability.name);
  G.GAME.pack_size = card.ability.extra;
  G.GAME.pack_choices = card.config.center.config.choose ?? 1;
  G.opened_booster = card;
  wait_draw_to_play(card, tl);
  if (card.cost > 0) {
    G.E_MANAGER.add_event(new Event({ trigger: 'after', delay: 0.2, func: () => { card.juice_up(); return true; } }));
    G.E_MANAGER.add_event(new Event({ trigger: 'immediate', func: () => true })); // ease_dollars: the API's event
  } else {
    delay(0.2);
  }
  G.E_MANAGER.add_event(new Event({
    trigger: 'after', delay: 0.4,
    func: () => { card.explode(); return true; },
  }));
}

/** Card:redeem's on-screen part */
function redeem(card: Card, tl?: Timeline) {
  stop_use();
  card.states.hover.can = false;
  wait_draw_to_play(card, tl);
  let top: any = null, bot: any = null;
  G.E_MANAGER.add_event(new Event({
    trigger: 'after', delay: 0.4,
    func: () => {
      top = new DynaText({ string: localize({ type: 'name_text', set: card.config.center.set, key: card.config.center.key }), colours: [G.C.WHITE], rotate: 1, shadow: true, bump: true, float: true, scale: 0.9, pop_in: 0.6 / G.SPEEDFACTOR, pop_in_rate: 1.5 * G.SPEEDFACTOR });
      bot = new DynaText({ string: localize('k_redeemed_ex'), colours: [G.C.WHITE], rotate: 2, shadow: true, bump: true, float: true, scale: 0.9, pop_in: 1.4 / G.SPEEDFACTOR, pop_in_rate: 1.5 * G.SPEEDFACTOR, pitch_shift: 0.25 });
      card.juice_up(0.3, 0.5);
      play_sound('card1');
      play_sound('coin1');
      card.children.top_disp = new UIBox({
        definition: { n: G.UIT.ROOT, config: { align: 'tm', r: 0.15, colour: G.C.CLEAR, padding: 0.15 }, nodes: [{ n: G.UIT.O, config: { object: top } }] },
        config: { align: 'tm', offset: { x: 0, y: 0 }, parent: card },
      });
      card.children.bot_disp = new UIBox({
        definition: { n: G.UIT.ROOT, config: { align: 'tm', r: 0.15, colour: G.C.CLEAR, padding: 0.15 }, nodes: [{ n: G.UIT.O, config: { object: bot } }] },
        config: { align: 'bm', offset: { x: 0, y: 0 }, parent: card },
      });
      return true;
    },
  }));
  G.E_MANAGER.add_event(new Event({ trigger: 'immediate', func: () => true })); // ease_dollars: the API's event
  delay(0.6);
  G.E_MANAGER.add_event(new Event({ trigger: 'after', delay: 2.6, func: () => { top?.pop_out(4); bot?.pop_out(4); return true; } }));
  G.E_MANAGER.add_event(new Event({
    trigger: 'after', delay: 0.5,
    func: () => {
      card.children.top_disp?.remove(); card.children.top_disp = null;
      card.children.bot_disp?.remove(); card.children.bot_disp = null;
      return true;
    },
  }));
}

/** G.FUNCS.end_consumeable: the pack closes, the hand goes back, the screen it was opened from returns */
function end_consumeable(delayfac = 1, tl: Timeline | null = playing.tl) {
  stop_use();
  if (G.booster_pack) {
    G.booster_pack_sparkles?.fade(1 * delayfac);
    G.booster_pack_stars?.fade(1 * delayfac);
    G.booster_pack_meteors?.fade(1 * delayfac);
    G.booster_pack.alignment.offset.y = G.ROOM.T.y + 9;
    const box = G.booster_pack;
    G.E_MANAGER.add_event(new Event({
      trigger: 'after', delay: 0.2 * delayfac, blocking: false, blockable: false,
      func: () => { box.remove(); if (G.booster_pack === box) G.booster_pack = null; return true; },
    }));
    G.E_MANAGER.add_event(new Event({
      trigger: 'after', delay: 1 * delayfac, blocking: false, blockable: false,
      func: () => {
        if (G.booster_pack_sparkles) { G.booster_pack_sparkles.remove(); G.booster_pack_sparkles = null; }
        if (G.booster_pack_stars) { G.booster_pack_stars.remove(); G.booster_pack_stars = null; }
        if (G.booster_pack_meteors) { G.booster_pack_meteors.remove(); G.booster_pack_meteors = null; }
        return true;
      },
    }));
  }
  delay(0.2 * delayfac);
  G.E_MANAGER.add_event(new Event({
    trigger: 'after', delay: 0.2 * delayfac,
    func: () => {
      // draw_from_hand_to_deck: the API's events (draw_card 'before' events of 0.1s)
      const t_draw = tl?.find_last((e) => e.type === 'card_moved' && e.to === 'deck') ?? null;
      if (tl && t_draw !== null) G.E_MANAGER.add_event(tl.until(t_draw + 0.1));
      G.E_MANAGER.add_event(new Event({
        trigger: 'after', delay: 0.2 * delayfac,
        func: () => {
          for (const k of ['shop', 'blind_select', 'round_eval']) {
            const b = G[k];
            if (b && b.alignment.offset.py !== undefined && b.alignment.offset.py !== null) {
              b.alignment.offset.y = b.alignment.offset.py;
              b.alignment.offset.py = null;
            }
          }
          G.CONTROLLER.interrupt.focus = true;
          G.STATE = G.GAME.PACK_INTERRUPT ?? (run.view?.phase === 'shop' ? G.STATES.SHOP : G.STATES.BLIND_SELECT);
          ease_background_colour_blind(G.STATE);
          G.GAME.PACK_INTERRUPT = null;
          return true;
        },
      }));
      // the tags that act when blinds are offered again (a Boss Tag, another pack tag)
      G.FUNCS.blind_choice_tags?.(tl?.view ?? run.view, tl);
      G.E_MANAGER.add_event(new Event({ trigger: 'after', delay: 0.2 * delayfac, func: () => true })); // save_run
      return true;
    },
  }));
}

/** hide the screens behind a used card (G.FUNCS.use_card's .py offsets) */
function hide_screens(card: Card) {
  if (G.booster_pack && (G.booster_pack.alignment.offset.py === undefined || G.booster_pack.alignment.offset.py === null) &&
    (card.ability.consumeable || !(G.GAME.pack_choices && G.GAME.pack_choices > 1))) {
    G.booster_pack.alignment.offset.py = G.booster_pack.alignment.offset.y;
    G.booster_pack.alignment.offset.y = G.ROOM.T.y + 29;
  }
  for (const [k, y] of [['shop', 29], ['blind_select', 39], ['round_eval', 29]] as [string, number][]) {
    const b = G[k];
    if (b && (b.alignment.offset.py === undefined || b.alignment.offset.py === null)) {
      b.alignment.offset.py = b.alignment.offset.y;
      b.alignment.offset.y = G.ROOM.T.y + y;
    }
  }
}

/**
 * G.FUNCS.use_card's on-screen part for `card`, after the API answered.
 * `mute`: bought and used at once (the draw to the play area is silent).
 */
function use_choreography(card: Card, tl: Timeline, mute = false) {
  const area = card.area;
  const prev_state = G.STATE;
  let dont_dissolve = false;
  let delay_fac = 1;
  G.TAROT_INTERRUPT = G.STATE;
  if (card.ability.set === 'Booster') G.GAME.PACK_INTERRUPT = G.STATE;
  G.STATE = is_pack_state(G.STATE) ? G.STATE : G.STATES.PLAY_TAROT;
  G.CONTROLLER.locks.use = true;
  hide_screens(card);
  for (const k of ['use_button', 'sell_button', 'price', 'buy_button', 'buy_and_use_button']) {
    if (card.children[k]) { card.children[k].remove(); card.children[k] = null; }
  }
  void mute;
  if (card.ability.consumeable) {
    count_usage('consumeable_usage', card.config.center.key, card.config.center.order);
    if (is_pack_state(prev_state)) {
      area?.remove_card(card);
      card.T.x = G.hand.T.x + G.hand.T.w / 2 - card.T.w / 2;
      card.T.y = G.hand.T.y + G.hand.T.h / 2 - card.T.h / 2 - 0.5;
    }
    // the draw to the play area is the API's card_moved
    delay(0.2);
    if (card.ability.consumeable.max_highlighted) {
      update_hand_text_now({ immediate: true, nopulse: true, delay: 0 }, { mult: 0, chips: 0, level: '', handname: '' });
    }
    if (card.ability.set === 'Tarot' || card.ability.set === 'Spectral') {
      G.E_MANAGER.add_event(new Event({ trigger: 'after', delay: 0.4, func: () => { play_sound('tarot1'); card.juice_up(0.3, 0.5); return true; } }));
    }
  } else if (card.ability.set === 'Enhanced' || card.ability.set === 'Default') {
    play_sound('card1', 0.8, 0.6);
    play_sound('generic1');
    dont_dissolve = true;
    delay_fac = 0.2;
  } else if (card.ability.set === 'Joker') {
    play_sound('card1', 0.8, 0.6);
    play_sound('generic1');
    dont_dissolve = true;
    delay_fac = 0.2;
  } else if (card.ability.set === 'Booster') {
    delay(0.1);
    G.GAME.round_scores.cards_purchased.amt += card.from_tag ? 0 : 1;
    open_booster(card, tl);
  } else if (card.ability.set === 'Voucher') {
    count_usage('voucher_usage', card.config.center.key, card.config.center.order);
    delay(0.1);
    G.GAME.round_scores.cards_purchased.amt += 1;
    redeem(card, tl);
  }
  if (card.ability.set === 'Booster') {
    G.CONTROLLER.locks.use = false;
    G.TAROT_INTERRUPT = null;
    return;
  }
  // the game waits for the card's effects (the API's events) before dissolving it
  const t_removed = tl.find((e) => e.type === 'card_removed' && e.card === card.api_id);
  if (t_removed !== null) G.E_MANAGER.add_event(tl.until(t_removed - 0.735 - 0.017 - 0.2));
  else if (!dont_dissolve) G.E_MANAGER.add_event(tl.until_done());
  G.E_MANAGER.add_event(new Event({
    trigger: 'after', delay: 0.2,
    func: () => {
      if (!dont_dissolve && !card.REMOVED) { card.removing = true; card.start_dissolve(); }
      G.E_MANAGER.add_event(new Event({
        trigger: 'after', delay: 0.1,
        func: () => {
          G.STATE = prev_state;
          G.TAROT_INTERRUPT = null;
          G.CONTROLLER.locks.use = false;
          if (is_pack_state(prev_state) && G.booster_pack) {
            if (area === G.consumeables) {
              G.booster_pack.alignment.offset.y = G.booster_pack.alignment.offset.py;
              G.booster_pack.alignment.offset.py = null;
            } else if (tl.view.phase === 'pack') {
              if (G.booster_pack.alignment.offset.py !== undefined && G.booster_pack.alignment.offset.py !== null) {
                G.booster_pack.alignment.offset.y = G.booster_pack.alignment.offset.py;
                G.booster_pack.alignment.offset.py = null;
              }
              G.GAME.pack_choices = tl.view.pack?.choices_left ?? G.GAME.pack_choices - 1;
            } else {
              G.CONTROLLER.interrupt.focus = true;
              end_consumeable(delay_fac, tl);
            }
          } else {
            for (const k of ['shop', 'blind_select', 'round_eval']) {
              const b = G[k];
              if (b && b.alignment.offset.py !== undefined && b.alignment.offset.py !== null) {
                b.alignment.offset.y = b.alignment.offset.py;
                b.alignment.offset.py = null;
              }
            }
          }
          return true;
        },
      }));
      return true;
    },
  }));
}

/** a used card dissolves when the choreography says, not ahead of its card_removed */
const keep_card = (card: Card): Choreography['hooks'] => ({
  removal: (c) => (c === card ? { kind: 'instant' } : null),
  level_up_card: () => card,
});

/** Card:sell_card's on-screen part */
function sell_choreography(card: Card) {
  G.CONTROLLER.locks.selling_card = true;
  stop_use();
  for (const k of ['use_button', 'sell_button']) if (card.children[k]) { card.children[k].remove(); card.children[k] = null; }
  G.E_MANAGER.add_event(new Event({ trigger: 'after', delay: 0.2, func: () => { play_sound('coin2'); card.juice_up(0.3, 0.4); return true; } }));
  delay(0.2);
  G.E_MANAGER.add_event(new Event({
    trigger: 'immediate',
    func: () => {
      card.removing = true;
      card.start_dissolve([G.C.GOLD]);
      delay(0.3);
      G.E_MANAGER.add_event(new Event({
        trigger: 'after', delay: 0.3, blocking: false,
        func: () => {
          G.E_MANAGER.add_event(new Event({ trigger: 'immediate', func: () => { G.CONTROLLER.locks.selling_card = null; return true; } }));
          return true;
        },
      }));
      return true;
    },
  }));
}

/**
 * A booster opened by a tag (Charm Tag...): it appears over the play area and
 * opens (the tag's yep, then G.FUNCS.use_card). It is the card the API moves
 * to the play area.
 */
function open_tag_booster(key: string, tl?: Timeline) {
  const center = G.P_CENTERS[key];
  const card = new Card(G.play.T.x + G.play.T.w / 2 - G.CARD_W * 1.27 / 2, G.play.T.y + G.play.T.h / 2 - G.CARD_H * 1.27 / 2,
    G.CARD_W * 1.27, G.CARD_H * 1.27, G.P_CARDS.empty, center, { bypass_discovery_center: true, bypass_discovery_ui: true });
  card.cost = 0;
  card.from_tag = true;
  const move = tl?.events.find((e) => e.type === 'card_moved' && e.to === 'play' && !card_by_id(e.card));
  if (move && move.type === 'card_moved') register_card(move.card, card);
  G.TAROT_INTERRUPT = G.STATE;
  G.GAME.PACK_INTERRUPT = G.STATE;
  delay(0.1);
  open_booster(card, tl);
  card.start_materialize();
  G.TAROT_INTERRUPT = null;
}

const TAG_PACKS: Record<string, string> = {
  'Charm Tag': 'p_arcana_mega_1', 'Meteor Tag': 'p_celestial_mega_1', 'Ethereal Tag': 'p_spectral_normal_1',
  'Standard Tag': 'p_standard_mega_1', 'Buffoon Tag': 'p_buffoon_mega_1',
};

export function register_use_card_funcs() {
  G.FUNCS.use_card_choreography = use_choreography;
  G.FUNCS.keep_used_card = keep_card;
  G.FUNCS.end_consumeable = (_e: any, delayfac?: number) => end_consumeable(delayfac);
  /** the yep of a tag that opens a pack: its booster */
  G.FUNCS.tag_booster = (tag: Tag) => TAG_PACKS[tag.name] ?? null;
  G.FUNCS.open_tag_booster = open_tag_booster;

  G.FUNCS.use_card = (e: any, mute?: boolean) => {
    const card: Card = e.config.ref_table;
    const action = action_for(card);
    if (!action) { e.disable_button = null; return; }
    e.config.button = null;
    perform(action, {
      skip_selection: action.type === 'use' || action.type === 'pick',
      hooks: keep_card(card),
      play: (tl) => {
        if (action.type === 'buy') G.GAME.round_scores.cards_purchased.amt += 0;
        use_choreography(card, tl, mute);
      },
      refused: () => { e.config.button = 'use_card'; },
    });
  };

  G.FUNCS.sell_card = (e: any) => {
    const card: Card = e.config.ref_table;
    if (card.api_id === undefined || !legal('sell', card.api_id).length) return;
    perform({ type: 'sell', card: card.api_id }, {
      hooks: { removal: (c) => (c === card ? { kind: 'instant' } : null) },
      play: () => sell_choreography(card),
    });
  };

  G.FUNCS.skip_booster = (_e: any) => {
    perform({ type: 'skip_pack' }, {
      play: (tl) => end_consumeable(1, tl),
    });
  };

  G.FUNCS.can_use_consumeable = (e: any) => {
    const ok = !!action_for(e.config.ref_table) && !(G.play && G.play.cards.length > 0 && e.config.ref_table.area !== G.pack_cards) &&
      !G.CONTROLLER.locked && !(G.GAME.STOP_USE && G.GAME.STOP_USE > 0);
    e.config.colour = ok ? G.C.RED : G.C.UI.BACKGROUND_INACTIVE;
    e.config.button = ok ? 'use_card' : null;
  };

  G.FUNCS.can_select_card = (e: any) => {
    const ok = !!action_for(e.config.ref_table);
    e.config.colour = ok ? G.C.GREEN : G.C.UI.BACKGROUND_INACTIVE;
    e.config.button = ok ? 'use_card' : null;
  };

  G.FUNCS.can_sell_card = (e: any) => {
    const c = e.config.ref_table;
    const ok = c.api_id !== undefined && legal('sell', c.api_id).length > 0 && !(G.play && G.play.cards.length > 0) &&
      !G.CONTROLLER.locked && !(G.GAME.STOP_USE && G.GAME.STOP_USE > 0);
    e.config.colour = ok ? G.C.GREEN : G.C.UI.BACKGROUND_INACTIVE;
    e.config.button = ok ? 'sell_card' : null;
  };

  G.FUNCS.can_skip_booster = (e: any) => {
    const ok = !!G.pack_cards && !!G.pack_cards.cards[0] && legal('skip_pack').length > 0;
    e.config.colour = ok ? G.C.GREY : G.C.UI.BACKGROUND_INACTIVE;
    e.config.button = ok ? 'skip_booster' : null;
  };

  /** CardArea dragging ended: a reorder of the jokers, the hand or the
   *  consumables is a `move`. The card's new place is kept as "after this
   *  card" so a drag that ends while an action plays can still be sent once
   *  it's done (its finish puts the API's order back first). */
  G.FUNCS.card_drag_ended = (card: Card) => {
    const area = card.area;
    if (!area || card.api_id === undefined || (area !== G.jokers && area !== G.hand && area !== G.consumeables)) return;
    const i = area.cards.indexOf(card);
    if (i < 0) return;
    const after: number | null = i > 0 ? area.cards[i - 1].api_id ?? null : null;
    send_move(area === G.jokers ? 'jokers' : area === G.hand ? 'hand' : 'consumables', card.api_id, after);
  };

  G.UIDEF.use_and_sell_buttons = use_and_sell_buttons;
  void sync_game;
}

/** move a card of the jokers/hand/consumables right after another one (null: first) */
function send_move(area: 'jokers' | 'hand' | 'consumables', id: number, after: number | null) {
  if (run.busy) {
    G.E_MANAGER.add_event(new Event({
      blocking: false, blockable: false,
      func: () => {
        if (run.busy) return false;
        send_move(area, id, after);
        return true;
      },
    }));
    return;
  }
  const list = run.view?.[area];
  const from = list?.findIndex((c) => c.id === id) ?? -1;
  if (!list || from < 0) return;
  const rest = list.filter((c) => c.id !== id);
  const to = after === null ? 0 : rest.findIndex((c) => c.id === after) + 1;
  if (to === 0 && after !== null) return; // the card it was put after is gone
  if (to === from) return;
  // the API lists `move` once per area that has 2+ cards (not per card)
  if (!legal('move').some((a) => a.area === area)) return;
  perform({ type: 'move', card: id, to });
}

function use_and_sell_buttons(card: Card) {
  let sell: any = null, use: any = null;
  if (card.area && card.area.config.type === 'joker') {
    sell = { n: G.UIT.C, config: { align: 'cr' }, nodes: [
      { n: G.UIT.C, config: { ref_table: card, align: 'cr', padding: 0.1, r: 0.08, minw: 1.25, hover: true, shadow: true, colour: G.C.UI.BACKGROUND_INACTIVE, one_press: true, button: 'sell_card', func: 'can_sell_card' }, nodes: [
        { n: G.UIT.B, config: { w: 0.1, h: 0.6 } },
        { n: G.UIT.C, config: { align: 'tm' }, nodes: [
          { n: G.UIT.R, config: { align: 'cm', maxw: 1.25 }, nodes: [{ n: G.UIT.T, config: { text: localize('b_sell'), colour: G.C.UI.TEXT_LIGHT, scale: 0.4, shadow: true } }] },
          { n: G.UIT.R, config: { align: 'cm' }, nodes: [
            { n: G.UIT.T, config: { text: localize('$'), colour: G.C.WHITE, scale: 0.4, shadow: true } },
            { n: G.UIT.T, config: { ref_table: card, ref_value: 'sell_cost_label', colour: G.C.WHITE, scale: 0.55, shadow: true } },
          ] },
        ] },
      ] },
    ] };
  }
  if (card.ability.consumeable) {
    if (card.area === G.pack_cards && G.pack_cards) {
      return { n: G.UIT.ROOT, config: { padding: 0, colour: G.C.CLEAR }, nodes: [
        { n: G.UIT.R, config: { mid: true }, nodes: [] },
        { n: G.UIT.R, config: { ref_table: card, r: 0.08, padding: 0.1, align: 'bm', minw: 0.5 * card.T.w - 0.15, minh: 0.8 * card.T.h, maxw: 0.7 * card.T.w - 0.15, hover: true, shadow: true, colour: G.C.UI.BACKGROUND_INACTIVE, one_press: true, button: 'use_card', func: 'can_use_consumeable' }, nodes: [
          { n: G.UIT.T, config: { text: localize('b_use'), colour: G.C.UI.TEXT_LIGHT, scale: 0.55, shadow: true } },
        ] },
      ] };
    }
    use = { n: G.UIT.C, config: { align: 'cr' }, nodes: [
      { n: G.UIT.C, config: { ref_table: card, align: 'cr', maxw: 1.25, padding: 0.1, r: 0.08, minw: 1.25, minh: (card.area && card.area.config.type === 'joker') ? 0 : 1, hover: true, shadow: true, colour: G.C.UI.BACKGROUND_INACTIVE, one_press: true, button: 'use_card', func: 'can_use_consumeable' }, nodes: [
        { n: G.UIT.B, config: { w: 0.1, h: 0.6 } },
        { n: G.UIT.T, config: { text: localize('b_use'), colour: G.C.UI.TEXT_LIGHT, scale: 0.55, shadow: true } },
      ] },
    ] };
  } else if (card.area && card.area === G.pack_cards) {
    return { n: G.UIT.ROOT, config: { padding: 0, colour: G.C.CLEAR }, nodes: [
      { n: G.UIT.R, config: { ref_table: card, r: 0.08, padding: 0.1, align: 'bm', minw: 0.5 * card.T.w - 0.15, maxw: 0.9 * card.T.w - 0.15, minh: 0.3 * card.T.h, hover: true, shadow: true, colour: G.C.UI.BACKGROUND_INACTIVE, one_press: true, button: 'use_card', func: 'can_select_card' }, nodes: [
        { n: G.UIT.T, config: { text: localize('b_select'), colour: G.C.UI.TEXT_LIGHT, scale: 0.45, shadow: true } },
      ] },
    ] };
  }
  return { n: G.UIT.ROOT, config: { padding: 0, colour: G.C.CLEAR }, nodes: [
    { n: G.UIT.C, config: { padding: 0.15, align: 'cl' }, nodes: [
      { n: G.UIT.R, config: { align: 'cl' }, nodes: [sell] },
      { n: G.UIT.R, config: { align: 'cl' }, nodes: [use] },
    ] },
  ] };
}
