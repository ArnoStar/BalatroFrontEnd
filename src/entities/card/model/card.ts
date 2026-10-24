// card.lua: a card on screen (playing card, joker, consumable, voucher,
// booster). Its look, motion, hover/click/drag and visual effects, as in the
// game. What the card *is* (ability values, cost, debuff...) comes from the
// API (see from-view.ts); the game rules that change it live in the engine.
import {
  G, Moveable, Sprite, Particles, Event, UIBox, Node, play_sound, add_to_drawhash, each, remove_all, array_remove,
  copy_table, math_random,
} from '@/shared/lib/engine';
import { love } from '@/shared/lib/love';
import { generate_UIBox_ability_table, card_h_popup } from '../ui/card-ui';

export interface CardParams {
  playing_card?: number; viewed_back?: boolean; bypass_discovery_center?: boolean; bypass_discovery_ui?: boolean;
  bypass_lock?: boolean; discover?: boolean; bypass_back?: any;
}

/** the stake sticker and suit-front sprites a card may use */
export function get_front_spriteinfo(_front: any): [any, any] {
  if (_front && _front.suit && (_front.value === 'Jack' || _front.value === 'Queen' || _front.value === 'King')) {
    const collab = G.SETTINGS.CUSTOM_DECK?.Collabs?.[_front.suit];
    if (collab && collab !== 'default') {
      const atlas = G.ASSET_ATLAS[collab + '_' + (G.SETTINGS.colourblind_option ? 2 : 1)];
      if (atlas) return [atlas, G.COLLABS.pos[_front.value]];
    }
  }
  return [G.ASSET_ATLAS[_front.atlas] ?? G.ASSET_ATLAS['cards_' + (G.SETTINGS.colourblind_option ? 2 : 1)], _front.pos];
}

export class Card extends Moveable {
  params!: CardParams;
  tilt_var!: { mx: number; my: number; dx: number; dy: number; amt: number };
  ambient_tilt!: number;
  playing_card?: number;
  sort_id!: number;
  back!: string;
  bypass_discovery_center?: boolean;
  bypass_discovery_ui?: boolean;
  bypass_lock?: boolean;
  no_ui?: boolean;
  base_cost!: number;
  extra_cost!: number;
  cost!: number;
  sell_cost!: number;
  sell_cost_label!: any;
  unique_val!: number;
  edition: any;
  zoom!: boolean;
  ability!: any;
  base!: any;
  discard_pos!: { r: number; x: number; y: number };
  facing!: 'front' | 'back';
  sprite_facing!: 'front' | 'back';
  flipping: 'f2b' | 'b2f' | null = null;
  area: any;
  highlighted!: boolean;
  click_timeout!: number;
  debuff!: boolean;
  rank: number | null = null;
  added_to_deck?: boolean;
  seal?: string | null;
  label?: string;
  dissolve?: number;
  dissolve_colours?: any[];
  hover_tilt?: number;
  vortex?: boolean;
  no_shadow?: boolean;
  greyed?: boolean;
  pinned?: boolean;
  sticker?: string;
  sticker_run?: string | null;
  removed?: boolean;
  shattered?: boolean;
  /** the timeline started its leaving animation (dissolve, shatter...) */
  removing?: boolean;
  ability_UIBox_table?: any;
  mouse_damping?: number;
  back_overlay?: number[];
  opening?: boolean;
  /** a booster a tag opened (Charm Tag...) */
  from_tag?: boolean;
  /** the API's id for this card (its sort_id in the engine) */
  api_id?: number;
  jimbo?: boolean;

  constructor(X?: number, Y?: number, W?: number, H?: number, card?: any, center?: any, params?: CardParams) {
    super();
    if (X !== undefined) this.init_card(X, Y!, W!, H!, card, center, params);
  }

  init_card(X: number, Y: number, W: number, H: number, card: any, center: any, params?: CardParams) {
    this.params = (params && typeof params === 'object') ? params : {};
    this.init_moveable(X, Y, W, H);
    this.CT = this.VT;
    this.config = { card: card ?? {}, center };
    this.tilt_var = { mx: 0, my: 0, dx: 0, dy: 0, amt: 0 };
    this.ambient_tilt = 0.2;
    this.states.collide.can = true;
    this.states.hover.can = true;
    this.states.drag.can = true;
    this.states.click.can = true;
    this.playing_card = this.params.playing_card;
    G.sort_id = (G.sort_id ?? 0) + 1;
    this.sort_id = G.sort_id;
    this.back = this.params.viewed_back ? 'viewed_back' : 'selected_back';
    this.bypass_discovery_center = this.params.bypass_discovery_center;
    this.bypass_discovery_ui = this.params.bypass_discovery_ui;
    this.bypass_lock = this.params.bypass_lock;
    this.no_ui = this.config.card && this.config.card.no_ui;
    this.children = {};
    this.base_cost = 0;
    this.extra_cost = 0;
    this.cost = 0;
    this.sell_cost = 0;
    this.sell_cost_label = 0;
    this.children.shadow = new Moveable(0, 0, 0, 0);
    this.unique_val = 1 - this.ID / 1603301;
    this.edition = null;
    this.zoom = true;
    this.set_ability(center, true);
    this.set_base(card, true);
    this.discard_pos = { r: 3.6 * (Math.random() - 0.5), x: Math.random(), y: Math.random() };
    this.facing = 'front';
    this.sprite_facing = 'front';
    this.flipping = null;
    this.area = null;
    this.highlighted = false;
    this.click_timeout = 0.3;
    this.T.scale = 0.95;
    this.debuff = false;
    this.rank = null;
    this.added_to_deck = undefined;
    if (this.children.front) this.children.front.VT.w = 0;
    this.children.back.VT.w = 0;
    this.children.center.VT.w = 0;
    if (this.children.front) { this.children.front.parent = this; this.children.front.layered_parallax = undefined; }
    this.children.back.parent = this; this.children.back.layered_parallax = undefined;
    this.children.center.parent = this; this.children.center.layered_parallax = undefined;
    this.set_cost();
    if (Object.getPrototypeOf(this) === Card.prototype) G.I.CARD.push(this);
  }

  update_alert() {
    // collection alerts: every card is already alerted in a fully unlocked profile
  }

  set_base(card: any, initial?: boolean) {
    card = card ?? {};
    this.config.card = card;
    for (const k of Object.keys(G.P_CARDS)) if (card === G.P_CARDS[k]) this.config.card_key = k;
    if (Object.keys(card).length > 0) this.set_sprites(null, card);
    let suit_nominal_original = null;
    if (this.base && this.base.suit_nominal_original) suit_nominal_original = this.base.suit_nominal_original;
    this.base = {
      name: this.config.card.name, suit: this.config.card.suit, value: this.config.card.value,
      nominal: 0, suit_nominal: 0, face_nominal: 0, colour: G.C.SUITS[this.config.card.suit], times_played: 0,
    };
    const v = this.base.value;
    const ranks: Record<string, [number, number, number]> = {
      '2': [2, 0, 2], '3': [3, 0, 3], '4': [4, 0, 4], '5': [5, 0, 5], '6': [6, 0, 6], '7': [7, 0, 7], '8': [8, 0, 8],
      '9': [9, 0, 9], '10': [10, 0, 10], Jack: [10, 0.1, 11], Queen: [10, 0.2, 12], King: [10, 0.3, 13], Ace: [11, 0.4, 14],
    };
    if (ranks[v]) { this.base.nominal = ranks[v][0]; this.base.face_nominal = ranks[v][1]; this.base.id = ranks[v][2]; }
    if (initial) this.base.original_value = this.base.value;
    const suits: Record<string, [number, number]> = { Diamonds: [0.01, 0.001], Clubs: [0.02, 0.002], Hearts: [0.03, 0.003], Spades: [0.04, 0.004] };
    const s = suits[this.base.suit];
    if (s) { this.base.suit_nominal = s[0]; this.base.suit_nominal_original = suit_nominal_original ?? s[1]; }
  }

  set_sprites(_center: any, _front?: any) {
    const C = this.children;
    if (_front) {
      const [_atlas, _pos] = get_front_spriteinfo(_front);
      if (C.front) {
        C.front.atlas = _atlas;
        C.front.set_sprite_pos(_pos);
      } else {
        C.front = new Sprite(this.T.x, this.T.y, this.T.w, this.T.h, _atlas, _pos);
        C.front.states.hover = this.states.hover;
        C.front.states.click = this.states.click;
        C.front.states.drag = this.states.drag;
        C.front.states.collide.can = false;
        C.front.set_role({ major: this, role_type: 'Glued', draw_major: this });
      }
    }
    if (_center) {
      if (_center.set) {
        if (C.center) {
          C.center.atlas = G.ASSET_ATLAS[(_center.atlas ?? ((_center.set === 'Joker' || _center.consumeable || _center.set === 'Voucher') ? _center.set : null)) ?? 'centers'];
          C.center.set_sprite_pos(_center.pos);
        } else {
          const cc = this.config.center;
          let atlas: any, pos: any;
          if (_center.set === 'Joker' && !_center.unlocked && !this.params.bypass_discovery_center) {
            atlas = G.ASSET_ATLAS.Joker; pos = G.j_locked.pos;
          } else if (cc.set === 'Voucher' && !cc.unlocked && !this.params.bypass_discovery_center) {
            atlas = G.ASSET_ATLAS.Voucher; pos = G.v_locked.pos;
          } else if (cc.consumeable && cc.demo) {
            atlas = G.ASSET_ATLAS.Tarot; pos = G.c_locked.pos;
          } else if (!this.params.bypass_discovery_center && (_center.set === 'Edition' || _center.set === 'Joker' || _center.consumeable || _center.set === 'Voucher' || _center.set === 'Booster') && !_center.discovered) {
            atlas = G.ASSET_ATLAS[_center.atlas ?? _center.set];
            pos = (_center.set === 'Joker' && G.j_undiscovered.pos) || (_center.set === 'Edition' && G.j_undiscovered.pos) ||
              (_center.set === 'Tarot' && G.t_undiscovered.pos) || (_center.set === 'Planet' && G.p_undiscovered.pos) ||
              (_center.set === 'Spectral' && G.s_undiscovered.pos) || (_center.set === 'Voucher' && G.v_undiscovered.pos) ||
              (_center.set === 'Booster' && G.booster_undiscovered.pos);
          } else if (_center.set === 'Joker' || _center.consumeable || _center.set === 'Voucher') {
            atlas = G.ASSET_ATLAS[_center.set]; pos = cc.pos;
          } else {
            atlas = G.ASSET_ATLAS[_center.atlas ?? 'centers']; pos = _center.pos;
          }
          C.center = new Sprite(this.T.x, this.T.y, this.T.w, this.T.h, atlas, pos);
          C.center.states.hover = this.states.hover;
          C.center.states.click = this.states.click;
          C.center.states.drag = this.states.drag;
          C.center.states.collide.can = false;
          C.center.set_role({ major: this, role_type: 'Glued', draw_major: this });
        }
        if (_center.name === 'Half Joker' && (_center.discovered || this.bypass_discovery_center)) C.center.scale.y = C.center.scale.y / 1.7;
        if (_center.name === 'Photograph' && (_center.discovered || this.bypass_discovery_center)) C.center.scale.y = C.center.scale.y / 1.2;
        if (_center.name === 'Square Joker' && (_center.discovered || this.bypass_discovery_center)) C.center.scale.y = C.center.scale.x;
      }
      if (_center.soul_pos) {
        C.floating_sprite = new Sprite(this.T.x, this.T.y, this.T.w, this.T.h, G.ASSET_ATLAS.Joker, this.config.center.soul_pos);
        C.floating_sprite.role.draw_major = this;
        C.floating_sprite.states.hover.can = false;
        C.floating_sprite.states.click.can = false;
      }
      if (!C.back) {
        const back_pos = this.params.bypass_back ?? (this.playing_card && G.GAME?.[this.back] ? G.GAME[this.back].pos : G.P_CENTERS.b_red.pos);
        C.back = new Sprite(this.T.x, this.T.y, this.T.w, this.T.h, G.ASSET_ATLAS.centers, back_pos);
        C.back.states.hover = this.states.hover;
        C.back.states.click = this.states.click;
        C.back.states.drag = this.states.drag;
        C.back.states.collide.can = false;
        C.back.set_role({ major: this, role_type: 'Glued', draw_major: this });
      }
    }
  }

  set_ability(center: any, _initial?: boolean, delay_sprites?: boolean) {
    let W = this.T.w, H = this.T.h;
    this.config.center = center;
    this.sticker_run = null;
    for (const k of Object.keys(G.P_CENTERS)) if (center === G.P_CENTERS[k]) this.config.center_key = k;
    const shown = center.discovered || this.bypass_discovery_center;
    if (center.name === 'Half Joker' && shown) { H = H / 1.7; this.T.h = H; }
    if (center.name === 'Photograph' && shown) { H = H / 1.2; this.T.h = H; }
    if (center.name === 'Square Joker' && shown) { H = W; this.T.h = H; }
    if (center.name === 'Wee Joker' && shown) { H = H * 0.7; W = W * 0.7; this.T.h = H; this.T.w = W; }
    if (delay_sprites) {
      G.E_MANAGER.add_event(new Event({ func: () => { if (!this.REMOVED) this.set_sprites(center); return true; } }));
    } else {
      this.set_sprites(center);
    }
    const cfg = center.config ?? {};
    this.ability = {
      name: center.name,
      effect: center.effect,
      set: center.set,
      mult: cfg.mult ?? 0,
      h_mult: cfg.h_mult ?? 0,
      h_x_mult: cfg.h_x_mult ?? 0,
      h_dollars: cfg.h_dollars ?? 0,
      p_dollars: cfg.p_dollars ?? 0,
      t_mult: cfg.t_mult ?? 0,
      t_chips: cfg.t_chips ?? 0,
      x_mult: cfg.Xmult ?? 1,
      h_size: cfg.h_size ?? 0,
      d_size: cfg.d_size ?? 0,
      extra: copy_table(cfg.extra) ?? null,
      extra_value: 0,
      type: cfg.type ?? '',
      order: center.order ?? null,
      forced_selection: this.ability ? this.ability.forced_selection : null,
      perma_bonus: this.ability ? (this.ability.perma_bonus ?? 0) : 0,
    };
    this.ability.bonus = (this.ability.bonus ?? 0) + (cfg.bonus ?? 0);
    if (center.consumeable) this.ability.consumeable = cfg;
    if (this.ability.name === 'Invisible Joker') this.ability.invis_rounds = 0;
    if (this.ability.name === 'Caino') this.ability.caino_xmult = 1;
    if (this.ability.name === 'Yorick') this.ability.yorick_discards = this.ability.extra.discards;
    if (this.ability.name === 'Loyalty Card') { this.ability.burnt_hand = 0; this.ability.loyalty_remaining = this.ability.extra.every; }
    this.base_cost = center.cost ?? 1;
    this.ability.hands_played_at_create = G.GAME ? (G.GAME.hands_played ?? 0) : 0;
    this.label = center.label ?? this.config.card?.label ?? this.ability.set;
    if (this.ability.set === 'Joker' || this.ability.set === 'Edition' || this.ability.consumeable || this.ability.set === 'Voucher') this.label = this.ability.name;
    if (this.ability.set === 'Booster') { this.label = this.ability.name; this.mouse_damping = 1.5; }
  }

  set_cost() {
    this.extra_cost = 0 + (G.GAME?.inflation ?? 0);
    if (this.edition) {
      this.extra_cost += (this.edition.holo ? 3 : 0) + (this.edition.foil ? 2 : 0) + (this.edition.polychrome ? 5 : 0) + (this.edition.negative ? 5 : 0);
    }
    this.cost = Math.max(1, Math.floor((this.base_cost + this.extra_cost + 0.5) * (100 - (G.GAME?.discount_percent ?? 0)) / 100));
    if (this.ability.rental) this.cost = 1;
    this.sell_cost = Math.max(1, Math.floor(this.cost / 2)) + (this.ability.extra_value ?? 0);
    this.sell_cost_label = this.facing === 'back' ? '?' : this.sell_cost;
  }

  /** set_edition: the visual part (the edition's numbers come from the API) */
  set_edition(edition: any, immediate?: boolean, silent?: boolean) {
    this.edition = null;
    if (!edition) return;
    if (edition.holo) this.edition = { mult: G.P_CENTERS.e_holo.config.extra, holo: true, type: 'holo' };
    else if (edition.foil) this.edition = { chips: G.P_CENTERS.e_foil.config.extra, foil: true, type: 'foil' };
    else if (edition.polychrome) this.edition = { x_mult: G.P_CENTERS.e_polychrome.config.extra, polychrome: true, type: 'polychrome' };
    else if (edition.negative) this.edition = { negative: true, type: 'negative' };
    if (this.edition && !silent) {
      G.CONTROLLER.locks.edition = true;
      G.E_MANAGER.add_event(new Event({
        trigger: 'after', delay: !immediate ? 0.2 : 0, blockable: !immediate,
        func: () => {
          this.juice_up(1, 0.5);
          if (this.edition?.foil) play_sound('foil1', 1.2, 0.4);
          if (this.edition?.holo) play_sound('holo1', 1.2 * 1.58, 0.4);
          if (this.edition?.polychrome) play_sound('polychrome1', 1.2, 0.7);
          if (this.edition?.negative) play_sound('negative', 1.5, 0.4);
          return true;
        },
      }));
      G.E_MANAGER.add_event(new Event({ trigger: 'after', delay: 0.1, func: () => { G.CONTROLLER.locks.edition = false; return true; } }));
    }
  }

  set_seal(_seal: string | null | undefined, silent?: boolean, immediate?: boolean) {
    this.seal = null;
    if (_seal) {
      this.seal = _seal;
      if (!silent) {
        G.CONTROLLER.locks.seal = true;
        if (immediate) {
          this.juice_up(0.3, 0.3);
          play_sound('gold_seal', 1.2, 0.4);
          G.CONTROLLER.locks.seal = false;
        } else {
          G.E_MANAGER.add_event(new Event({ trigger: 'after', delay: 0.3, func: () => { this.juice_up(0.3, 0.3); play_sound('gold_seal', 1.2, 0.4); return true; } }));
          G.E_MANAGER.add_event(new Event({ trigger: 'after', delay: 0.15, func: () => { G.CONTROLLER.locks.seal = false; return true; } }));
        }
      }
    }
  }

  get_seal(bypass_debuff?: boolean) {
    if (this.debuff && !bypass_debuff) return null;
    return this.seal;
  }

  remove_UI() {
    this.ability_UIBox_table = null;
    this.config.h_popup = null;
    this.config.h_popup_config = null;
    this.no_ui = true;
  }

  generate_UIBox_ability_table() {
    return generate_UIBox_ability_table(this);
  }

  get_nominal(mod?: string) {
    let mult = 1;
    if (mod === 'suit') mult = 1000;
    if (this.ability.effect === 'Stone Card') mult = -1000;
    return this.base.nominal + this.base.suit_nominal * mult + (this.base.suit_nominal_original ?? 0) * 0.0001 * mult + this.base.face_nominal + 0.000001 * this.unique_val;
  }

  get_id() {
    if (this.ability.effect === 'Stone Card' && !this.vampired) return -math_random(100, 1000000);
    return this.base.id;
  }

  is_face(from_boss?: boolean) {
    if (this.debuff && !from_boss) return false;
    const id = this.get_id();
    return id === 11 || id === 12 || id === 13 || (G.jokers?.cards ?? []).some((j: any) => j.ability.name === 'Pareidolia' && !j.debuff);
  }

  is_suit(suit: string, bypass_debuff?: boolean, flush_calc?: boolean) {
    const smeared = (G.jokers?.cards ?? []).some((j: any) => j.ability.name === 'Smeared Joker' && !j.debuff);
    const red = (s: string) => s === 'Hearts' || s === 'Diamonds';
    if (flush_calc) {
      if (this.ability.effect === 'Stone Card') return false;
      if (this.ability.name === 'Wild Card' && !this.debuff) return true;
      if (smeared && red(this.base.suit) === red(suit)) return true;
      return this.base.suit === suit;
    }
    if (this.debuff && !bypass_debuff) return false;
    if (this.ability.effect === 'Stone Card') return false;
    if (this.ability.name === 'Wild Card') return true;
    if (smeared && red(this.base.suit) === red(suit)) return true;
    return this.base.suit === suit;
  }

  explode(dissolve_colours?: any[], explode_time_fac?: number) {
    const explode_time = 1.3 * (explode_time_fac ?? 1) * Math.sqrt(G.SETTINGS.GAMESPEED);
    this.dissolve = 0;
    this.dissolve_colours = dissolve_colours ?? [G.C.WHITE];
    const start_time = G.TIMERS.TOTAL;
    play_sound('explosion_buildup1');
    this.juice = { scale: 0, r: 0, handled_elsewhere: true, start_time, end_time: start_time + explode_time };
    const childParts1 = new Particles(0, 0, 0, 0, {
      timer_type: 'TOTAL', timer: 0.01 * explode_time, scale: 0.2, speed: 2, lifespan: 0.2 * explode_time, attach: this,
      colours: this.dissolve_colours, fill: true,
    });
    let childParts2: any = null;
    G.E_MANAGER.add_event(new Event({
      blockable: false,
      func: () => {
        if (this.juice) {
          const percent = (G.TIMERS.TOTAL - start_time) / explode_time;
          this.juice.r = 0.05 * (Math.sin(5 * G.TIMERS.TOTAL) + Math.cos(0.33 + 41.15332 * G.TIMERS.TOTAL) + Math.cos(67.12 * G.TIMERS.TOTAL)) * percent;
          this.juice.scale = percent * 0.15;
        }
        return G.TIMERS.TOTAL - start_time > 1.5 * explode_time;
      },
    }));
    G.E_MANAGER.add_event(new Event({ trigger: 'ease', blockable: false, ref_table: this, ref_value: 'dissolve', ease_to: 0.3, delay: 0.9 * explode_time, func: (t: number) => t }));
    G.E_MANAGER.add_event(new Event({
      trigger: 'after', blockable: false, delay: 0.9 * explode_time,
      func: () => {
        childParts2 = new Particles(0, 0, 0, 0, {
          timer_type: 'TOTAL', pulse_max: 30, timer: 0.003, scale: 0.6, speed: 15, lifespan: 0.5, attach: this, colours: this.dissolve_colours,
        });
        childParts2.set_role({ r_bond: 'Weak' });
        G.E_MANAGER.add_event(new Event({ trigger: 'ease', blockable: false, ref_table: this, ref_value: 'dissolve', ease_to: 1, delay: 0.1 * explode_time, func: (t: number) => t }));
        this.juice_up();
        G.VIBRATION += 1;
        play_sound('explosion_release1');
        childParts1.fade(0.3 * explode_time);
        return true;
      },
    }));
    G.E_MANAGER.add_event(new Event({
      trigger: 'after', blockable: false, delay: 1.4 * explode_time,
      func: () => {
        G.E_MANAGER.add_event(new Event({ trigger: 'ease', blockable: false, blocking: false, ref_value: 'scale', ref_table: childParts2, ease_to: 0, delay: 0.1 * explode_time }));
        return true;
      },
    }));
    G.E_MANAGER.add_event(new Event({ trigger: 'after', blockable: false, delay: 1.5 * explode_time, func: () => { this.remove(); return true; } }));
  }

  shatter() {
    const dissolve_time = 0.7;
    this.shattered = true;
    this.dissolve = 0;
    this.dissolve_colours = [[1, 1, 1, 0.8]];
    this.juice_up();
    const childParts = new Particles(0, 0, 0, 0, {
      timer_type: 'TOTAL', timer: 0.007 * dissolve_time, scale: 0.3, speed: 4, lifespan: 0.5 * dissolve_time, attach: this,
      colours: this.dissolve_colours, fill: true,
    });
    G.E_MANAGER.add_event(new Event({ trigger: 'after', blockable: false, delay: 0.5 * dissolve_time, func: () => { childParts.fade(0.15 * dissolve_time); return true; } }));
    G.E_MANAGER.add_event(new Event({
      blockable: false,
      func: () => {
        play_sound('glass' + math_random(1, 6), Math.random() * 0.2 + 0.9, 0.5);
        play_sound('generic1', Math.random() * 0.2 + 0.9, 0.5);
        return true;
      },
    }));
    G.E_MANAGER.add_event(new Event({ trigger: 'ease', blockable: false, ref_table: this, ref_value: 'dissolve', ease_to: 1, delay: 0.5 * dissolve_time, func: (t: number) => t }));
    G.E_MANAGER.add_event(new Event({ trigger: 'after', blockable: false, delay: 0.55 * dissolve_time, func: () => { this.remove(); return true; } }));
    G.E_MANAGER.add_event(new Event({ trigger: 'after', blockable: false, delay: 0.51 * dissolve_time }));
  }

  start_dissolve(dissolve_colours?: any[], silent?: boolean, dissolve_time_fac?: number, no_juice?: boolean) {
    const dissolve_time = 0.7 * (dissolve_time_fac ?? 1);
    this.dissolve = 0;
    this.dissolve_colours = dissolve_colours ?? [G.C.BLACK, G.C.ORANGE, G.C.RED, G.C.GOLD, G.C.JOKER_GREY];
    if (!no_juice) this.juice_up();
    const childParts = new Particles(0, 0, 0, 0, {
      timer_type: 'TOTAL', timer: 0.01 * dissolve_time, scale: 0.1, speed: 2, lifespan: 0.7 * dissolve_time, attach: this,
      colours: this.dissolve_colours, fill: true,
    });
    G.E_MANAGER.add_event(new Event({ trigger: 'after', blockable: false, delay: 0.7 * dissolve_time, func: () => { childParts.fade(0.3 * dissolve_time); return true; } }));
    if (!silent) {
      G.E_MANAGER.add_event(new Event({
        blockable: false,
        func: () => {
          play_sound('whoosh2', Math.random() * 0.2 + 0.9, 0.5);
          play_sound('crumple' + math_random(1, 5), Math.random() * 0.2 + 0.9, 0.5);
          return true;
        },
      }));
    }
    G.E_MANAGER.add_event(new Event({ trigger: 'ease', blockable: false, ref_table: this, ref_value: 'dissolve', ease_to: 1, delay: dissolve_time, func: (t: number) => t }));
    G.E_MANAGER.add_event(new Event({ trigger: 'after', blockable: false, delay: 1.05 * dissolve_time, func: () => { this.remove(); return true; } }));
    G.E_MANAGER.add_event(new Event({ trigger: 'after', blockable: false, delay: 1.051 * dissolve_time }));
  }

  start_materialize(dissolve_colours?: any[], silent?: boolean, timefac?: number) {
    const dissolve_time = 0.6 * (timefac ?? 1);
    this.states.visible = true;
    this.states.hover.can = false;
    this.dissolve = 1;
    this.dissolve_colours = dissolve_colours ??
      ((this.ability.set === 'Joker' && [G.C.RARITY[this.config.center.rarity]]) ||
        (this.ability.set === 'Planet' && [G.C.SECONDARY_SET.Planet]) ||
        (this.ability.set === 'Tarot' && [G.C.SECONDARY_SET.Tarot]) ||
        (this.ability.set === 'Spectral' && [G.C.SECONDARY_SET.Spectral]) ||
        (this.ability.set === 'Booster' && [G.C.BOOSTER]) ||
        (this.ability.set === 'Voucher' && [G.C.SECONDARY_SET.Voucher, G.C.CLEAR]) ||
        [G.C.GREEN]);
    this.juice_up();
    this.children.particles = new Particles(0, 0, 0, 0, {
      timer_type: 'TOTAL', timer: 0.025 * dissolve_time, scale: 0.25, speed: 3, lifespan: 0.7 * dissolve_time, attach: this,
      colours: this.dissolve_colours, fill: true,
    });
    if (!silent) {
      if (!G.last_materialized || G.last_materialized + 0.01 < G.TIMERS.REAL || G.last_materialized > G.TIMERS.REAL) {
        G.last_materialized = G.TIMERS.REAL;
        G.E_MANAGER.add_event(new Event({
          blockable: false,
          func: () => {
            play_sound('whoosh1', Math.random() * 0.1 + 0.6, 0.3);
            play_sound('crumple' + math_random(1, 5), Math.random() * 0.2 + 1.2, 0.8);
            return true;
          },
        }));
      }
    }
    G.E_MANAGER.add_event(new Event({ trigger: 'after', blockable: false, delay: 0.5 * dissolve_time, func: () => { if (this.children.particles) this.children.particles.max = 0; return true; } }));
    G.E_MANAGER.add_event(new Event({ trigger: 'ease', blockable: false, ref_table: this, ref_value: 'dissolve', ease_to: 0, delay: dissolve_time, func: (t: number) => t }));
    G.E_MANAGER.add_event(new Event({
      trigger: 'after', blockable: false, delay: 1.05 * dissolve_time,
      func: () => {
        this.states.hover.can = true;
        if (this.children.particles) { this.children.particles.remove(); delete this.children.particles; }
        return true;
      },
    }));
  }

  set_card_area(area: any) {
    this.area = area;
    this.parent = area;
    this.layered_parallax = area.layered_parallax;
  }

  remove_from_area() {
    this.area = null;
    this.parent = null;
    this.layered_parallax = { x: 0, y: 0 };
  }

  align() {
    if (this.children.floating_sprite) {
      this.children.floating_sprite.T.y = this.T.y;
      this.children.floating_sprite.T.x = this.T.x;
      this.children.floating_sprite.T.r = this.T.r;
    }
    if (this.children.focused_ui) this.children.focused_ui.set_alignment();
  }

  flip() {
    if (this.facing === 'front') {
      this.flipping = 'f2b';
      this.facing = 'back';
      this.pinch.x = true;
    } else if (this.facing === 'back') {
      this.ability.wheel_flipped = null;
      this.flipping = 'b2f';
      this.facing = 'front';
      this.pinch.x = true;
    }
  }

  update(_dt: number) {
    if (this.flipping === 'f2b' && this.VT.w <= 0) { this.sprite_facing = 'back'; this.pinch.x = false; }
    if (this.flipping === 'b2f' && this.VT.w <= 0) { this.sprite_facing = 'front'; this.pinch.x = false; }
    if (!this.states.focus.is && this.children.focused_ui) { this.children.focused_ui.remove(); delete this.children.focused_ui; }
    this.update_alert();
    if (this.ability.set === 'Joker' && !this.sticker_run) this.sticker_run = 'NONE';
    if (this.ability.consumeable && this.ability.consumeable.max_highlighted) {
      this.ability.consumeable.mod_num = Math.min(5, this.ability.consumeable.max_highlighted);
    }
    if (G.STAGE === G.STAGES.RUN) {
      if (this.ability && this.ability.perma_debuff) this.debuff = true;
      if (this.area && (this.area === G.jokers || this.area === G.consumeables)) {
        this.bypass_lock = true;
        this.bypass_discovery_center = true;
        this.bypass_discovery_ui = true;
      }
      this.sell_cost_label = this.facing === 'back' ? '?' : this.sell_cost;
      const name = this.ability.name;
      if (name === 'Temperance') {
        let money = 0;
        for (const j of G.jokers?.cards ?? []) if (j.ability.set === 'Joker') money += j.sell_cost;
        this.ability.money = Math.min(money, this.ability.extra);
      }
      const pcs: any[] = G.playing_cards ?? [];
      if (name === "Driver's License") this.ability.driver_tally = pcs.filter((v) => v.config.center !== G.P_CENTERS.c_base).length;
      if (name === 'Steel Joker') this.ability.steel_tally = pcs.filter((v) => v.config.center === G.P_CENTERS.m_steel).length;
      if (name === 'Cloud 9') this.ability.nine_tally = pcs.filter((v) => v.get_id() === 9).length;
      if (name === 'Stone Joker') this.ability.stone_tally = pcs.filter((v) => v.config.center === G.P_CENTERS.m_stone).length;
      if (name === 'Blueprint' || name === 'Brainstorm') {
        const js: any[] = G.jokers?.cards ?? [];
        let other: any = null;
        if (name === 'Brainstorm') other = js[0];
        else { const i = js.indexOf(this); if (i >= 0) other = js[i + 1]; }
        this.ability.blueprint_compat = (other && other !== this && other.config.center.blueprint_compat) ? 'compatible' : 'incompatible';
      }
    } else if (this.ability.name === 'Temperance') {
      this.ability.money = 0;
    }
  }

  hard_set_T(X?: number, Y?: number, W?: number, H?: number) {
    const x = X ?? this.T.x, y = Y ?? this.T.y, w = W ?? this.T.w, h = H ?? this.T.h;
    super.hard_set_T(x, y, w, h);
    if (this.children.front) this.children.front.hard_set_T(x, y, w, h);
    this.children.back.hard_set_T(x, y, w, h);
    this.children.center.hard_set_T(x, y, w, h);
  }

  move(dt: number) {
    super.move(dt);
    if (this.children.h_popup) this.children.h_popup.set_alignment(this.align_h_popup());
  }

  align_h_popup() {
    const focused_ui = !!this.children.focused_ui;
    const popup_direction = (this.children.buy_button || (this.area && this.area.config.view_deck) || (this.area && this.area.config.type === 'shop')) ? 'cl'
      : (this.T.y < G.CARD_H * 0.8) ? 'bm' : 'tm';
    return {
      major: this.children.focused_ui ?? this,
      parent: this,
      xy_bond: 'Strong',
      r_bond: 'Weak',
      wh_bond: 'Weak',
      offset: {
        x: popup_direction !== 'cl' ? 0 : focused_ui ? -0.05 : this.ability.consumeable ? 0.0 : this.ability.set === 'Voucher' ? 0.0 : -0.05,
        y: focused_ui
          ? (popup_direction === 'tm' ? (this.area && this.area === G.hand ? -0.08 : -0.15) : popup_direction === 'bm' ? 0.12 : 0)
          : popup_direction === 'tm' ? -0.13 : popup_direction === 'bm' ? 0.1 : 0,
      },
      type: popup_direction,
    };
  }

  hover() {
    this.juice_up(0.05, 0.03);
    play_sound('paper1', Math.random() * 0.2 + 0.9, 0.35);
    if (this.facing === 'front' && (!this.states.drag.is || G.CONTROLLER.HID.touch) && !this.no_ui && !G.debug_tooltip_toggle) {
      this.ability_UIBox_table = this.generate_UIBox_ability_table();
      this.config.h_popup = card_h_popup(this);
      this.config.h_popup_config = this.align_h_popup();
      Node.prototype.hover.call(this);
    }
  }

  stop_hover() {
    Node.prototype.stop_hover.call(this);
  }

  juice_up(scale?: number, rot_amount?: number) {
    const rot_amt = rot_amount ? 0.4 * (Math.random() > 0.5 ? 1 : -1) * rot_amount : (Math.random() > 0.5 ? 1 : -1) * 0.16;
    scale = scale ? scale * 0.4 : 0.11;
    super.juice_up(scale, rot_amt);
  }

  draw(layer: 'shadow' | 'card' | 'both' = 'both') {
    this.hover_tilt = 1;
    if (!this.states.visible) return;
    const C = this.children;
    this.ARGS.send_to_shader = this.ARGS.send_to_shader ?? [];
    const send = this.ARGS.send_to_shader;
    if (layer === 'shadow' || layer === 'both') {
      send[0] = Math.min(this.VT.r * 3, 1) + G.TIMERS.REAL / 28 + (this.juice ? this.juice.r * 20 : 0) + this.tilt_var.amt;
      send[1] = G.TIMERS.REAL;
      each(C, (v) => { v.VT.scale = this.VT.scale; });
    }
    G.shared_shadow = this.sprite_facing === 'front' ? C.center : C.back;
    if (!this.no_shadow && G.SETTINGS.GRAPHICS.shadows === 'On' && (layer === 'shadow' || layer === 'both') &&
      (this.ability.effect !== 'Glass Card' && !this.greyed) &&
      ((this.area && this.area !== G.discard && this.area.config.type !== 'deck') || !this.area || this.states.drag.is)) {
      this.shadow_height = (((this.highlighted && this.area === G.play) || this.states.drag.is) ? 0.35 : (this.area && this.area.config.type === 'title_2') ? 0.04 : 0.1);
      G.shared_shadow.draw_shader('dissolve', this.shadow_height);
    }
    if ((layer === 'card' || layer === 'both') && this.area !== G.hand) {
      if (C.focused_ui) C.focused_ui.draw();
    }
    if (layer === 'card' || layer === 'both') {
      const tilt_factor = 0.3;
      if (this.states.focus.is) {
        this.tilt_var.mx = G.CONTROLLER.cursor_position.x + this.tilt_var.dx * this.T.w * G.TILESCALE * G.TILESIZE;
        this.tilt_var.my = G.CONTROLLER.cursor_position.y + this.tilt_var.dy * this.T.h * G.TILESCALE * G.TILESIZE;
        this.tilt_var.amt = Math.abs(this.hover_offset.y + this.hover_offset.x - 1 + this.tilt_var.dx + this.tilt_var.dy - 1) * tilt_factor;
      } else if (this.states.hover.is) {
        this.tilt_var.mx = G.CONTROLLER.cursor_position.x;
        this.tilt_var.my = G.CONTROLLER.cursor_position.y;
        this.tilt_var.amt = Math.abs(this.hover_offset.y + this.hover_offset.x - 1) * tilt_factor;
      } else if (this.ambient_tilt !== undefined && this.ambient_tilt !== null) {
        const tilt_angle = G.TIMERS.REAL * (1.56 + (this.ID / 1.14212) % 1) + this.ID / 1.35122;
        this.tilt_var.mx = ((0.5 + 0.5 * this.ambient_tilt * Math.cos(tilt_angle)) * this.VT.w + this.VT.x + G.ROOM.T.x) * G.TILESIZE * G.TILESCALE;
        this.tilt_var.my = ((0.5 + 0.5 * this.ambient_tilt * Math.sin(tilt_angle)) * this.VT.h + this.VT.y + G.ROOM.T.y) * G.TILESIZE * G.TILESCALE;
        this.tilt_var.amt = this.ambient_tilt * (0.5 + Math.cos(tilt_angle)) * tilt_factor;
      }
      if (C.particles) C.particles.draw();
      if (C.price) C.price.draw();
      if (C.buy_button) {
        if (this.highlighted) {
          C.buy_button.states.visible = true;
          C.buy_button.draw();
          if (C.buy_and_use_button) C.buy_and_use_button.draw();
        } else {
          C.buy_button.states.visible = false;
        }
      }
      if (C.use_button && this.highlighted) C.use_button.draw();

      const shown = this.config.center.discovered || this.bypass_discovery_center;
      const stone = this.ability.effect === 'Stone Card';
      if (this.vortex) {
        if (this.facing === 'back') C.back.draw_shader('vortex');
        else {
          C.center.draw_shader('vortex');
          if (C.front) C.front.draw_shader('vortex');
        }
        love.graphics.setShader();
      } else if (this.sprite_facing === 'front') {
        if ((this.edition && this.edition.negative) || (this.ability.name === 'Antimatter' && shown)) {
          C.center.draw_shader('negative', null, send);
          if (C.front && !stone) C.front.draw_shader('negative', null, send);
        } else if (!this.greyed) {
          C.center.draw_shader('dissolve');
          if (C.front && !stone) C.front.draw_shader('dissolve');
        }
        if (!this.config.center.discovered && (this.ability.consumeable || this.config.center.unlocked) && !this.config.center.demo && !this.bypass_discovery_center) {
          const shared = (this.ability.set === 'Edition' || this.ability.set === 'Joker') ? G.shared_undiscovered_joker : G.shared_undiscovered_tarot;
          const scale_mod = -0.05 + 0.05 * Math.sin(1.8 * G.TIMERS.REAL);
          const rotate_mod = 0.03 * Math.sin(1.219 * G.TIMERS.REAL);
          shared.role.draw_major = this;
          shared.draw_shader('dissolve', null, null, null, C.center, scale_mod, rotate_mod);
        }
        if (this.ability.name === 'Invisible Joker' && shown) C.center.draw_shader('voucher', null, send);
        if (this.edition || this.seal || this.ability.eternal || this.ability.rental || this.ability.perishable || this.sticker ||
          (this.sticker_run && this.sticker_run !== 'NONE' && G.SETTINGS.run_stake_stickers) || this.ability.set === 'Spectral' ||
          this.debuff || this.greyed || this.ability.name === 'The Soul' || this.ability.set === 'Voucher' || this.ability.set === 'Booster' ||
          this.config.center.soul_pos || this.config.center.demo) {
          if ((this.ability.set === 'Voucher' || this.config.center.demo) && (this.ability.name !== 'Antimatter' || !shown)) C.center.draw_shader('voucher', null, send);
          if (this.ability.set === 'Booster' || this.ability.set === 'Spectral') C.center.draw_shader('booster', null, send);
          if (this.edition && this.edition.holo) {
            C.center.draw_shader('holo', null, send);
            if (C.front && !stone) C.front.draw_shader('holo', null, send);
          }
          if (this.edition && this.edition.foil) {
            C.center.draw_shader('foil', null, send);
            if (C.front && !stone) C.front.draw_shader('foil', null, send);
          }
          if (this.edition && this.edition.polychrome) {
            C.center.draw_shader('polychrome', null, send);
            if (C.front && !stone) C.front.draw_shader('polychrome', null, send);
          }
          if ((this.edition && this.edition.negative) || (this.ability.name === 'Antimatter' && shown)) C.center.draw_shader('negative_shine', null, send);
          if (this.seal) {
            const s = G.shared_seals[this.seal];
            s.role.draw_major = this;
            s.draw_shader('dissolve', null, null, null, C.center);
            if (this.seal === 'Gold') s.draw_shader('voucher', null, send, null, C.center);
          }
          const sticker = (spr: any) => {
            spr.role.draw_major = this;
            spr.draw_shader('dissolve', null, null, null, C.center);
            spr.draw_shader('voucher', null, send, null, C.center);
          };
          if (this.ability.eternal) sticker(G.shared_sticker_eternal);
          if (this.ability.perishable) sticker(G.shared_sticker_perishable);
          if (this.ability.rental) sticker(G.shared_sticker_rental);
          if (this.sticker && G.shared_stickers[this.sticker]) sticker(G.shared_stickers[this.sticker]);
          else if (this.sticker_run && G.shared_stickers[this.sticker_run] && G.SETTINGS.run_stake_stickers) sticker(G.shared_stickers[this.sticker_run]);
          if (this.ability.name === 'The Soul' && shown) {
            const T = G.TIMERS.REAL, frac = T - Math.floor(T);
            const scale_mod = 0.05 + 0.05 * Math.sin(1.8 * T) + 0.07 * Math.sin(frac * Math.PI * 14) * (1 - frac) ** 3;
            const rotate_mod = 0.1 * Math.sin(1.219 * T) + 0.07 * Math.sin(T * Math.PI * 5) * (1 - frac) ** 2;
            G.shared_soul.role.draw_major = this;
            G.shared_soul.draw_shader('dissolve', 0, null, null, C.center, scale_mod, rotate_mod, null, 0.1 + 0.03 * Math.sin(1.8 * T), null, 0.6);
            G.shared_soul.draw_shader('dissolve', null, null, null, C.center, scale_mod, rotate_mod);
          }
          if (this.config.center.soul_pos && shown) {
            const T = G.TIMERS.REAL;
            const scale_mod = 0.07 + 0.02 * Math.sin(1.8 * T);
            const rotate_mod = 0.05 * Math.sin(1.219 * T);
            if (this.ability.name === 'Hologram') {
              this.hover_tilt = this.hover_tilt * 1.5;
              C.floating_sprite.draw_shader('hologram', null, send, null, C.center, 2 * scale_mod, 2 * rotate_mod);
              this.hover_tilt = this.hover_tilt / 1.5;
            } else {
              C.floating_sprite.draw_shader('dissolve', 0, null, null, C.center, scale_mod, rotate_mod, null, 0.1 + 0.03 * Math.sin(1.8 * T), null, 0.6);
              C.floating_sprite.draw_shader('dissolve', null, null, null, C.center, scale_mod, rotate_mod);
            }
          }
          if (this.debuff) {
            C.center.draw_shader('debuff', null, send);
            if (C.front && !stone) C.front.draw_shader('debuff', null, send);
          }
          if (this.greyed) {
            C.center.draw_shader('played', null, send);
            if (C.front && !stone) C.front.draw_shader('played', null, send);
          }
        }
      } else if (this.sprite_facing === 'back') {
        let overlay = G.C.WHITE;
        if (this.area && this.area.config.type === 'deck' && this.rank! > 3) {
          this.back_overlay = this.back_overlay ?? [];
          const v = 0.5 + ((this.area.cards.length - this.rank!) % 7) / 50;
          this.back_overlay[0] = v; this.back_overlay[1] = v; this.back_overlay[2] = v; this.back_overlay[3] = 1;
          overlay = this.back_overlay;
        }
        if (this.area && this.area.config.type === 'deck') C.back.draw(overlay);
        else C.back.draw_shader('dissolve');
        if (this.sticker && G.shared_stickers[this.sticker]) {
          const s = G.shared_stickers[this.sticker];
          s.role.draw_major = this;
          s.draw_shader('dissolve', null, null, true, C.center);
          if (this.sticker === 'Gold') s.draw_shader('voucher', null, send, true, C.center);
        }
      }
      const skip = new Set(['focused_ui', 'front', 'back', 'soul_parts', 'center', 'floating_sprite', 'shadow', 'use_button', 'buy_button', 'buy_and_use_button', 'debuff', 'price', 'particles', 'h_popup']);
      each(C, (v, k) => { if (!skip.has(k)) v.draw(); });
      if ((layer === 'card' || layer === 'both') && this.area === G.hand && C.focused_ui) C.focused_ui.draw();
      add_to_drawhash(this);
      this.draw_boundingrect();
    }
  }

  /** the game reorders an area by position while a card is dragged; the new
   *  order is sent to the API when the drag ends (G.FUNCS.card_drag_ended) */
  stop_drag() {
    super.stop_drag();
    G.FUNCS.card_drag_ended?.(this);
  }

  release(dragged: any) {
    if (dragged instanceof Card && this.area) this.area.release(dragged);
  }

  highlight(is_highlighted: boolean) {
    this.highlighted = is_highlighted;
    if (this.ability.consumeable || this.ability.set === 'Joker' || (this.area && this.area === G.pack_cards)) {
      if (this.highlighted && this.area && this.area.config.type !== 'shop') {
        const x_off = this.ability.consumeable ? -0.1 : 0;
        const side = this.area === G.jokers || this.area === G.consumeables;
        this.children.use_button = new UIBox({
          definition: G.UIDEF.use_and_sell_buttons(this),
          config: { align: side ? 'cr' : 'bmi', offset: side ? { x: x_off - 0.4, y: 0 } : { x: 0, y: 0.65 }, parent: this },
        });
      } else if (this.children.use_button) {
        this.children.use_button.remove();
        delete this.children.use_button;
      }
    }
    if (this.ability.consumeable || this.ability.set === 'Joker') {
      if (!this.highlighted && this.area && this.area.config.type === 'joker' &&
        (G.jokers.cards.length >= G.jokers.config.card_limit || (this.edition && this.edition.negative))) {
        if (G.shop_jokers) G.shop_jokers.unhighlight_all();
      }
    }
  }

  click() {
    if (this.area && this.area.can_highlight(this)) {
      if (this.area === G.hand && G.STATE === G.STATES.HAND_PLAYED) return;
      if (this.highlighted !== true) this.area.add_to_highlighted(this);
      else {
        this.area.remove_from_highlighted(this);
        play_sound('cardSlide2', undefined, 0.3);
      }
    }
    if (this.area && this.area === G.deck && this.area.cards[0] === this) G.FUNCS.deck_info();
  }

  remove() {
    this.removed = true;
    if (this.area) this.area.remove_card(this);
    if (G.playing_cards) {
      array_remove(G.playing_cards, this);
    }
    remove_all(this.children);
    array_remove(G.I.CARD, this);
    super.remove();
  }
}
