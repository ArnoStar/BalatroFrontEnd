// engine/moveable.lua: a Node whose visible transform (VT) eases to its
// transform (T), with roles (Major/Minor/Glued) and alignment to a major.
import { G } from './globals';
import { Node } from './node';
import type { Transform } from './node';
import { pseudorandom_element, point_rotate, point_translate, array_remove, each } from './util';

export interface Role {
  role_type: 'Major' | 'Minor' | 'Glued';
  offset: { x: number; y: number };
  major: any;
  draw_major: any;
  xy_bond: 'Strong' | 'Weak';
  wh_bond: 'Strong' | 'Weak';
  r_bond: 'Strong' | 'Weak';
  scale_bond: 'Strong' | 'Weak';
}

const MWM = { rotated_offset: { x: 0, y: 0 }, angles: { cos: 0, sin: 0 }, WH: { w: 0, h: 0 }, offs: { x: 0, y: 0 } };

export class Moveable extends Node {
  VT!: Transform;
  velocity!: { x: number; y: number; r: number; scale: number; mag: number };
  role!: Role;
  alignment!: any;
  pinch!: { x: boolean; y: boolean };
  last_moved!: number;
  last_aligned!: number;
  static_rotation!: boolean;
  offset!: { x: number; y: number };
  Mid!: any;
  shadow_parrallax!: { x: number; y: number };
  layered_parallax!: { x: number; y: number };
  shadow_height!: number;
  juice: any;
  STATIONARY?: boolean;
  NEW_ALIGNMENT?: boolean;

  constructor(...args: any[]) {
    super();
    // Moveable() is a 0x0 moveable, as in Lua; subclasses init themselves
    if (args.length || Object.getPrototypeOf(this) === Moveable.prototype) this.init_moveable(...args);
  }

  init_moveable(X?: any, Y?: number, W?: number, H?: number) {
    const args = (X !== null && typeof X === 'object') ? X : { T: [X ?? 0, Y ?? 0, W ?? 0, H ?? 0] };
    this.init_node(args);
    this.VT = { x: this.T.x, y: this.T.y, w: this.T.w, h: this.T.h, r: this.T.r, scale: this.T.scale };
    this.velocity = { x: 0, y: 0, r: 0, scale: 0, mag: 0 };
    this.role = {
      role_type: 'Major', offset: { x: 0, y: 0 }, major: null, draw_major: this,
      xy_bond: 'Strong', wh_bond: 'Strong', r_bond: 'Strong', scale_bond: 'Strong',
    };
    this.alignment = { type: 'a', offset: { x: 0, y: 0 }, prev_type: '', prev_offset: { x: 0, y: 0 } };
    this.pinch = { x: false, y: false };
    this.last_moved = -1;
    this.last_aligned = -1;
    this.static_rotation = false;
    this.offset = { x: 0, y: 0 };
    this.Mid = this;
    this.shadow_parrallax = { x: 0, y: -1.5 };
    this.layered_parallax = { x: 0, y: 0 };
    this.shadow_height = 0.2;
    this.calculate_parrallax();
    G.MOVEABLES.push(this);
    if (Object.getPrototypeOf(this) === Moveable.prototype) G.I.MOVEABLE.push(this);
  }

  draw() {
    super.draw();
    this.draw_boundingrect();
  }

  set_alignment(args: any = {}) {
    if (args.major) {
      this.set_role({
        role_type: 'Minor',
        major: args.major,
        xy_bond: args.bond ?? args.xy_bond ?? 'Weak',
        wh_bond: args.wh_bond ?? this.role.wh_bond,
        r_bond: args.r_bond ?? this.role.r_bond,
        scale_bond: args.scale_bond ?? this.role.scale_bond,
      });
    }
    this.alignment.type = args.type ?? this.alignment.type;
    if (args.offset && (typeof args.offset !== 'object' || args.offset.y === undefined || args.offset.x === undefined)) {
      args.offset = undefined;
    }
    this.alignment.offset = args.offset ?? this.alignment.offset;
    this.alignment.lr_clamp = args.lr_clamp;
  }

  align_to_major() {
    const al = this.alignment;
    if (al.type !== al.prev_type) {
      const t: string = al.type;
      al.type_list = {
        a: t === 'a', m: t.includes('m'), c: t.includes('c'), b: t.includes('b'),
        t: t.includes('t'), l: t.includes('l'), r: t.includes('r'), i: t.includes('i'),
      };
    }
    if (al.prev_offset.x === al.offset.x && al.prev_offset.y === al.offset.y && al.prev_type === al.type) return;
    this.NEW_ALIGNMENT = true;
    if (al.type !== al.prev_type) al.prev_type = al.type;
    if (al.type_list.a || !this.role.major) return;
    const major = this.role.major;
    const tl = al.type_list;
    if (tl.m) this.role.offset.x = 0.5 * major.T.w - this.Mid.T.w / 2 + al.offset.x - this.Mid.T.x + this.T.x;
    if (tl.c) this.role.offset.y = 0.5 * major.T.h - this.Mid.T.h / 2 + al.offset.y - this.Mid.T.y + this.T.y;
    if (tl.b) this.role.offset.y = tl.i ? al.offset.y + major.T.h - this.T.h : al.offset.y + major.T.h;
    if (tl.r) this.role.offset.x = tl.i ? al.offset.x + major.T.w - this.T.w : al.offset.x + major.T.w;
    if (tl.t) this.role.offset.y = tl.i ? al.offset.y : al.offset.y - this.T.h;
    if (tl.l) this.role.offset.x = tl.i ? al.offset.x : al.offset.x - this.T.w;
    this.role.offset.x = this.role.offset.x ?? 0;
    this.role.offset.y = this.role.offset.y ?? 0;
    this.T.x = major.T.x + this.role.offset.x;
    this.T.y = major.T.y + this.role.offset.y;
    al.prev_offset = al.prev_offset ?? {};
    al.prev_offset.x = al.offset.x;
    al.prev_offset.y = al.offset.y;
  }

  hard_set_T(X: number, Y: number, W: number, H: number) {
    this.T.x = X; this.T.y = Y; this.T.w = W; this.T.h = H;
    this.velocity.x = 0; this.velocity.y = 0; this.velocity.r = 0; this.velocity.scale = 0;
    this.VT.x = X; this.VT.y = Y; this.VT.w = W; this.VT.h = H;
    this.VT.r = this.T.r; this.VT.scale = this.T.scale;
    this.calculate_parrallax();
  }

  hard_set_VT() {
    this.VT.x = this.T.x; this.VT.y = this.T.y; this.VT.w = this.T.w; this.VT.h = this.T.h;
  }

  drag(offset?: any) {
    if (this.states.drag.can || offset) {
      const _p = {
        x: G.CONTROLLER.cursor_position.x / (G.TILESCALE * G.TILESIZE),
        y: G.CONTROLLER.cursor_position.y / (G.TILESCALE * G.TILESIZE),
      };
      const _t = { x: -this.container.T.w / 2, y: -this.container.T.h / 2 };
      point_translate(_p, _t);
      point_rotate(_p, this.container.T.r);
      _t.x = this.container.T.w / 2 - this.container.T.x;
      _t.y = this.container.T.h / 2 - this.container.T.y;
      point_translate(_p, _t);
      if (!offset) offset = this.click_offset;
      this.T.x = _p.x - offset.x;
      this.T.y = _p.y - offset.y;
      this.NEW_ALIGNMENT = true;
      each(this.children, (v) => v.drag(offset));
    }
    if (this.states.drag.can) super.drag();
  }

  juice_up(amount?: number, rot_amt?: number) {
    if (G.SETTINGS.reduced_motion) return;
    amount = amount ?? 0.4;
    const end_time = G.TIMERS.REAL + 0.4;
    const start_time = G.TIMERS.REAL;
    this.juice = {
      scale: 0,
      scale_amt: amount,
      r: 0,
      r_amt: rot_amt ?? pseudorandom_element([0.6 * amount, -0.6 * amount])[0] ?? 0,
      start_time,
      end_time,
    };
    this.VT.scale = 1 - 0.6 * amount;
  }

  move_juice(_dt: number) {
    const j = this.juice;
    if (j && !j.handled_elsewhere) {
      if (j.end_time < G.TIMERS.REAL) {
        this.juice = null;
      } else {
        const rem = Math.max(0, (j.end_time - G.TIMERS.REAL) / (j.end_time - j.start_time));
        j.scale = j.scale_amt * Math.sin(50.8 * (G.TIMERS.REAL - j.start_time)) * rem ** 3;
        j.r = j.r_amt * Math.sin(40.8 * (G.TIMERS.REAL - j.start_time)) * rem ** 2;
      }
    }
  }

  move(dt: number) {
    if (this.FRAME.MOVE >= G.FRAMES.MOVE) return;
    this.FRAME.OLD_MAJOR = this.FRAME.MAJOR;
    this.FRAME.MAJOR = null;
    this.FRAME.MOVE = G.FRAMES.MOVE;
    if (!this.created_on_pause && G.SETTINGS.paused) return;
    this.align_to_major();
    this.CALCING = null;
    if (this.role.role_type === 'Glued') {
      if (this.role.major) this.glue_to_major(this.role.major);
    } else if (this.role.role_type === 'Minor' && this.role.major) {
      if (this.role.major.FRAME.MOVE < G.FRAMES.MOVE) this.role.major.move(dt);
      this.STATIONARY = this.role.major.STATIONARY;
      if (!this.STATIONARY || this.NEW_ALIGNMENT || this.config.refresh_movement || this.juice ||
        this.role.xy_bond === 'Weak' || this.role.r_bond === 'Weak') {
        this.CALCING = true;
        this.move_with_major(dt);
      }
    } else if (this.role.role_type === 'Major') {
      this.STATIONARY = true;
      this.move_juice(dt);
      this.move_xy(dt);
      this.move_r(dt, this.velocity);
      this.move_scale(dt);
      this.move_wh(dt);
      this.calculate_parrallax();
    }
    if (this.alignment && this.alignment.lr_clamp) this.lr_clamp();
    this.NEW_ALIGNMENT = false;
  }

  lr_clamp() {
    if (this.T.x < 0) this.T.x = 0;
    if (this.VT.x < 0) this.VT.x = 0;
    if (this.T.x + this.T.w > G.ROOM.T.w) this.T.x = G.ROOM.T.w - this.T.w;
    if (this.VT.x + this.VT.w > G.ROOM.T.w) this.VT.x = G.ROOM.T.w - this.VT.w;
  }

  glue_to_major(m: any) {
    this.T = m.T;
    this.VT.x = m.VT.x + 0.5 * (1 - m.VT.w / m.T.w) * this.T.w;
    this.VT.y = m.VT.y;
    this.VT.w = m.VT.w;
    this.VT.h = m.VT.h;
    this.VT.r = m.VT.r;
    this.VT.scale = m.VT.scale;
    this.pinch = m.pinch;
    this.shadow_parrallax = m.shadow_parrallax;
  }

  move_with_major(dt: number) {
    if (this.role.role_type !== 'Minor') return;
    const major_tab = this.role.major.get_major();
    this.move_juice(dt);
    const mm = major_tab.major;
    if (this.role.r_bond === 'Weak') {
      MWM.rotated_offset.x = this.role.offset.x + major_tab.offset.x;
      MWM.rotated_offset.y = this.role.offset.y + major_tab.offset.y;
    } else if (mm.VT.r < 0.0001 && mm.VT.r > -0.0001) {
      MWM.rotated_offset.x = this.role.offset.x + major_tab.offset.x;
      MWM.rotated_offset.y = this.role.offset.y + major_tab.offset.y;
    } else {
      MWM.angles.cos = Math.cos(mm.VT.r); MWM.angles.sin = Math.sin(mm.VT.r);
      MWM.WH.w = -this.T.w / 2 + mm.T.w / 2; MWM.WH.h = -this.T.h / 2 + mm.T.h / 2;
      MWM.offs.x = this.role.offset.x + major_tab.offset.x - MWM.WH.w;
      MWM.offs.y = this.role.offset.y + major_tab.offset.y - MWM.WH.h;
      MWM.rotated_offset.x = MWM.offs.x * MWM.angles.cos - MWM.offs.y * MWM.angles.sin + MWM.WH.w;
      MWM.rotated_offset.y = MWM.offs.x * MWM.angles.sin + MWM.offs.y * MWM.angles.cos + MWM.WH.h;
    }
    this.T.x = mm.T.x + MWM.rotated_offset.x;
    this.T.y = mm.T.y + MWM.rotated_offset.y;
    if (this.role.xy_bond === 'Strong') {
      this.VT.x = mm.VT.x + MWM.rotated_offset.x;
      this.VT.y = mm.VT.y + MWM.rotated_offset.y;
    } else if (this.role.xy_bond === 'Weak') {
      this.move_xy(dt);
    }
    if (this.role.r_bond === 'Strong') this.VT.r = this.T.r + mm.VT.r + (this.juice ? this.juice.r : 0);
    else if (this.role.r_bond === 'Weak') this.move_r(dt, this.velocity);
    if (this.role.scale_bond === 'Strong') this.VT.scale = this.T.scale * (mm.VT.scale / mm.T.scale) + (this.juice ? this.juice.scale : 0);
    else if (this.role.scale_bond === 'Weak') this.move_scale(dt);
    if (this.role.wh_bond === 'Strong') {
      this.VT.x = this.VT.x + 0.5 * (1 - mm.VT.w / mm.T.w) * this.T.w;
      this.VT.w = this.T.w * (mm.VT.w / mm.T.w);
      this.VT.h = this.T.h * (mm.VT.h / mm.T.h);
    } else if (this.role.wh_bond === 'Weak') {
      this.move_wh(dt);
    }
    this.calculate_parrallax();
  }

  move_xy(dt: number) {
    const T = this.T, VT = this.VT, v = this.velocity, e = G.exp_times as any;
    if (T.x !== VT.x || Math.abs(v.x) > 0.01 || T.y !== VT.y || Math.abs(v.y) > 0.01) {
      v.x = e.xy * v.x + (1 - e.xy) * (T.x - VT.x) * 35 * dt;
      v.y = e.xy * v.y + (1 - e.xy) * (T.y - VT.y) * 35 * dt;
      if (v.x * v.x + v.y * v.y > e.max_vel * e.max_vel) {
        const actual = Math.sqrt(v.x * v.x + v.y * v.y);
        v.x = e.max_vel * v.x / actual;
        v.y = e.max_vel * v.y / actual;
      }
      this.STATIONARY = false;
      VT.x += v.x;
      VT.y += v.y;
      if (Math.abs(VT.x - T.x) < 0.01 && Math.abs(v.x) < 0.01) { VT.x = T.x; v.x = 0; }
      if (Math.abs(VT.y - T.y) < 0.01 && Math.abs(v.y) < 0.01) { VT.y = T.y; v.y = 0; }
    }
  }

  move_scale(_dt: number) {
    const des = this.T.scale + (this.zoom ? ((this.states.drag.is ? 0.1 : 0) + (this.states.hover.is ? 0.05 : 0)) : 0) + (this.juice ? this.juice.scale : 0);
    if (des !== this.VT.scale || Math.abs(this.velocity.scale) > 0.001) {
      this.STATIONARY = false;
      this.velocity.scale = G.exp_times.scale * this.velocity.scale + (1 - G.exp_times.scale) * (des - this.VT.scale);
      this.VT.scale += this.velocity.scale;
    }
  }

  move_wh(dt: number) {
    const T = this.T, VT = this.VT, p = this.pinch;
    if ((T.w !== VT.w && !p.x) || (T.h !== VT.h && !p.y) || (VT.w > 0 && p.x) || (VT.h > 0 && p.y)) {
      this.STATIONARY = false;
      VT.w = VT.w + 8 * dt * (p.x ? -1 : 1) * T.w;
      VT.h = VT.h + 8 * dt * (p.y ? -1 : 1) * T.h;
      VT.w = Math.max(Math.min(VT.w, T.w), 0);
      VT.h = Math.max(Math.min(VT.h, T.h), 0);
    }
  }

  move_r(dt: number, vel: { x: number }) {
    const des = this.T.r + 0.015 * vel.x / dt + (this.juice ? this.juice.r * 2 : 0);
    if (des !== this.VT.r || Math.abs(this.velocity.r) > 0.001) {
      this.STATIONARY = false;
      this.velocity.r = G.exp_times.r * this.velocity.r + (1 - G.exp_times.r) * (des - this.VT.r);
      this.VT.r += this.velocity.r;
    }
    if (Math.abs(this.VT.r - this.T.r) < 0.001 && Math.abs(this.velocity.r) < 0.001) { this.VT.r = this.T.r; this.velocity.r = 0; }
  }

  calculate_parrallax() {
    if (!G.ROOM) return;
    this.shadow_parrallax.x = (this.T.x + this.T.w / 2 - G.ROOM.T.w / 2) / (G.ROOM.T.w / 2) * 1.5;
  }

  set_role(args: any) {
    if (args.major && !args.major.set_role) return;
    if (args.offset && (typeof args.offset !== 'object' || args.offset.y === undefined || args.offset.x === undefined)) args.offset = undefined;
    this.role = {
      role_type: args.role_type ?? this.role.role_type,
      offset: args.offset ?? this.role.offset,
      major: args.major ?? this.role.major,
      xy_bond: args.xy_bond ?? this.role.xy_bond,
      wh_bond: args.wh_bond ?? this.role.wh_bond,
      r_bond: args.r_bond ?? this.role.r_bond,
      scale_bond: args.scale_bond ?? this.role.scale_bond,
      draw_major: args.draw_major ?? this.role.draw_major,
    };
    if (this.role.role_type === 'Major') this.role.major = null;
  }

  get_major(): any {
    if (this.role.role_type !== 'Major' && this.role.major !== this && this.role.xy_bond !== 'Weak' && this.role.r_bond !== 'Weak') {
      if (!this.FRAME.MAJOR || G.REFRESH_FRAME_MAJOR_CACHE) {
        this.FRAME.MAJOR = this.FRAME.MAJOR ?? (this.FRAME.OLD_MAJOR ? emptyObj(this.FRAME.OLD_MAJOR) : {});
        this.temp_offs = this.temp_offs ? emptyObj(this.temp_offs) : {};
        const major = this.role.major.get_major();
        this.FRAME.MAJOR.major = major.major;
        this.FRAME.MAJOR.offset = this.FRAME.MAJOR.offset ?? this.temp_offs;
        this.FRAME.MAJOR.offset.x = major.offset.x + this.role.offset.x + this.layered_parallax.x;
        this.FRAME.MAJOR.offset.y = major.offset.y + this.role.offset.y + this.layered_parallax.y;
      }
      return this.FRAME.MAJOR;
    }
    this.ARGS.get_major = this.ARGS.get_major ?? {};
    this.ARGS.get_major.major = this;
    this.ARGS.get_major.offset = this.ARGS.get_major.offset ?? {};
    this.ARGS.get_major.offset.x = 0;
    this.ARGS.get_major.offset.y = 0;
    return this.ARGS.get_major;
  }

  remove() {
    array_remove(G.MOVEABLES, this);
    array_remove(G.I.MOVEABLE, this);
    super.remove();
  }
}

function emptyObj(o: any) {
  for (const k of Object.keys(o)) delete o[k];
  return o;
}
