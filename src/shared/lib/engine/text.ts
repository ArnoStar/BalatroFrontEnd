// engine/text.lua: DynaText, the animated text used all over the game.
import { G } from './globals';
import { love } from '../love';
import { Moveable } from './moveable';
import { add_to_drawhash, prep_draw, math_random } from './util';
import { tostring } from './format';
import { play_sound } from './sound';

export interface DynaTextConfig {
  [key: string]: any;
  string?: any;
  colours?: any[];
  scale?: number;
  shadow?: boolean;
  pop_in?: number;
  pop_in_rate?: number;
  bump_rate?: number;
  bump_amount?: number;
  font?: any;
  silent?: boolean;
  maxw?: number;
  float?: boolean;
  bump?: boolean;
  rotate?: number | boolean;
  spacing?: number;
}

const utf8chars = (s: string) => Array.from(s);
const byteLen = (s: string) => new TextEncoder().encode(s).length;

export class DynaText extends Moveable {
  shadow?: boolean;
  scale!: any;
  pop_in_rate!: number;
  bump_rate!: number;
  bump_amount!: number;
  font!: any;
  string!: any;
  text_offset!: { x: number; y: number };
  colours!: any[];
  created_time!: number;
  silent?: boolean;
  start_pop_in?: any;
  strings!: any[];
  focused_string!: number;
  pop_delay?: number;
  pop_out_time?: number;
  reset_pop_in?: boolean;
  pop_cycle?: boolean;
  ui_object_updated?: boolean;
  non_recalc?: boolean;

  constructor(config?: DynaTextConfig) {
    super();
    if (config) this.init_dynatext(config);
  }

  init_dynatext(config: DynaTextConfig) {
    this.config = config;
    this.shadow = config.shadow;
    this.scale = config.scale ?? 1;
    this.pop_in_rate = config.pop_in_rate ?? 3;
    this.bump_rate = config.bump_rate ?? 2.666;
    this.bump_amount = config.bump_amount ?? 1;
    this.font = config.font ?? G.LANG.font;
    if (config.string !== undefined && config.string !== null && !Array.isArray(config.string)) config.string = [config.string];
    this.string = (config.string && Array.isArray(config.string) && config.string[0]) || ['HELLO WORLD'];
    this.text_offset = {
      x: this.font.TEXT_OFFSET.x * this.scale + (config.x_offset ?? 0),
      y: this.font.TEXT_OFFSET.y * this.scale + (config.y_offset ?? 0),
    };
    this.colours = config.colours ?? [G.C.RED];
    this.created_time = G.TIMERS.REAL;
    this.silent = config.silent;
    this.start_pop_in = config.pop_in;
    config.W = 0;
    config.H = 0;
    this.strings = [];
    this.focused_string = 0;
    this.update_text(true);
    if (config.maxw && config.W > config.maxw) {
      this.start_pop_in = config.pop_in;
      this.scale = this.scale * (config.maxw / config.W);
      this.update_text(true);
    }
    if (this.strings.length > 1) {
      this.pop_delay = config.pop_delay ?? 1.5;
      this.pop_out(4);
    }
    this.init_moveable(config.X ?? 0, config.Y ?? 0, config.W, config.H);
    this.T.r = config.text_rot ?? 0;
    this.states.hover.can = false;
    this.states.click.can = false;
    this.states.collide.can = false;
    this.states.drag.can = false;
    this.states.release_on.can = false;
    this.set_role({ wh_bond: 'Weak', scale_bond: 'Weak' });
    if (Object.getPrototypeOf(this) === DynaText.prototype) G.I.MOVEABLE.push(this);
  }

  update(_dt: number) {
    this.update_text();
    this.align_letters();
  }

  update_text(first_pass?: boolean) {
    const cfg = this.config;
    cfg.W = 0;
    cfg.H = 0;
    const list: any[] = cfg.string;
    for (let k = 0; k < list.length; k++) {
      let v = list[k];
      if ((v !== null && typeof v === 'object' && v.ref_table) || first_pass) {
        let part_a = 0, part_b = 1000000;
        let new_string = v;
        let outer_colour = null, inner_colour = null, part_scale = 1;
        if (v !== null && typeof v === 'object' && (v.ref_table || v.string !== undefined)) {
          const val = v.ref_table ? v.ref_table[v.ref_value] : v.string;
          new_string = (v.prefix ?? '') + tostring(val ?? v.string) + (v.suffix ?? '');
          part_a = byteLen(v.prefix ?? '');
          part_b = byteLen(new_string) - byteLen(v.suffix ?? '');
          if (v.scale) part_scale = v.scale;
          if (first_pass) {
            outer_colour = v.outer_colour ?? null;
            inner_colour = v.colour ?? null;
          }
          v = new_string;
        }
        this.strings[k] = this.strings[k] ?? {};
        const old_string = this.strings[k].string;
        if (old_string !== new_string || first_pass) {
          if (this.start_pop_in) this.reset_pop_in = true;
          this.reset_pop_in = this.reset_pop_in || cfg.reset_pop_in;
          if (!this.reset_pop_in) {
            cfg.pop_out = null;
            cfg.pop_in = null;
          } else {
            cfg.pop_in = cfg.pop_in ?? 0;
            this.created_time = G.TIMERS.REAL;
          }
          this.strings[k].string = v;
          const old_letters = this.strings[k].letters;
          let tempW = 0, tempH = 0;
          let current_letter = 1;
          this.strings[k].letters = [];
          const F = this.font;
          for (const c of utf8chars(String(v))) {
            const old_letter = old_letters ? old_letters[current_letter - 1] : null;
            const let_tab: any = {
              letter: love.graphics.newText(F.FONT, c), char: c,
              scale: old_letter ? old_letter.scale : part_scale,
            };
            this.strings[k].letters[current_letter - 1] = let_tab;
            const tx = F.FONT.getWidth(c) * this.scale * part_scale * G.TILESCALE * F.FONTSCALE + 2.7 * (cfg.spacing ?? 0) * G.TILESCALE * F.FONTSCALE;
            const ty = F.FONT.getHeight() * this.scale * part_scale * G.TILESCALE * F.FONTSCALE * F.TEXT_HEIGHT_SCALE;
            let_tab.offset = old_letter ? old_letter.offset : { x: 0, y: 0 };
            let_tab.dims = { x: tx / (F.FONTSCALE * G.TILESCALE), y: ty / (F.FONTSCALE * G.TILESCALE) };
            let_tab.pop_in = first_pass ? (old_letter ? old_letter.pop_in : (cfg.pop_in !== undefined && cfg.pop_in !== null ? 0 : 1)) : 1;
            let_tab.prefix = current_letter <= part_a ? outer_colour : null;
            let_tab.suffix = current_letter > part_b ? outer_colour : null;
            let_tab.colour = inner_colour ?? null;
            if (k > 0) let_tab.pop_in = 0;
            tempW = tempW + tx / (G.TILESIZE * G.TILESCALE);
            tempH = Math.max(ty / (G.TILESIZE * G.TILESCALE), tempH);
            current_letter++;
          }
          this.strings[k].W = tempW;
          this.strings[k].H = tempH;
        }
      }
      if (this.strings[k].W > cfg.W) { cfg.W = this.strings[k].W; this.strings[k].W_offset = 0; }
      if (this.strings[k].H > cfg.H) { cfg.H = this.strings[k].H; this.strings[k].H_offset = 0; }
    }
    if (this.T) {
      if ((this.T.w !== cfg.W || this.T.h !== cfg.H) && (!first_pass || this.reset_pop_in)) {
        this.ui_object_updated = true;
        this.non_recalc = cfg.non_recalc;
      }
      this.T.w = cfg.W;
      this.T.h = cfg.H;
    }
    this.reset_pop_in = false;
    this.start_pop_in = false;
    for (const v of this.strings) {
      v.W_offset = 0.5 * (cfg.W - v.W);
      v.H_offset = 0.5 * (cfg.H - v.H + (cfg.offset_y ?? 0));
    }
  }

  pop_out(pop_out_timer?: number) {
    this.config.pop_out = pop_out_timer ?? 1;
    this.pop_out_time = G.TIMERS.REAL + (this.pop_delay ?? 0);
  }

  pop_in(pop_in_timer?: number) {
    this.reset_pop_in = true;
    this.config.pop_out = null;
    this.config.pop_in = pop_in_timer ?? 0;
    this.created_time = G.TIMERS.REAL;
    for (const letter of this.strings[this.focused_string].letters) letter.pop_in = 0;
    this.update_text();
  }

  align_letters() {
    const cfg = this.config;
    if (this.pop_cycle) {
      this.focused_string = cfg.random_element ? math_random(1, this.strings.length) - 1
        : (this.focused_string === this.strings.length - 1 ? 0 : this.focused_string + 1);
      this.pop_cycle = false;
      for (const letter of this.strings[this.focused_string].letters) letter.pop_in = 0;
      cfg.pop_in = 0.1;
      cfg.pop_out = null;
      this.created_time = G.TIMERS.REAL;
    }
    const str = this.strings[this.focused_string];
    this.string = str.string;
    const letters = str.letters;
    const nlet = letters.length;
    const slen = byteLen(String(this.string));
    const rm = G.SETTINGS.reduced_motion ? 0 : 1;
    for (let i = 0; i < nlet; i++) {
      const k = i + 1;
      const letter = letters[i];
      if (cfg.pop_out) {
        letter.pop_in = Math.min(1, Math.max((cfg.min_cycle_time ?? 1) - (G.TIMERS.REAL - this.pop_out_time!) * cfg.pop_out / (cfg.min_cycle_time ?? 1), 0));
        letter.pop_in = letter.pop_in * letter.pop_in;
        if (k === nlet && letter.pop_in <= 0 && this.strings.length > 1) this.pop_cycle = true;
      } else if (cfg.pop_in !== undefined && cfg.pop_in !== null) {
        const prev = letter.pop_in;
        letter.pop_in = Math.min(1, Math.max((G.TIMERS.REAL - cfg.pop_in - this.created_time) * slen * this.pop_in_rate - k + 1, cfg.min_cycle_time === 0 ? 1 : 0));
        letter.pop_in = letter.pop_in * letter.pop_in;
        if (prev <= 0 && letter.pop_in > 0 && !this.silent && (slen < 10 || k % 2 === 0)) {
          if (!(this.T.x > G.ROOM.T.w + 2 || this.T.y > G.ROOM.T.h + 2 || this.T.x < -2 || this.T.y < -2)) {
            play_sound('paper1', 0.45 + 0.05 * Math.random() + (0.3 / slen) * k + (cfg.pitch_shift ?? 0));
          }
        }
        if (k === nlet && letter.pop_in >= 1) {
          if (this.strings.length > 1) {
            this.pop_delay = G.TIMERS.REAL - cfg.pop_in - this.created_time + (cfg.pop_delay ?? 1.5);
            this.pop_out(4);
          } else {
            cfg.pop_in = null;
          }
        }
      }
      letter.r = 0;
      letter.scale = 1;
      if (cfg.rotate) {
        letter.r = (cfg.rotate === 2 ? -1 : 1) * (0.2 * (-nlet / 2 - 0.5 + k) / nlet + rm * 0.02 * Math.sin(2 * G.TIMERS.REAL + k));
      }
      if (cfg.pulse) {
        const p = cfg.pulse;
        letter.scale = letter.scale + rm * (1 / p.width) * p.amount * Math.max(
          Math.min((p.start - G.TIMERS.REAL) * p.speed + k + p.width, (G.TIMERS.REAL - p.start) * p.speed - k + p.width + 2), 0);
        letter.r = letter.r + rm * (letter.scale - 1) * (0.02 * (-nlet / 2 - 0.5 + k));
        if (p.start > G.TIMERS.REAL + 2 * p.speed * nlet) cfg.pulse = null;
      }
      if (cfg.quiver) {
        const q = cfg.quiver, T = G.TIMERS.REAL;
        letter.scale = letter.scale + rm * (0.1 * q.amount);
        letter.r = letter.r + rm * 0.3 * q.amount * (
          Math.sin(41.12342 * T * q.speed + k * 1223.2) +
          Math.cos(63.21231 * T * q.speed + k * 1112.2) * Math.sin(36.1231 * T * q.speed) +
          Math.cos(95.123 * T * q.speed + k * 1233.2) -
          Math.sin(30.133421 * T * q.speed + k * 123.2));
      }
      if (cfg.float) {
        letter.offset.y = rm * Math.sqrt(this.scale) * (2 + (this.font.FONTSCALE / G.TILESIZE) * 2000 * Math.sin(2.666 * G.TIMERS.REAL + 200 * k)) + 60 * (letter.scale - 1);
      }
      if (cfg.bump) {
        letter.offset.y = rm * this.bump_amount * Math.sqrt(this.scale) * 7 * Math.max(0, (5 + this.bump_rate) * Math.sin(this.bump_rate * G.TIMERS.REAL + 200 * k) - 3 - this.bump_rate);
      }
    }
  }

  set_quiver(amt?: number) {
    this.config.quiver = { speed: 0.5, amount: amt ?? 0.7, silent: false };
  }

  pulse(amt?: number) {
    this.config.pulse = { speed: 40, width: 2.5, start: G.TIMERS.REAL, amount: amt ?? 0.2, silent: false };
  }

  draw() {
    if (this.children.particle_effect) this.children.particle_effect.draw();
    const g = love.graphics;
    const F = this.font;
    const str = this.strings[this.focused_string];
    if (this.shadow) {
      prep_draw(this, 1);
      g.translate(str.W_offset + this.text_offset.x * F.FONTSCALE / G.TILESIZE, str.H_offset + this.text_offset.y * F.FONTSCALE / G.TILESIZE);
      if (this.config.spacing) g.translate(this.config.spacing * F.FONTSCALE / G.TILESIZE, 0);
      if (this.config.shadow_colour) g.setColor(this.config.shadow_colour);
      else g.setColor(0, 0, 0, 0.3 * this.colours[0][3]);
      for (const letter of str.letters) {
        const real_pop_in = this.config.min_cycle_time === 0 ? 1 : letter.pop_in;
        g.draw(letter.letter,
          0.5 * (letter.dims.x - letter.offset.x) * F.FONTSCALE / G.TILESIZE - this.shadow_parrallax.x * this.scale / G.TILESIZE,
          0.5 * letter.dims.y * F.FONTSCALE / G.TILESIZE - this.shadow_parrallax.y * this.scale / G.TILESIZE,
          letter.r ?? 0,
          real_pop_in * this.scale * F.FONTSCALE / G.TILESIZE,
          real_pop_in * this.scale * F.FONTSCALE / G.TILESIZE,
          0.5 * letter.dims.x / this.scale,
          0.5 * letter.dims.y / this.scale);
        g.translate(letter.dims.x * F.FONTSCALE / G.TILESIZE, 0);
      }
      g.pop();
    }
    prep_draw(this, 1);
    g.translate(str.W_offset + this.text_offset.x * F.FONTSCALE / G.TILESIZE, str.H_offset + this.text_offset.y * F.FONTSCALE / G.TILESIZE);
    if (this.config.spacing) g.translate(this.config.spacing * F.FONTSCALE / G.TILESIZE, 0);
    const sp = this.shadow_parrallax;
    const len = Math.sqrt(sp.y * sp.y + sp.x * sp.x);
    const nx = sp.x / len * F.FONTSCALE / G.TILESIZE, ny = sp.y / len * F.FONTSCALE / G.TILESIZE;
    const nlet = str.letters.length;
    for (let i = 0; i < nlet; i++) {
      const k = i + 1;
      const letter = str.letters[i];
      const real_pop_in = this.config.min_cycle_time === 0 ? 1 : letter.pop_in;
      g.setColor(letter.prefix ?? letter.suffix ?? letter.colour ?? this.colours[k % this.colours.length]);
      g.draw(letter.letter,
        0.5 * (letter.dims.x - letter.offset.x) * F.FONTSCALE / G.TILESIZE + nx,
        0.5 * (letter.dims.y - letter.offset.y) * F.FONTSCALE / G.TILESIZE + ny,
        letter.r ?? 0,
        real_pop_in * letter.scale * this.scale * F.FONTSCALE / G.TILESIZE,
        real_pop_in * letter.scale * this.scale * F.FONTSCALE / G.TILESIZE,
        0.5 * letter.dims.x / this.scale,
        0.5 * letter.dims.y / this.scale);
      g.translate(letter.dims.x * F.FONTSCALE / G.TILESIZE, 0);
    }
    g.pop();
    add_to_drawhash(this);
    this.draw_boundingrect();
  }
}
