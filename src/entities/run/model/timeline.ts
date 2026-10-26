// Plays an action's events (the API's `events`) at the time the game showed
// them: `t` is real seconds from the action, so each event fires when
// G.TIMERS.REAL has advanced that much since the timeline started. The ported
// choreography of each action runs in G.E_MANAGER alongside, and waits on the
// timeline where the game's own queue waited on its logic (`until`).
import { G, Event, play_sound } from '@/shared/lib/engine';
import { attention_text, notify_alert } from '@/shared/ui';
import { localize } from '@/shared/lib/localization';
import type { CardView, GameEvent, GameView } from '@/shared/api';
import type { Card, CardArea } from '@/entities/card/@x/run';
import { find_view } from './store';
import { area_of } from './sync';
import { card_by_id, register_card, forget_card, create_card, create_back_card, apply_card_view } from './cards';
import {
  update_hand_text_now, card_eval_status_text_now, ease_dollars_now, ease_chips_now, play_area_status_text_now,
  type HandTextConfig, type HandTextVals, type StatusExtra,
} from './effects';
import { joker_message } from './messages';

type Ev = GameEvent & { _skip?: boolean; _i?: number; _n?: number; _stay?: boolean; _status?: boolean; _sound?: HandTextConfig; _view?: CardView };

/** how a removed card leaves the screen, and how long before `card_removed` that starts */
export type Removal = { kind: 'dissolve' | 'shatter' | 'pinch' | 'instant'; colours?: any[] };

export interface TimelineHooks {
  /** a card the timeline created or moved arrived in an area (the shop's price tags...) */
  card_entered?(card: Card, area: string, fresh: boolean): void;
  /** overrides how a card leaves (selling dissolves in gold...) */
  removal?(card: Card, area: string): Removal | null;
  /** the card a level-up juices (the planet being used, Space Joker...) */
  level_up_card?(): Card | null;
}

/** hooks every timeline uses unless an action overrides them (set by the run page) */
export const default_hooks: TimelineHooks = {};

const PINCHED = new Set(['Ramen', 'Turtle Bean', 'Popcorn', 'Gros Michel', 'Cavendish', 'Ice Cream', 'Seltzer']);
const LEAD = { dissolve: 1.05 * 0.7, shatter: 0.55 * 0.7, pinch: 0.3 + 1 / 60, instant: 0 };

/** areas whose emplace turns a face-down card up (CardArea:emplace) */
const FLIPS_ON_EMPLACE = (name: string) => name !== 'deck' && name !== 'discard';
const SHOP_AREAS = new Set(['shop', 'vouchers', 'boosters', 'pack']);

export class Timeline {
  events: Ev[];
  view: GameView;
  hooks: TimelineHooks;
  start_time = 0;
  next = 0;
  started = false;
  done = false;
  end_t: number;
  private pre: { t: number; run: () => void }[] = [];
  private pre_next = 0;
  private percent = 0.3;
  private on_done: (() => void)[] = [];
  /** the cards this action removes */
  removed_ids = new Set<number>();
  action: string;

  constructor(events: GameEvent[], view: GameView, hooks: TimelineHooks = {}, opts: { skip_selection?: boolean; action?: string } = {}) {
    this.events = events.map((e) => ({ ...e }));
    this.view = view;
    this.hooks = { ...default_hooks, ...hooks };
    this.action = opts.action ?? '';
    for (const e of this.events) if (e.type === 'card_removed') this.removed_ids.add(e.card);
    this.end_t = this.events.length ? this.events[this.events.length - 1].t : 0;
    this.prescan(opts);
  }

  /** the time of the first event matching `f` (after `from`), or null */
  find(f: (e: GameEvent) => boolean, from = -1): number | null {
    for (const e of this.events) if (e.t > from && f(e)) return e.t;
    return null;
  }

  /** the time of the last event matching `f`, or null */
  find_last(f: (e: GameEvent) => boolean): number | null {
    for (let i = this.events.length - 1; i >= 0; i--) if (f(this.events[i])) return this.events[i].t;
    return null;
  }

  private acc = 0;
  private last_real = 0;

  /**
   * Seconds of the API's timeline played so far. The API timed the run at its
   * own game speed; at another speed setting the timeline plays faster or slower.
   */
  get elapsed() {
    if (!this.started) return 0;
    const now = G.TIMERS.REAL;
    this.acc += (now - this.last_real) * this.speed_ratio();
    this.last_real = now;
    return this.acc;
  }

  private speed_ratio() {
    const run_speed = this.view.settings?.game_speed || 1;
    return (G.SETTINGS.GAMESPEED || 1) / run_speed;
  }

  private prescan(opts: { skip_selection?: boolean }) {
    const ev = this.events;
    // the API re-selects the cards on its first frame: the player already sees the selection
    if (opts.skip_selection && ev.length) {
      const t0 = ev[0].t;
      for (const e of ev) if (e.type === 'hand' && e.t === t0) e._skip = true;
    }
    // a flip in the same frame as its card's move is the move's own (CardArea:emplace / align_cards)
    for (let i = 0; i < ev.length; i++) {
      const e = ev[i];
      if (e.type !== 'card_flipped') continue;
      for (const j of [i - 1, i + 1]) {
        const m = ev[j];
        if (m && m.type === 'card_moved' && m.card === e.card && m.t === e.t) { e._skip = true; break; }
      }
    }
    for (let i = 0; i < ev.length; i++) {
      const m = ev[i];
      if (m.type !== 'card_moved') continue;
      const flip = [ev[i - 1], ev[i + 1]].find((f) => f && f.type === 'card_flipped' && f.card === m.card && f.t === m.t);
      m._stay = !flip;
      // drawn face up: the flip says how the card looks
      if (flip && flip.type === 'card_flipped' && !flip.face_down && flip.view) m._view = flip.view;
    }
    // runs of moves to one area: each move's place in its run sets the draw sound's pitch
    let run: Ev[] = [];
    const close = () => { run.forEach((m, k) => { m._i = k + 1; m._n = run.length; }); run = []; };
    for (const e of ev) {
      if (e.type === 'card_moved') {
        if (run.length && (run[0] as any).to !== e.to) close();
        run.push(e);
      } else if (e.type !== 'card_flipped') {
        close();
      }
    }
    close();
    // level_up_hand: {mult} and {chips} with a +N beside them, then {level}
    const hands = ev.filter((e) => e.type === 'hand' && !e._skip) as any[];
    const keys = (e: any) => ['hand', 'level', 'chips', 'mult', 'hand_score'].filter((k) => e[k] !== undefined && e[k] !== null);
    for (let k = 0; k < hands.length; k++) {
      const h = hands[k];
      const kk = keys(h);
      if (kk.length === 1 && kk[0] === 'level' && h.level !== '') {
        h._sound = { sound: 'button', volume: 0.7, pitch: 0.9 };
        const c = hands[k - 1], m = hands[k - 2];
        if (c && keys(c).join() === 'chips') c._status = true;
        if (m && keys(m).join() === 'mult') m._status = true;
      }
    }
    // cards that leave: their animation starts before the game removes them
    for (const e of ev) {
      if (e.type !== 'card_removed') continue;
      const card = card_by_id(e.card);
      const r = this.removal_of(card, e.area);
      const t = Math.max(0, e.t - LEAD[r.kind]);
      if (r.kind !== 'instant') this.pre.push({ t, run: () => this.start_removal(e.card, r, e.area) });
    }
    this.pre.sort((a, b) => a.t - b.t);
  }

  private removal_of(card: Card | undefined, area: string): Removal {
    const o = card && this.hooks.removal?.(card, area);
    if (o) return o;
    if (area === 'shop' || area === 'vouchers' || area === 'boosters' || area === 'pack') return { kind: 'instant' };
    if (!card) return { kind: 'dissolve' };
    if (card.ability?.name === 'Glass Card') return { kind: 'shatter' };
    if (card.ability?.set === 'Joker' && PINCHED.has(card.ability.name)) return { kind: 'pinch' };
    return { kind: 'dissolve' };
  }

  private start_removal(id: number, r: Removal, _area: string) {
    const card = card_by_id(id);
    if (!card || card.REMOVED || card.removing) return;
    card.removing = true;
    if (r.kind === 'shatter') {
      card.shattered = true;
      card.shatter();
    } else if (r.kind === 'pinch') {
      play_sound('tarot1');
      card.T.r = -0.2;
      card.juice_up(0.3, 0.4);
      card.states.drag.is = true;
      card.children.center.pinch.x = true;
      G.E_MANAGER.add_event(new Event({
        trigger: 'after', delay: 0.3, blockable: false,
        func: () => { card.area?.remove_card(card); card.remove(); return true; },
      }));
    } else {
      card.start_dissolve(r.colours);
    }
  }

  /** starts playing (call once the API answered); `then` runs after the last event */
  start(then?: () => void, at?: number) {
    this.start_time = at ?? G.TIMERS.REAL;
    this.last_real = this.start_time;
    this.acc = 0;
    this.started = true;
    if (then) this.on_done.push(then);
    G.E_MANAGER.add_event(new Event({
      blocking: false, blockable: false, no_delete: true,
      func: () => this.tick(),
    }));
  }

  /**
   * An event that waits (blocking the queue) until the timeline reaches `t`,
   * also past its last event (the time keeps running).
   */
  until(t: number | null | undefined): Event {
    return new Event({ func: () => !this.started || t === null || t === undefined || this.elapsed >= t });
  }

  /** an event that waits until the whole timeline has played */
  until_done(): Event {
    return new Event({ func: () => this.done });
  }

  /** runs `f` at timeline time `t` (non-blocking) */
  at(t: number, f: () => void) {
    G.E_MANAGER.add_event(new Event({
      blocking: false, blockable: false,
      func: () => { if (this.started && this.elapsed >= t) { f(); return true; } return false; },
    }));
  }

  private tick(): boolean {
    const now = this.elapsed;
    while (this.pre_next < this.pre.length && this.pre[this.pre_next].t <= now) this.pre[this.pre_next++].run();
    while (this.next < this.events.length && this.events[this.next].t <= now) {
      const e = this.events[this.next];
      if (!e._skip && !this.handle(e)) return false; // waits for the area to exist
      this.next++;
    }
    if (this.next >= this.events.length && this.pre_next >= this.pre.length) {
      this.done = true;
      for (const f of this.on_done) f();
      this.on_done = [];
      return true;
    }
    return false;
  }

  /** plays one event; false if it must wait (its area is not on screen yet) */
  private handle(e: Ev): boolean {
    switch (e.type) {
      case 'card_moved': return this.moved(e);
      case 'card_flipped': this.flipped(e); return true;
      case 'card_removed': this.removed(e); return true;
      case 'hand': this.hand(e); return true;
      case 'card_text': this.card_text(e); return true;
      case 'hand_scored': return true;
      case 'round_score': ease_chips_now(e.chips); return true;
      case 'dollars': ease_dollars_now(e.amount, e.total); return true;
      case 'status_text': play_area_status_text_now(e.text === 'Not Allowed!' ? localize('k_not_allowed_ex') : e.text); return true;
      case 'card_juiced': card_by_id(e.card)?.juice_up(0.7); return true;
      case 'card_changed': this.changed(e); return true;
      case 'attention_text': this.attention(e); return true;
      case 'card_unlocked': this.unlocked(e); return true;
    }
    return true;
  }

  private moved(e: Ev & { type: 'card_moved' }): boolean {
    const to = area_of(e.to);
    if (!to) {
      // the area's screen is on its way (the shop slides in): wait a little, then give up
      (e as any)._waited = ((e as any)._waited ?? 0) + G.real_dt;
      return (e as any)._waited > 3;
    }
    const final = find_view(this.view, e.card);
    const look = e._view ?? (final && !final.cv.face_down ? final.cv : null);
    let card = card_by_id(e.card);
    let fresh = false;
    if (card && card.area === G.deck && to !== G.deck) {
      // the game draws the deck's top card: use it, whichever placeholder it is
      const top = G.deck.cards[G.deck.cards.length - 1];
      if (top && top !== card) { register_card(e.card, top); if (card.api_id === e.card) card.api_id = undefined; card = top; }
    }
    if (!card && G.deck.cards.length && to !== G.deck && (to === G.hand || to === G.play || to === G.discard)) {
      card = G.deck.cards[G.deck.cards.length - 1];
      register_card(e.card, card);
    }
    if (!card) {
      fresh = true;
      const shopish = SHOP_AREAS.has(e.to);
      const x = shopish ? to.T.x + to.T.w / 2 : to.T.x, y = to.T.y;
      if (look || final) {
        card = create_card(look ?? final!.cv, x, y, true);
      } else {
        card = create_back_card(x, y);
        register_card(e.card, card);
      }
      // shop and pack cards appear as their screens show them (card_entered)
      if (!shopish && to !== G.deck && to !== G.discard) card.start_materialize();
    } else if (look) {
      apply_card_view(card, look);
    }
    const from: CardArea | null = card.area ?? null;
    if (from) from.remove_card(card);
    const stay = !!e._stay && card.facing === 'back' && FLIPS_ON_EMPLACE(e.to);
    to.emplace(card, null, stay);
    // draw_from_deck_to_hand and draw_from_play_to_hand draw with sort = true
    if (to === G.hand && (from === G.deck || from === G.play) && to.cards.every((c: any) => c.base && c.base.value)) to.sort();
    this.move_sound(e, from, to, card);
    this.hooks.card_entered?.(card, e.to, fresh);
    return true;
  }

  /** draw_card's sound: card1, pitched by the card's place in its run */
  private move_sound(e: Ev, from: CardArea | null, to: CardArea, card: Card) {
    if (!from) return;
    const piles = [G.deck, G.hand, G.play, G.jokers, G.consumeables, G.discard];
    const playing = card.ability?.set === 'Default' || card.ability?.set === 'Enhanced';
    if (to === G.play && !playing) {
      if (card.ability?.set === 'Booster' || card.ability?.set === 'Voucher') return;
    } else if (!(piles.includes(to) && piles.includes(from))) {
      return;
    }
    const i = e._i ?? 1, n = e._n ?? 1;
    const down = to === G.discard || (to === G.deck && from === G.hand);
    let percent = i * 100 / n;
    if (down) percent = 1 - percent;
    let vol = 1;
    if (to === G.deck && from === G.discard) {
      if (i % 2 === 0) return;
      vol = Math.max((21 - i) / 20, 0.7);
    }
    G.VIBRATION += 0.6;
    play_sound('card1', 0.85 + percent * 0.2 / 100, 0.6 * vol);
  }

  private flipped(e: Ev & { type: 'card_flipped' }) {
    const card = card_by_id(e.card);
    if (!card) return;
    const want = e.face_down ? 'back' : 'front';
    if (card.facing === want) return;
    if (!e.face_down) {
      const final = find_view(this.view, e.card);
      const look = e.view ?? (final && !final.cv.face_down ? final.cv : null);
      if (look) apply_card_view(card, look);
      play_sound('tarot2', 0.85 + 0.3 * Math.random(), 0.6);
    } else {
      play_sound('card1', 0.85 + 0.3 * Math.random());
    }
    card.flip();
    card.juice_up(0.3, 0.3);
  }

  /** Card:set_edition's and Card:set_seal's juice and sound, with the card's new look */
  private changed(e: Ev & { type: 'card_changed' }) {
    const card = card_by_id(e.card);
    if (!card) return;
    if (e.view && !e.view.face_down && card.facing === 'front') apply_card_view(card, e.view);
    if (e.change === 'seal') {
      card.juice_up(0.3, 0.3);
      play_sound('gold_seal', 1.2, 0.4);
      return;
    }
    card.juice_up(1, 0.5);
    const edition = e.view?.edition;
    if (edition === 'foil') play_sound('foil1', 1.2, 0.4);
    if (edition === 'holo') play_sound('holo1', 1.2 * 1.58, 0.4);
    if (edition === 'polychrome') play_sound('polychrome1', 1.2, 0.7);
    if (edition === 'negative') play_sound('negative', 1.5, 0.4);
  }

  /** unlock_card: the center is unlocked from now on (the collection, the run setup) and the notification shows */
  private unlocked(e: Ev & { type: 'card_unlocked' }) {
    const c = G.P_CENTERS[e.key];
    if (c) c.unlocked = true;
    if (c && e.set === 'Back') c.discovered = true;
    notify_alert(e.key, e.set);
  }

  /** a big text over a card: The Wheel of Fortune's "Nope!" (Card:use_consumeable) */
  private attention(e: Ev & { type: 'attention_text' }) {
    const used = card_by_id(e.card);
    if (!used || e.key !== 'k_nope_ex') return;
    const in_pack = G.STATE === G.STATES.TAROT_PACK || G.STATE === G.STATES.SPECTRAL_PACK;
    attention_text({
      text: localize('k_nope_ex'), scale: 1.3, hold: 1.4, major: used, backdrop_colour: G.C.SECONDARY_SET.Tarot,
      align: in_pack ? 'tm' : 'cm', offset: { x: 0, y: in_pack ? -0.2 : 0 }, silent: true,
    });
    G.E_MANAGER.add_event(new Event({
      trigger: 'after', delay: 0.06 * G.SETTINGS.GAMESPEED, blockable: false, blocking: false,
      func: () => { play_sound('tarot2', 0.76, 0.4); return true; },
    }));
    play_sound('tarot2', 1, 0.4);
    used.juice_up(0.3, 0.5);
  }

  private removed(e: Ev & { type: 'card_removed' }) {
    const card = card_by_id(e.card);
    forget_card(e.card);
    if (!card || card.REMOVED) return;
    if (card.removing) return; // its own animation removes it
    card.area?.remove_card(card);
    card.remove();
  }

  private hand(e: Ev & { type: 'hand' }) {
    const ch = G.GAME.current_round.current_hand;
    const vals: HandTextVals = {};
    if (e.hand !== undefined && e.hand !== null) vals.handname = e.hand;
    if (e.level !== undefined && e.level !== null) vals.level = e.level;
    if (e.chips !== undefined && e.chips !== null) vals.chips = e.chips;
    if (e.mult !== undefined && e.mult !== null) vals.mult = e.mult;
    if (e.hand_score !== undefined && e.hand_score !== null) vals.chip_total = e.hand_score;
    let config: HandTextConfig = { delay: 0 };
    if (e._sound) config = { ...config, ...e._sound };
    else if (vals.handname && vals.handname !== '' && vals.handname !== ch.handname) config = { ...config, sound: 'button', volume: 0.4, immediate: true };
    if (e._status) {
      vals.StatusText = true;
      play_sound('tarot1');
      this.hooks.level_up_card?.()?.juice_up(0.8, 0.5);
      G.TAROT_INTERRUPT_PULSE = vals.mult !== undefined ? true : G.TAROT_INTERRUPT_PULSE;
    }
    if (e._sound && vals.level !== undefined) {
      play_sound('tarot1');
      this.hooks.level_up_card?.()?.juice_up(0.8, 0.5);
      G.TAROT_INTERRUPT_PULSE = null;
    }
    update_hand_text_now(config, vals);
    if (vals.chip_total !== undefined) play_sound('button', 0.9, 0.6);
  }

  private card_text(e: Ev & { type: 'card_text' }) {
    const card = e.card !== null ? card_by_id(e.card) : null;
    if (!card) return;
    const is_playing = card.ability?.set === 'Default' || card.ability?.set === 'Enhanced';
    const percent = this.percent;
    this.percent += 0.08;
    const amt = e.amount;
    if (e.effect === 'debuffed') { card_eval_status_text_now(card, 'debuff', null, percent); return; }
    if (e.effect === 'swap') { card_eval_status_text_now(card, 'swap', amt, percent); return; }
    if (e.effect === 'again') { card_eval_status_text_now(card, 'extra', null, percent, undefined, { message: localize('k_again_ex') }); return; }
    if (e.edition) {
      const ex: StatusExtra = { edition: true };
      if (e.effect === 'chips') { ex.message = localize({ type: 'variable', key: 'a_chips', vars: [amt] }); ex.chip_mod = amt; ex.colour = G.C.EDITION; }
      if (e.effect === 'mult') { ex.message = localize({ type: 'variable', key: 'a_mult', vars: [amt] }); ex.mult_mod = amt; ex.colour = G.C.DARK_EDITION; }
      if (e.effect === 'x_mult') { ex.message = localize({ type: 'variable', key: 'a_xmult', vars: [amt] }); ex.x_mult_mod = amt; ex.colour = G.C.EDITION; }
      if (is_playing) ex.colour = G.C.DARK_EDITION;
      card_eval_status_text_now(card, is_playing ? 'extra' : 'jokers', null, percent, undefined, ex);
      return;
    }
    if (e.effect === 'message') {
      const final = find_view(this.view, card.api_id!);
      if (final && !final.cv.face_down) apply_card_view(card, final.cv);
      const msg = joker_message(card, e.message, { removed: this.removed_ids.has(card.api_id!), action: this.action, view: this.view });
      if (msg) card_eval_status_text_now(card, 'extra', null, percent, undefined, msg);
      else card.juice_up(0.6, 0.1);
      return;
    }
    if (is_playing) {
      const t = e.effect === 'mult' && e.held ? 'h_mult' : e.effect;
      card_eval_status_text_now(card, t, amt, percent);
      return;
    }
    // a joker or consumable's own effect
    if (e.effect === 'dollars') { card_eval_status_text_now(card, 'dollars', amt, percent); return; }
    const ex: StatusExtra = {};
    if (e.effect === 'chips') { ex.message = localize({ type: 'variable', key: 'a_chips', vars: [amt] }); ex.chip_mod = amt; }
    if (e.effect === 'mult') { ex.message = localize({ type: 'variable', key: 'a_mult', vars: [amt] }); ex.mult_mod = amt; }
    if (e.effect === 'x_mult') { ex.message = localize({ type: 'variable', key: 'a_xmult', vars: [amt] }); ex.Xmult_mod = amt; }
    card_eval_status_text_now(card, 'jokers', null, percent, undefined, ex);
  }
}
