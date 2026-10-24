// engine/node.lua: anything with a transform in the game space.
import { G } from './globals';
import { love } from '../love';
import { add_to_drawhash, each, point_rotate, point_translate, array_remove } from './util';
import { classes } from './registry';

export interface Transform { x: number; y: number; w: number; h: number; r: number; scale: number }

export interface NodeArgs { T?: any; container?: Node }

export interface NodeStates {
  visible: boolean;
  collide: { can: boolean; is: boolean };
  focus: { can: boolean; is: boolean };
  hover: { can: boolean; is: boolean };
  click: { can: boolean; is: boolean };
  drag: { can: boolean; is: boolean };
  release_on: { can: boolean; is: boolean };
}

export class Node {
  [key: string]: any;
  ARGS: any;
  RETS: any;
  config: any;
  T!: Transform;
  CT!: Transform;
  click_offset!: { x: number; y: number };
  hover_offset!: { x: number; y: number };
  created_on_pause!: boolean;
  ID!: number;
  FRAME!: { DRAW: number; MOVE: number; MAJOR?: any; OLD_MAJOR?: any };
  states!: NodeStates;
  container!: Node;
  children: any;
  REMOVED?: boolean;
  parent?: any;

  constructor(args?: NodeArgs) {
    if (args !== undefined) this.init_node(args);
  }

  init_node(args: NodeArgs = {}) {
    const T = args.T ?? {};
    this.ARGS = this.ARGS ?? {};
    this.RETS = {};
    this.config = this.config ?? {};
    this.T = {
      x: T.x ?? T[0] ?? 0,
      y: T.y ?? T[1] ?? 0,
      w: T.w ?? T[2] ?? 1,
      h: T.h ?? T[3] ?? 1,
      r: T.r ?? T[4] ?? 0,
      scale: T.scale ?? T[5] ?? 1,
    };
    this.CT = this.T;
    this.click_offset = { x: 0, y: 0 };
    this.hover_offset = { x: 0, y: 0 };
    this.created_on_pause = !!G.SETTINGS.paused;
    G.ID = G.ID ?? 1;
    this.ID = G.ID;
    G.ID = G.ID + 1;
    this.FRAME = { DRAW: -1, MOVE: -1 };
    this.states = {
      visible: true,
      collide: { can: false, is: false },
      focus: { can: false, is: false },
      hover: { can: true, is: false },
      click: { can: true, is: false },
      drag: { can: true, is: false },
      release_on: { can: true, is: false },
    };
    this.container = args.container ?? G.ROOM;
    if (!this.children) this.children = {};
    if (Object.getPrototypeOf(this) === Node.prototype) G.I.NODE.push(this);
    if (!G.STAGE_OBJECT_INTERRUPT) G.STAGE_OBJECTS[G.STAGE].push(this);
  }

  is(cls: any) { return this instanceof cls; }

  draw_boundingrect() {
    this.under_overlay = G.under_overlay;
  }

  draw() {
    this.draw_boundingrect();
    if (this.states.visible) {
      add_to_drawhash(this);
      each(this.children, (v) => v.draw());
    }
  }

  collides_with_point(point: { x: number; y: number }): boolean {
    if (this.container) {
      const T = this.CT ?? this.T;
      const _p = { x: point.x, y: point.y };
      const _t = { x: 0, y: 0 };
      const _b = this.states.hover.is ? G.COLLISION_BUFFER : 0;
      if (this.container !== this) {
        if (Math.abs(this.container.T.r) < 0.1) {
          _t.x = -this.container.T.w / 2; _t.y = -this.container.T.h / 2;
          point_translate(_p, _t);
          point_rotate(_p, this.container.T.r);
          _t.x = this.container.T.w / 2 - this.container.T.x; _t.y = this.container.T.h / 2 - this.container.T.y;
          point_translate(_p, _t);
        } else {
          _t.x = -this.container.T.x; _t.y = -this.container.T.y;
          point_translate(_p, _t);
        }
      }
      if (Math.abs(T.r) < 0.1) {
        if (_p.x >= T.x - _b && _p.y >= T.y - _b && _p.x <= T.x + T.w + _b && _p.y <= T.y + T.h + _b) return true;
      } else {
        const cos = Math.cos(T.r + Math.PI / 2), sin = Math.sin(T.r + Math.PI / 2);
        _p.x = _p.x - (T.x + 0.5 * T.w); _p.y = _p.y - (T.y + 0.5 * T.h);
        const tx = _p.y * cos - _p.x * sin, ty = _p.y * sin + _p.x * cos;
        _p.x = tx + (T.x + 0.5 * T.w); _p.y = ty + (T.y + 0.5 * T.h);
        if (_p.x >= T.x - _b && _p.y >= T.y - _b && _p.x <= T.x + T.w + _b && _p.y <= T.y + T.h + _b) return true;
      }
    }
    return false;
  }

  set_offset(point: { x: number; y: number }, type: 'Click' | 'Hover') {
    const _p = { x: point.x, y: point.y };
    const _t = { x: -this.container.T.w / 2, y: -this.container.T.h / 2 };
    point_translate(_p, _t);
    point_rotate(_p, this.container.T.r);
    _t.x = this.container.T.w / 2 - this.container.T.x;
    _t.y = this.container.T.h / 2 - this.container.T.y;
    point_translate(_p, _t);
    if (type === 'Click') { this.click_offset.x = _p.x - this.T.x; this.click_offset.y = _p.y - this.T.y; }
    else if (type === 'Hover') { this.hover_offset.x = _p.x - this.T.x; this.hover_offset.y = _p.y - this.T.y; }
  }

  drag(_offset?: any) {
    if (this.config && this.config.d_popup) {
      if (!this.children.d_popup) {
        this.children.d_popup = new classes.UIBox({ definition: this.config.d_popup, config: this.config.d_popup_config });
        if (this.children.h_popup) this.children.h_popup.states.collide.can = false;
        G.I.POPUP.push(this.children.d_popup);
        this.children.d_popup.states.drag.can = true;
      }
    }
  }

  can_drag(): any { return this.states.drag.can ? this : null; }

  stop_drag() {
    if (this.children.d_popup) {
      array_remove(G.I.POPUP, this.children.d_popup);
      this.children.d_popup.remove();
      delete this.children.d_popup;
    }
  }

  hover() {
    if (this.config && this.config.h_popup) {
      if (!this.children.h_popup) {
        this.config.h_popup_config.instance_type = 'POPUP';
        this.children.h_popup = new classes.UIBox({ definition: this.config.h_popup, config: this.config.h_popup_config });
        this.children.h_popup.states.collide.can = false;
        this.children.h_popup.states.drag.can = true;
      }
    }
  }

  stop_hover() {
    if (this.children.h_popup) {
      this.children.h_popup.remove();
      delete this.children.h_popup;
    }
  }

  put_focused_cursor(): [number, number] {
    return [
      (this.T.x + this.T.w / 2 + this.container.T.x) * (G.TILESCALE * G.TILESIZE),
      (this.T.y + this.T.h / 2 + this.container.T.y) * (G.TILESCALE * G.TILESIZE),
    ];
  }

  set_container(container: Node) {
    if (this.children) each(this.children, (v) => v.set_container(container));
    this.container = container;
  }

  translate_container() {
    if (this.container && this.container !== this) {
      const g = love.graphics, k = G.TILESCALE * G.TILESIZE;
      g.translate(this.container.T.w * k * 0.5, this.container.T.h * k * 0.5);
      g.rotate(this.container.T.r);
      g.translate(-this.container.T.w * k * 0.5 + this.container.T.x * k, -this.container.T.h * k * 0.5 + this.container.T.y * k);
    }
  }

  remove() {
    array_remove(G.I.POPUP, this);
    array_remove(G.I.NODE, this);
    for (const list of G.STAGE_OBJECTS) if (array_remove(list, this)) break;
    if (this.children) each(this.children, (v) => v.remove());
    const C = G.CONTROLLER;
    if (C) {
      for (const k of ['clicked', 'focused', 'dragging', 'hovering', 'released_on', 'cursor_down', 'cursor_up', 'cursor_hover']) {
        if (C[k].target === this) C[k].target = null;
      }
    }
    this.REMOVED = true;
  }

  fast_mid_dist(other: Node) {
    return Math.sqrt(((other.T.x + 0.5 * other.T.w) - (this.T.x + this.T.w)) ** 2) + ((other.T.y + 0.5 * other.T.h) - (this.T.y + this.T.h)) ** 2;
  }

  release(_dragged?: any) {}
  click() {}
  animate(_dt?: number) {}
  update(_dt: number) {}
}
