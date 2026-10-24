// cardarea.lua: an area holding cards (hand, jokers, deck, shop...), laying
// them out and drawing them in the game's order.
import { G, Moveable, UIBox, Event, play_sound, add_to_drawhash, remove_all, array_remove, adjust_alpha } from '@/shared/lib/engine';
import { localize } from '@/shared/lib/localization';
import type { Card } from './card';

export interface CardAreaConfig {
  [key: string]: any;
  card_limit?: number;
  type?: 'deck' | 'discard' | 'hand' | 'play' | 'joker' | 'consumeable' | 'shop' | 'title' | 'title_2' | 'voucher';
  highlight_limit?: number;
  card_w?: number;
  sort?: string;
  lr_padding?: number;
}

export class CardArea extends Moveable {
  /** lets the engine find card areas among G's fields (Game:delete_run) */
  get is_card_area() { return true; }
  card_w!: number;
  cards!: Card[];
  highlighted!: Card[];
  shuffle_amt!: number;

  constructor(X?: number, Y?: number, W?: number, H?: number, config?: CardAreaConfig) {
    super();
    if (X !== undefined) this.init_cardarea(X, Y!, W!, H!, config ?? {});
  }

  init_cardarea(X: number, Y: number, W: number, H: number, config: CardAreaConfig) {
    this.init_moveable(X, Y, W, H);
    this.states.drag.can = false;
    this.states.hover.can = false;
    this.states.click.can = false;
    this.config = config;
    this.card_w = config.card_w ?? G.CARD_W;
    this.cards = [];
    this.children = {};
    this.highlighted = [];
    this.config.highlighted_limit = config.highlight_limit ?? 5;
    this.config.card_limit = config.card_limit ?? 52;
    this.config.temp_limit = this.config.card_limit;
    this.config.card_count = 0;
    this.config.type = config.type ?? 'deck';
    this.config.sort = config.sort ?? 'desc';
    this.config.lr_padding = config.lr_padding ?? 0.1;
    this.shuffle_amt = 0;
    if (Object.getPrototypeOf(this) === CardArea.prototype) G.I.CARDAREA.push(this);
  }

  emplace(card: Card, location?: 'front' | null, stay_flipped?: boolean) {
    if (location === 'front' || this.config.type === 'deck') this.cards.unshift(card);
    else this.cards.push(card);
    if (card.facing === 'back' && this.config.type !== 'discard' && this.config.type !== 'deck' && !stay_flipped) card.flip();
    if (this === G.hand && stay_flipped) card.ability.wheel_flipped = true;
    if (this.cards.length > this.config.card_limit && this === G.deck) this.config.card_limit = this.cards.length;
    card.set_card_area(this);
    this.set_ranks();
    this.align_cards();
  }

  remove_card(card?: Card | null, discarded_only?: boolean): Card | null {
    if (!this.cards) return null;
    const list = discarded_only ? this.cards.filter((v) => v.ability && v.ability.discarded) : this.cards;
    if (this.config.type === 'discard' || this.config.type === 'deck') card = card ?? list[list.length - 1];
    else card = card ?? list[0];
    for (let i = this.cards.length - 1; i >= 0; i--) {
      if (this.cards[i] === card) {
        card.remove_from_area();
        this.cards.splice(i, 1);
        this.remove_from_highlighted(card, true);
        break;
      }
    }
    this.set_ranks();
    return card ?? null;
  }

  change_size(delta: number) {
    if (delta !== 0) {
      G.E_MANAGER.add_event(new Event({
        func: () => {
          this.config.real_card_limit = (this.config.real_card_limit ?? this.config.card_limit) + delta;
          this.config.card_limit = Math.max(0, this.config.real_card_limit);
          return true;
        },
      }));
    }
  }

  can_highlight(_card: Card) {
    const t = this.config.type;
    return t === 'hand' || t === 'joker' || t === 'consumeable' || (t === 'shop' && this.config.highlighted_limit > 0);
  }

  add_to_highlighted(card: Card, silent?: boolean) {
    if (this.config.type === 'shop') {
      if (this.highlighted[0]) this.remove_from_highlighted(this.highlighted[0]);
      this.highlighted.push(card);
      card.highlight(true);
      if (!silent) play_sound('cardSlide1');
    } else if (this.config.type === 'joker' || this.config.type === 'consumeable') {
      if (this.highlighted.length >= this.config.highlighted_limit) this.remove_from_highlighted(this.highlighted[0]);
      this.highlighted.push(card);
      card.highlight(true);
      if (!silent) play_sound('cardSlide1');
    } else {
      if (this.highlighted.length >= this.config.highlighted_limit) {
        card.highlight(false);
      } else {
        this.highlighted.push(card);
        card.highlight(true);
        if (!silent) play_sound('cardSlide1');
      }
      if (this === G.hand && G.STATE === G.STATES.SELECTING_HAND) this.parse_highlighted();
    }
  }

  /** what the selected cards make: asked to the API (G.FUNCS.preview_hand) */
  parse_highlighted() {
    G.boss_throw_hand = null;
    G.FUNCS.preview_hand?.(this);
  }

  remove_from_highlighted(card: Card, force?: boolean) {
    if (!force && card && card.ability.forced_selection && this === G.hand) return;
    for (let i = this.highlighted.length - 1; i >= 0; i--) {
      if (this.highlighted[i] === card) { this.highlighted.splice(i, 1); break; }
    }
    card.highlight(false);
    if (this === G.hand && G.STATE === G.STATES.SELECTING_HAND) this.parse_highlighted();
  }

  unhighlight_all() {
    for (let i = this.highlighted.length - 1; i >= 0; i--) {
      if (this.highlighted[i].ability.forced_selection && this === G.hand) continue;
      this.highlighted[i].highlight(false);
      this.highlighted.splice(i, 1);
    }
    if (this === G.hand && G.STATE === G.STATES.SELECTING_HAND) this.parse_highlighted();
  }

  set_ranks() {
    this.cards.forEach((card, i) => {
      const k = i + 1;
      card.rank = k;
      card.states.collide.can = true;
      if (k > 1 && this.config.type === 'deck') {
        card.states.drag.can = false;
        card.states.collide.can = false;
      } else if (this.config.type === 'play' || this.config.type === 'shop' || this.config.type === 'consumeable') {
        card.states.drag.can = false;
      } else {
        card.states.drag.can = true;
      }
    });
  }

  move(dt: number) {
    if (this === G.hand) {
      const sel = !G.deck_preview && (G.STATE === G.STATES.SELECTING_HAND || G.STATE === G.STATES.DRAW_TO_HAND) ? 1 : 0;
      const desired_y = G.TILE_H - G.hand.T.h - 1.9 * sel;
      G.hand.T.y = 15 * G.real_dt * desired_y + (1 - 15 * G.real_dt) * G.hand.T.y;
      if (Math.abs(desired_y - G.hand.T.y) < 0.01) G.hand.T.y = desired_y;
    }
    super.move(dt);
    this.align_cards();
  }

  update(_dt: number) {
    if (this === G.hand) {
      for (const v of this.cards) {
        if (v.ability.forced_selection && !this.highlighted[0]) this.add_to_highlighted(v);
      }
    }
    if (this === G.deck) {
      this.states.collide.can = true;
      this.states.hover.can = true;
      this.states.click.can = true;
    }
    this.config.temp_limit = Math.max(this.cards.length, this.config.card_limit);
    this.config.card_count = this.cards.length;
  }

  draw() {
    if (!this.states.visible) return;
    if (G.VIEWING_DECK && (this === G.deck || this === G.hand || this === G.play)) return;
    const state = G.TAROT_INTERRUPT ?? G.STATE;
    const invisible: Record<string, number> = { discard: 1, voucher: 1, play: 1, consumeable: 1, title: 1, title_2: 1 };
    const S = G.STATES;
    const hidden_hand_states = [S.SHOP, S.TAROT_PACK, S.SPECTRAL_PACK, S.STANDARD_PACK, S.BUFFOON_PACK, S.PLANET_PACK, S.ROUND_EVAL, S.BLIND_SELECT];
    if (invisible[this.config.type] ||
      (this.config.type === 'hand' && hidden_hand_states.includes(state)) ||
      (this.config.type === 'deck' && this !== G.deck) ||
      (this.config.type === 'shop' && this !== G.shop_vouchers)) {
      // no area box
    } else {
      if (!this.children.area_uibox) {
        const card_count = this !== G.shop_vouchers ? {
          n: G.UIT.R, config: { align: this === G.jokers ? 'cl' : this === G.hand ? 'cm' : 'cr', padding: 0.03, no_fill: true }, nodes: [
            { n: G.UIT.B, config: { w: 0.1, h: 0.1 } },
            { n: G.UIT.T, config: { ref_table: this.config, ref_value: 'card_count', scale: 0.3, colour: G.C.WHITE } },
            { n: G.UIT.T, config: { text: '/', scale: 0.3, colour: G.C.WHITE } },
            { n: G.UIT.T, config: { ref_table: this.config, ref_value: 'card_limit', scale: 0.3, colour: G.C.WHITE } },
            { n: G.UIT.B, config: { w: 0.1, h: 0.1 } },
          ],
        } : null;
        this.children.area_uibox = new UIBox({
          definition: { n: G.UIT.ROOT, config: { align: 'cm', colour: G.C.CLEAR }, nodes: [
            { n: G.UIT.R, config: { minw: this.T.w, minh: this.T.h, align: 'cm', padding: 0.1, mid: true, r: 0.1, colour: this !== G.shop_vouchers ? [0, 0, 0, 0.1] : null, ref_table: this }, nodes: [
              this === G.shop_vouchers ? { n: G.UIT.C, config: { align: 'cm', paddin: 0.1, func: 'shop_voucher_empty', visible: false }, nodes: [
                { n: G.UIT.R, config: { align: 'cm' }, nodes: [{ n: G.UIT.T, config: { text: 'DEFEAT', scale: 0.6, colour: G.C.WHITE } }] },
                { n: G.UIT.R, config: { align: 'cm' }, nodes: [{ n: G.UIT.T, config: { text: 'BOSS BLIND', scale: 0.4, colour: G.C.WHITE } }] },
                { n: G.UIT.R, config: { align: 'cm' }, nodes: [{ n: G.UIT.T, config: { text: 'TO RESTOCK', scale: 0.4, colour: G.C.WHITE } }] },
              ] } : null,
            ] },
            card_count,
          ] },
          config: { align: 'cm', offset: { x: 0, y: 0 }, major: this, parent: this },
        });
      }
      this.children.area_uibox.draw();
    }
    this.draw_boundingrect();
    add_to_drawhash(this);

    this.ARGS.draw_layers = this.ARGS.draw_layers ?? this.config.draw_layers ?? ['shadow', 'card'];
    const focused = G.CONTROLLER.focused.target, dragging = G.CONTROLLER.dragging.target;
    for (const v of this.ARGS.draw_layers) {
      const t = this.config.type;
      if (t === 'deck') {
        for (let i = this.cards.length; i >= 1; i--) {
          const c = this.cards[i - 1];
          if (c !== focused) {
            if (i === 1 || i % (this.config.thin_draw ?? 9) === 0 || i === this.cards.length || Math.abs(c.VT.x - this.T.x) > 1 || Math.abs(c.VT.y - this.T.y) > 1) {
              if (dragging !== c) c.draw(v);
            }
          }
        }
      }
      if (t === 'joker' || t === 'consumeable' || t === 'shop' || t === 'title_2') {
        for (const c of this.cards) if (c !== focused && !c.highlighted && dragging !== c) c.draw(v);
        for (const c of this.cards) if (c !== focused && c.highlighted && dragging !== c) c.draw(v);
      }
      if (t === 'discard') {
        for (const c of this.cards) if (c !== focused && Math.abs(c.VT.x - this.T.x) > 1 && dragging !== c) c.draw(v);
      }
      if (t === 'hand' || t === 'play' || t === 'title' || t === 'voucher') {
        for (const c of this.cards) if ((c !== focused || this === G.hand) && dragging !== c) c.draw(v);
      }
    }
    if (this === G.deck) {
      if (!this.children.view_deck) {
        this.children.view_deck = new UIBox({
          definition: { n: G.UIT.ROOT, config: { align: 'cm', padding: 0.1, r: 0.1, colour: G.C.CLEAR }, nodes: [
            { n: G.UIT.R, config: { align: 'cm', padding: 0.05, r: 0.1, colour: adjust_alpha(G.C.BLACK, 0.5), func: 'set_button_pip', focus_args: { button: 'triggerright', orientation: 'bm', scale: 0.6 }, button: 'deck_info' }, nodes: [
              { n: G.UIT.R, config: { align: 'cm', maxw: 2 }, nodes: [{ n: G.UIT.T, config: { text: localize('k_view'), scale: 0.48, colour: G.C.WHITE, shadow: true } }] },
              { n: G.UIT.R, config: { align: 'cm', maxw: 2 }, nodes: [{ n: G.UIT.T, config: { text: localize('k_deck'), scale: 0.38, colour: G.C.WHITE, shadow: true } }] },
            ] },
          ] },
          config: { align: 'cm', offset: { x: 0, y: 0 }, major: this.cards[0] ?? this, parent: this },
        });
        this.children.view_deck.states.collide.can = false;
      }
      if (G.deck_preview || this.states.collide.is || (G.buttons && G.buttons.states.collide.is && G.CONTROLLER.HID.controller)) this.children.view_deck.draw();
    }
  }

  align_cards() {
    const n = this.cards.length;
    const rm = G.SETTINGS.reduced_motion ? 0 : 1;
    const t = this.config.type;
    const pack_hand = t === 'hand' && (G.STATE === G.STATES.TAROT_PACK || G.STATE === G.STATES.SPECTRAL_PACK || G.STATE === G.STATES.PLANET_PACK);
    const byX = (a: Card, b: Card) => (a.T.x + a.T.w / 2) - (b.T.x + b.T.w / 2);
    if (t === 'deck') {
      const deck_height = (this.config.deck_height ?? 0.15) / 52;
      this.cards.forEach((card, i) => {
        const k = i + 1;
        if (card.facing === 'front') card.flip();
        if (!card.states.drag.is) {
          const div = this === G.deck ? 1 : 2;
          card.T.x = this.T.x + 0.5 * (this.T.w - card.T.w) + this.shadow_parrallax.x * deck_height * (n / div - k) + 0.9 * this.shuffle_amt * (1 - k * 0.01) * (k % 2 === 1 ? 1 : 0);
          card.T.y = this.T.y + 0.5 * (this.T.h - card.T.h) + this.shadow_parrallax.y * deck_height * (n / div - k);
          card.T.r = 0 + 0.3 * this.shuffle_amt * (1 + k * 0.05) * (k % 2 === 1 ? 1 : 0);
          card.T.x = card.T.x + card.shadow_parrallax.x / 30;
        }
      });
    }
    if (t === 'discard') {
      for (const card of this.cards) {
        if (card.facing === 'front') card.flip();
        if (!card.states.drag.is) {
          card.T.x = this.T.x + (this.T.w - card.T.w) * card.discard_pos.x;
          card.T.y = this.T.y + (this.T.h - card.T.h) * card.discard_pos.y;
          card.T.r = card.discard_pos.r;
        }
      }
    }
    const fanX = (k: number, card: Card, max_cards: number) =>
      this.T.x + (this.T.w - this.card_w) * ((k - 1) / Math.max(max_cards - 1, 1) - 0.5 * (n - max_cards) / Math.max(max_cards - 1, 1)) + 0.5 * (this.card_w - card.T.w);
    if (pack_hand) {
      this.cards.forEach((card, i) => {
        const k = i + 1;
        if (!card.states.drag.is) {
          card.T.r = 0.4 * (-n / 2 - 0.5 + k) / n + rm * 0.02 * Math.sin(2 * G.TIMERS.REAL + card.T.x);
          const max_cards = Math.max(n, this.config.temp_limit);
          card.T.x = fanX(k, card, max_cards);
          const hh = card.highlighted ? G.HIGHLIGHT_H : 0;
          card.T.y = G.hand.T.y - 1.8 * card.T.h - hh + rm * 0.1 * Math.sin(0.666 * G.TIMERS.REAL + card.T.x) + Math.abs(1.3 * (-n / 2 + k - 0.5) / n) ** 2 - 0.3;
          card.T.x = card.T.x + card.shadow_parrallax.x / 30;
        }
      });
      this.cards.sort(byX);
    }
    if (t === 'hand' && !pack_hand) {
      this.cards.forEach((card, i) => {
        const k = i + 1;
        if (!card.states.drag.is) {
          card.T.r = 0.2 * (-n / 2 - 0.5 + k) / n + rm * 0.02 * Math.sin(2 * G.TIMERS.REAL + card.T.x);
          const max_cards = Math.max(n, this.config.temp_limit);
          card.T.x = fanX(k, card, max_cards);
          const hh = card.highlighted ? G.HIGHLIGHT_H : 0;
          card.T.y = this.T.y + this.T.h / 2 - card.T.h / 2 - hh + rm * 0.03 * Math.sin(0.666 * G.TIMERS.REAL + card.T.x) + Math.abs(0.5 * (-n / 2 + k - 0.5) / n) - 0.2;
          card.T.x = card.T.x + card.shadow_parrallax.x / 30;
        }
      });
      this.cards.sort(byX);
    }
    if (t === 'title' || (t === 'voucher' && n === 1)) {
      this.cards.forEach((card, i) => {
        const k = i + 1;
        if (!card.states.drag.is) {
          card.T.r = 0.2 * (-n / 2 - 0.5 + k) / n + rm * 0.02 * Math.sin(2 * G.TIMERS.REAL + card.T.x);
          const max_cards = Math.max(n, this.config.temp_limit);
          card.T.x = fanX(k, card, max_cards);
          const hh = card.highlighted ? G.HIGHLIGHT_H : 0;
          card.T.y = this.T.y + this.T.h / 2 - card.T.h / 2 - hh + rm * 0.03 * Math.sin(0.666 * G.TIMERS.REAL + card.T.x) + Math.abs(0.5 * (-n / 2 + k - 0.5) / n) - (n > 1 ? 0.2 : 0);
          card.T.x = card.T.x + card.shadow_parrallax.x / 30;
        }
      });
      this.cards.sort(byX);
    }
    if (t === 'voucher' && n > 1) {
      const self_w = Math.max(this.T.w, 3.2);
      this.cards.forEach((card, i) => {
        const k = i + 1;
        if (!card.states.drag.is) {
          card.T.r = 0.2 * (-n / 2 - 0.5 + k) / n + rm * 0.02 * Math.sin(2 * G.TIMERS.REAL + card.T.x + card.T.y) + (k % 2 === 0 ? 1 : -1) * 0.08;
          const max_cards = Math.max(n, this.config.temp_limit);
          card.T.x = this.T.x + (self_w - this.card_w) * ((k - 1) / Math.max(max_cards - 1, 1) - 0.5 * (n - max_cards) / Math.max(max_cards - 1, 1)) + 0.5 * (this.card_w - card.T.w) + (k % 2 === 1 ? 1 : -1) * 0.27 + (this.T.w - self_w) / 2;
          const hh = card.highlighted ? G.HIGHLIGHT_H : 0;
          card.T.y = this.T.y + this.T.h / 2 - card.T.h / 2 - hh + rm * 0.03 * Math.sin(0.666 * G.TIMERS.REAL + card.T.x) + Math.abs(0.5 * (-n / 2 + k - 0.5) / n) - (n > 1 ? 0.2 : 0);
          card.T.x = card.T.x + card.shadow_parrallax.x / 30;
        }
      });
      this.cards.sort((a, b) => a.ability.order - b.ability.order);
    }
    if (t === 'play' || t === 'shop') {
      this.cards.forEach((card, i) => {
        const k = i + 1;
        if (!card.states.drag.is) {
          card.T.r = 0;
          const max_cards = Math.max(n, this.config.temp_limit);
          card.T.x = fanX(k, card, max_cards) + (this.config.card_limit === 1 ? 0.5 * (this.T.w - card.T.w) : 0);
          const hh = card.highlighted ? G.HIGHLIGHT_H : 0;
          card.T.y = this.T.y + this.T.h / 2 - card.T.h / 2 - hh;
          card.T.x = card.T.x + card.shadow_parrallax.x / 30;
        }
      });
      this.cards.sort(byX);
    }
    if (t === 'joker' || t === 'title_2') {
      this.cards.forEach((card, i) => {
        const k = i + 1;
        if (!card.states.drag.is) {
          card.T.r = 0.1 * (-n / 2 - 0.5 + k) / n + rm * 0.02 * Math.sin(2 * G.TIMERS.REAL + card.T.x);
          const max_cards = Math.max(n, this.config.temp_limit);
          card.T.x = fanX(k, card, max_cards);
          if (n > 2 || (n > 1 && this === G.consumeables) || (n > 1 && this.config.spread)) {
            card.T.x = this.T.x + (this.T.w - this.card_w) * ((k - 1) / (n - 1)) + 0.5 * (this.card_w - card.T.w);
          } else if (n > 1 && this !== G.consumeables) {
            card.T.x = this.T.x + (this.T.w - this.card_w) * ((k - 0.5) / n) + 0.5 * (this.card_w - card.T.w);
          } else {
            card.T.x = this.T.x + this.T.w / 2 - this.card_w / 2 + 0.5 * (this.card_w - card.T.w);
          }
          const hh = card.highlighted ? G.HIGHLIGHT_H / 2 : 0;
          card.T.y = this.T.y + this.T.h / 2 - card.T.h / 2 - hh + rm * 0.03 * Math.sin(0.666 * G.TIMERS.REAL + card.T.x);
          card.T.x = card.T.x + card.shadow_parrallax.x / 30;
        }
      });
      this.cards.sort((a, b) => (a.T.x + a.T.w / 2 - 100 * (a.pinned ? a.sort_id : 0)) - (b.T.x + b.T.w / 2 - 100 * (b.pinned ? b.sort_id : 0)));
    }
    if (t === 'consumeable') {
      this.cards.forEach((card, i) => {
        const k = i + 1;
        if (!card.states.drag.is) {
          if (n > 1) card.T.x = this.T.x + (this.T.w - this.card_w) * ((k - 1) / (n - 1)) + 0.5 * (this.card_w - card.T.w);
          else card.T.x = this.T.x + this.T.w / 2 - this.card_w / 2 + 0.5 * (this.card_w - card.T.w);
          const hh = card.highlighted ? G.HIGHLIGHT_H : 0;
          card.T.y = this.T.y + this.T.h / 2 - card.T.h / 2 - hh + (!card.highlighted ? rm * 0.05 * Math.sin(2 * 1.666 * G.TIMERS.REAL + card.T.x) : 0);
          card.T.x = card.T.x + card.shadow_parrallax.x / 30;
        }
      });
      this.cards.sort(byX);
    }
    this.cards.forEach((card, i) => { card.rank = i + 1; });
    if (this.children.view_deck) this.children.view_deck.set_role({ major: this.cards[0] ?? this });
  }

  hard_set_T(X?: number, Y?: number, W?: number, H?: number) {
    super.hard_set_T(X ?? this.T.x, Y ?? this.T.y, W ?? this.T.w, H ?? this.T.h);
    this.calculate_parrallax();
    this.align_cards();
    this.hard_set_cards();
  }

  hard_set_cards() {
    for (const card of this.cards) {
      card.hard_set_T();
      card.calculate_parrallax();
    }
  }

  sort(method?: string) {
    this.config.sort = method ?? this.config.sort;
    const s = this.config.sort;
    if (s === 'desc') this.cards.sort((a, b) => b.get_nominal() - a.get_nominal());
    else if (s === 'asc') this.cards.sort((a, b) => a.get_nominal() - b.get_nominal());
    else if (s === 'suit desc') this.cards.sort((a, b) => b.get_nominal('suit') - a.get_nominal('suit'));
    else if (s === 'suit asc') this.cards.sort((a, b) => a.get_nominal('suit') - b.get_nominal('suit'));
    else if (s === 'order') this.cards.sort((a, b) => (a.config.card.order ?? a.config.center.order) - (b.config.card.order ?? b.config.center.order));
  }

  click() {
    if (this === G.deck) G.FUNCS.deck_info();
  }

  remove() {
    if (this.cards) remove_all(this.cards);
    this.cards = null as any;
    if (this.children) remove_all(this.children);
    this.children = null as any;
    array_remove(G.I.CARDAREA, this);
    super.remove();
  }
}
