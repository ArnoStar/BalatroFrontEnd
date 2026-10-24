// blind.lua: the blind being played, as shown in the HUD (its animated chip,
// name, debuff text and colours). Its numbers come from the API's BlindView.
import {
  G, Moveable, Node, AnimatedSprite, Particles, Event, play_sound, add_to_drawhash, copy_table, mix_colours, darken, lighten,
  ease_colour, number_format, each, math_random,
} from '@/shared/lib/engine';
import { localize } from '@/shared/lib/localization';
import { attention_text } from '@/shared/ui';

/** get_blind_main_colour (misc_functions.lua) */
export function get_blind_main_colour(blind?: string) {
  let disabled = false;
  blind = blind ?? '';
  if (blind === 'Boss' || blind === 'Small' || blind === 'Big') {
    const st = G.GAME.round_resets.blind_states ?? {};
    if (st[blind] === 'Defeated' || st[blind] === 'Skipped') disabled = true;
    blind = G.GAME.round_resets.blind_choices[blind];
  }
  const b = blind ? G.P_BLINDS[blind] : null;
  if (disabled || !b) return G.C.BLACK;
  return b.boss_colour ?? (blind === 'bl_small' ? mix_colours(G.C.BLUE, G.C.BLACK, 0.6) : blind === 'bl_big' ? mix_colours(G.C.ORANGE, G.C.BLACK, 0.6) : null) ?? G.C.BLACK;
}

export class Blind extends Moveable {
  tilt_var!: any;
  ambient_tilt!: number;
  chips!: number;
  chip_text!: string;
  colour!: number[];
  dark_colour!: number[];
  loc_debuff_lines!: string[];
  loc_debuff_text?: string;
  loc_name?: string;
  name?: string;
  dollars!: number;
  sound_pings?: number;
  boss?: boolean;
  blind_set?: boolean;
  disabled?: boolean;
  block_play?: boolean;
  only_hand?: any;
  pos?: any;
  mult?: number;
  dissolve?: number | null;
  dissolve_colours?: any[];
  hovering?: boolean;
  hover_tilt?: number;

  constructor(X?: number, Y?: number, W?: number, H?: number) {
    super();
    if (X !== undefined) this.init_blind(X, Y!, W!, H!);
  }

  init_blind(X: number, Y: number, W: number, H: number) {
    this.init_moveable(X, Y, W, H);
    this.children = {};
    this.config = {};
    this.tilt_var = { mx: 0, my: 0, amt: 0 };
    this.ambient_tilt = 0.3;
    this.chips = 0;
    this.zoom = true;
    this.states.collide.can = true;
    this.colour = copy_table(G.C.BLACK);
    this.dark_colour = darken(this.colour, 0.2);
    const spr = new AnimatedSprite(this.T.x, this.T.y, this.T.w, this.T.h, G.ANIMATION_ATLAS.blind_chips, G.P_BLINDS.bl_small.pos);
    this.children.animatedSprite = spr;
    spr.states = this.states;
    spr.states.visible = false;
    spr.states.drag.can = true;
    this.states.collide.can = true;
    this.states.drag.can = true;
    this.loc_debuff_lines = ['', ''];
    this.shadow_height = 0;
    this.dollars = 0;
    if (Object.getPrototypeOf(this) === Blind.prototype) G.I.CARD.push(this);
  }

  change_colour(blind_col?: number[]) {
    blind_col = blind_col ?? get_blind_main_colour(this.config.blind?.key ?? '');
    let dark_col = mix_colours(blind_col, G.C.BLACK, 0.4);
    ease_colour(G.C.DYN_UI.MAIN, blind_col);
    ease_colour(G.C.DYN_UI.DARK, dark_col);
    if (!this.boss && this.name) {
      blind_col = darken(G.C.BLACK, 0.05);
      dark_col = lighten(G.C.BLACK, 0.07);
    } else {
      dark_col = mix_colours(blind_col, G.C.BLACK, 0.2);
    }
    ease_colour(G.C.DYN_UI.BOSS_MAIN, blind_col);
    ease_colour(G.C.DYN_UI.BOSS_DARK, dark_col);
  }

  set_text() {
    if (!this.config.blind) return;
    if (this.disabled) {
      this.loc_name = this.name === '' ? this.name : localize({ type: 'name_text', key: this.config.blind.key, set: 'Blind' });
      this.loc_debuff_text = '';
      this.loc_debuff_lines[0] = '';
      this.loc_debuff_lines[1] = '';
      return;
    }
    let loc_vars: any = null;
    if (this.name === 'The Ox') loc_vars = [localize(G.GAME.current_round.most_played_poker_hand, 'poker_hands')];
    const loc_target: string[] = localize({ type: 'raw_descriptions', key: this.config.blind.key, set: 'Blind', vars: loc_vars ?? this.config.blind.vars });
    if (loc_target && this.config.blind.key) {
      this.loc_name = this.name === '' ? this.name : localize({ type: 'name_text', key: this.config.blind.key, set: 'Blind' });
      this.loc_debuff_text = loc_target.map((v, k) => v + (k + 1 <= loc_target.length ? ' ' : '')).join('');
      this.loc_debuff_lines[0] = loc_target[0] ?? '';
      this.loc_debuff_lines[1] = loc_target[1] ?? '';
    } else {
      this.loc_name = '';
      this.loc_debuff_text = '';
      this.loc_debuff_lines[0] = '';
      this.loc_debuff_lines[1] = '';
    }
  }

  /**
   * Blind:set_blind. `blind` is a P_BLINDS entry (or null to clear); `chips`
   * and `dollars` are the API's numbers (the game computes them).
   */
  set_blind(blind: any, reset?: boolean, silent?: boolean, chips?: number, dollars?: number) {
    if (!reset) {
      this.config.blind = blind ?? {};
      this.name = blind ? blind.name : '';
      this.dollars = dollars ?? (blind ? blind.dollars : 0);
      this.sound_pings = (blind ? blind.dollars : 0) + 2;
      this.pos = blind?.pos;
      this.mult = blind ? blind.mult : 0;
      this.disabled = false;
      this.boss = !!(blind && blind.boss);
      this.blind_set = false;
      this.set_text();
      G.GAME.last_blind = G.GAME.last_blind ?? {};
      G.GAME.last_blind.boss = this.boss;
      G.GAME.last_blind.name = this.name;
      if (blind && blind.name) this.change_colour();
      else this.change_colour(G.C.BLACK);
      this.chips = blind ? (chips ?? 0) : 0;
      this.chip_text = number_format(this.chips);
      G.GAME.current_round.dollars_to_be_earned = this.dollars > 0 ? localize('$').repeat(this.dollars) : '';
      G.HUD_blind.alignment.offset.y = -10;
      G.HUD_blind.recalculate(false);
      if (blind && blind.name && blind.name !== '') {
        this.alert_debuff(true);
        G.E_MANAGER.add_event(new Event({
          trigger: 'after', delay: 0.05, blockable: false,
          func: () => {
            G.HUD_blind.get_UIE_by_ID('HUD_blind_name').states.visible = false;
            G.HUD_blind.get_UIE_by_ID('dollars_to_be_earned').parent.parent.states.visible = false;
            G.HUD_blind.alignment.offset.y = 0;
            G.E_MANAGER.add_event(new Event({
              trigger: 'after', delay: 0.15, blockable: false,
              func: () => {
                G.HUD_blind.get_UIE_by_ID('HUD_blind_name').states.visible = true;
                G.HUD_blind.get_UIE_by_ID('dollars_to_be_earned').parent.parent.states.visible = true;
                G.HUD_blind.get_UIE_by_ID('dollars_to_be_earned').config.object.pop_in(0);
                G.HUD_blind.get_UIE_by_ID('HUD_blind_name').config.object.pop_in(0);
                G.HUD_blind.get_UIE_by_ID('HUD_blind_count').juice_up();
                this.children.animatedSprite.set_sprite_pos(this.config.blind.pos);
                this.blind_set = true;
                G.ROOM.jiggle += 3;
                if (!reset && !silent) {
                  this.juice_up();
                  if (blind) {
                    play_sound('chips1', Math.random() * 0.1 + 0.55, 0.42);
                    play_sound('gold_seal', Math.random() * 0.1 + 1.85, 0.26);
                  }
                }
                return true;
              },
            }));
            return true;
          },
        }));
      }
      this.config.h_popup_config = { align: 'tm', offset: { x: 0, y: -0.1 }, parent: this };
    }
    if (G.ARGS.spin) {
      const b = this.config.blind?.boss;
      G.ARGS.spin.real = (G.SETTINGS.reduced_motion ? 0 : 1) * (b ? (b.showdown ? 0.5 : 0.25) : 0);
    }
  }

  alert_debuff(_first?: boolean) {
    if (this.loc_debuff_text && this.loc_debuff_text !== '') {
      this.block_play = true;
      G.E_MANAGER.add_event(new Event({
        blockable: false, blocking: false,
        func: () => {
          if (this.disabled) { this.block_play = false; return true; }
          if (G.STATE === G.STATES.SELECTING_HAND) {
            G.E_MANAGER.add_event(new Event({
              trigger: 'after', delay: G.SETTINGS.GAMESPEED * 0.05, blockable: false,
              func: () => {
                play_sound('whoosh1', 0.55, 0.62);
                for (let i = 1; i <= 4; i++) {
                  G.E_MANAGER.add_event(new Event({
                    blockable: false, trigger: 'after', delay: G.SETTINGS.GAMESPEED * 0.1 * (i - 1),
                    func: () => { if (i === 1) this.juice_up(); play_sound('cancel', 0.7 + 0.05 * i, 0.7); return true; },
                  }));
                }
                const hold_time = G.SETTINGS.GAMESPEED * (new TextEncoder().encode(this.loc_debuff_text!).length * 0.035 + 1.3);
                attention_text({ scale: 0.7, text: this.get_loc_debuff_text(), maxw: 12, hold: hold_time, align: 'cm', offset: { x: 0, y: -1 }, major: G.play });
                G.E_MANAGER.add_event(new Event({
                  trigger: 'after', delay: 1, blocking: false, blockable: false,
                  func: () => {
                    this.block_play = false;
                    const b = G.buttons?.get_UIE_by_ID('play_button');
                    if (b) b.disable_button = null;
                    return true;
                  },
                }));
                return true;
              },
            }));
            return true;
          }
          return false;
        },
      }));
    }
  }

  get_loc_debuff_text() {
    let disp = (this.config.blind.name === 'The Wheel' ? String(G.GAME.probabilities.normal) : '') + this.loc_debuff_text;
    if (this.config.blind.name === 'The Mouth' && this.only_hand) disp += ' [' + localize(this.only_hand, 'poker_hands') + ']';
    return disp;
  }

  defeat(silent?: boolean) {
    const dissolve_time = 1.3;
    this.dissolve = 0;
    this.dissolve_colours = [G.C.BLACK, G.C.RED];
    this.juice_up();
    this.children.particles = new Particles(0, 0, 0, 0, {
      timer_type: 'TOTAL', timer: 0.01 * dissolve_time, scale: 0.1, speed: 1.5, lifespan: 0.7 * dissolve_time, attach: this,
      colours: this.dissolve_colours, fill: true,
    });
    G.HUD_blind.get_UIE_by_ID('HUD_blind_name').config.object.pop_out(2);
    G.E_MANAGER.add_event(new Event({ trigger: 'after', blockable: false, delay: 0.5 * dissolve_time, func: () => { this.children.particles.max = 0; return true; } }));
    if (!silent) {
      const pings = this.sound_pings ?? 3;
      for (let i = 1; i <= Math.min(pings, 7); i++) {
        G.E_MANAGER.add_event(new Event({
          blockable: false, trigger: 'after', delay: (0.15 - 0.01 * pings) * i * dissolve_time,
          func: () => {
            play_sound('cancel', 0.8 - 0.05 * i, 1.7);
            if (i === Math.min(pings + 1, 6)) play_sound('whoosh2', 0.7, 0.42);
            return true;
          },
        }));
      }
    }
    G.E_MANAGER.add_event(new Event({ trigger: 'ease', blockable: false, ref_table: this, ref_value: 'dissolve', ease_to: 1, delay: 0.7 * dissolve_time, func: (t: number) => t }));
    G.E_MANAGER.add_event(new Event({ trigger: 'after', blockable: false, delay: 0.8 * dissolve_time, func: () => { G.HUD_blind.alignment.offset.y = -10; return true; } }));
    G.E_MANAGER.add_event(new Event({
      trigger: 'after', blockable: false, delay: 0.95 * dissolve_time,
      func: () => { this.dissolve = null; this.set_blind(null, false, true); return true; },
    }));
    for (const v of G.jokers?.cards ?? []) if (v.facing === 'back') v.flip();
  }

  /** Blind:drawn_to_hand's on-screen part (the debuff itself comes from the API) */
  drawn_to_hand() {
    if (this.disabled) return;
    if (this.name === 'Crimson Heart') {
      const debuffed = (G.jokers?.cards ?? []).find((j: any) => j.debuff);
      if (debuffed) { debuffed.juice_up(); this.wiggle(); }
    }
  }

  /** Blind:press_play's answer: does this blind act when a hand is played (The Hook, The Tooth)? */
  acts_on_play() {
    return !this.disabled && (this.name === 'The Hook' || this.name === 'The Tooth');
  }

  get_type() {
    if (this.name === 'Small Blind') return 'Small';
    if (this.name === 'Big Blind') return 'Big';
    if (this.name && this.name !== '') return 'Boss';
    return null;
  }

  /** the visual part of Blind:disable (Chicot, Luchador) */
  disable() {
    this.disabled = true;
    for (const v of G.jokers?.cards ?? []) if (v.facing === 'back') v.flip();
    this.set_text();
    this.wiggle();
  }

  wiggle() {
    this.children.animatedSprite.juice_up(0.3);
    G.E_MANAGER.add_event(new Event({ trigger: 'after', delay: 0.06 * G.SETTINGS.GAMESPEED, blockable: false, blocking: false, func: () => { play_sound('tarot2', 0.76, 0.4); return true; } }));
    play_sound('tarot2', 1, 0.4);
  }

  juice_up(a?: number, b?: number) {
    this.children.animatedSprite.juice_up(a ?? 0.2, b ?? 0.2);
  }

  hover() {
    if (!G.CONTROLLER.dragging.target || G.CONTROLLER.using_touch) {
      if (!this.hovering && this.states.visible && this.children.animatedSprite.states.visible) {
        this.hovering = true;
        this.hover_tilt = 2;
        this.children.animatedSprite.juice_up(0.05, 0.02);
        play_sound('chips1', Math.random() * 0.1 + 0.55, 0.12);
        Node.prototype.hover.call(this);
      }
    }
  }

  stop_hover() {
    this.hovering = false;
    this.hover_tilt = 0;
    Node.prototype.stop_hover.call(this);
  }

  draw() {
    if (!this.states.visible) return;
    this.tilt_var = this.tilt_var ?? {};
    this.tilt_var.mx = G.CONTROLLER.cursor_position.x;
    this.tilt_var.my = G.CONTROLLER.cursor_position.y;
    const spr = this.children.animatedSprite;
    spr.role.draw_major = this;
    spr.draw_shader('dissolve', 0.1);
    spr.draw_shader('dissolve');
    each(this.children, (v, k) => {
      if (k !== 'animatedSprite') { v.VT.scale = this.VT.scale; v.draw(); }
    });
    add_to_drawhash(this);
  }

  move(dt: number) {
    super.move(dt);
    this.align();
  }

  change_dim(w?: number, h?: number) {
    this.T.w = w ?? this.T.w;
    this.T.h = h ?? this.T.h;
    this.children.animatedSprite.T.w = w ?? this.T.w;
    this.children.animatedSprite.T.h = h ?? this.T.h;
    this.children.animatedSprite.rescale();
  }

  align() {
    each(this.children, (v, k) => {
      if (k === 'animatedSprite') {
        if (!v.states.drag.is) {
          v.T.r = 0.02 * Math.sin(2 * G.TIMERS.REAL + this.T.x);
          v.T.y = this.T.y + 0.03 * Math.sin(0.666 * G.TIMERS.REAL + this.T.x);
          this.shadow_height = 0.1 - (0.04 + 0.03 * Math.sin(0.666 * G.TIMERS.REAL + this.T.x));
          v.T.x = this.T.x + 0.03 * Math.sin(0.436 * G.TIMERS.REAL + this.T.x);
        }
      } else {
        v.T.x = this.T.x;
        v.T.y = this.T.y;
        v.T.r = this.T.r;
      }
    });
  }

  /** shows a blind already set (a run opened mid-round), as Blind:load does */
  show_set(blind: any, chips: number, dollars: number, disabled: boolean) {
    this.config.blind = blind ?? {};
    this.name = blind ? blind.name : '';
    this.dollars = dollars;
    this.pos = blind?.pos;
    this.boss = !!(blind && blind.boss);
    this.disabled = disabled;
    this.chips = chips;
    this.chip_text = number_format(chips);
    if (G.ARGS.spin) {
      const b = blind?.boss;
      G.ARGS.spin.real = (G.SETTINGS.reduced_motion ? 0 : 1) * (b ? (b.showdown ? 1 : 0.3) : 0);
    }
    const spr = this.children.animatedSprite;
    if (blind) {
      this.blind_set = true;
      spr.states.visible = true;
      spr.set_sprite_pos(blind.pos);
      spr.juice_up(0.3);
      this.align();
      spr.hard_set_VT();
    } else {
      spr.states.visible = false;
    }
    spr.states = this.states;
    this.change_colour();
    if (this.dollars > 0) {
      G.GAME.current_round.dollars_to_be_earned = localize('$').repeat(this.dollars);
      G.HUD_blind.get_UIE_by_ID('dollars_to_be_earned').config.object.pop_in(0);
      G.HUD_blind.alignment.offset.y = 0;
    }
    this.set_text();
  }
}

void math_random;
