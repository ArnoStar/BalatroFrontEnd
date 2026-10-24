// engine/ui.lua: UIBox (the root of a UI node graph) and UIElement (its
// nodes: ROOT, R rows, C columns, T text, B boxes, O objects).
import { G } from './globals';
import { love } from '../love';
import { Moveable } from './moveable';
import { Node } from './node';
import { add_to_drawhash, prep_draw, get_chosen_triangle_from_rect, each, remove_all, array_remove } from './util';
import { darken, mix_colours, adjust_alpha } from './colour';
import { tostring } from './format';
import { classes, hooks } from './registry';
import { play_sound } from './sound';

/** a UI definition node: {n = G.UIT.X, config = {...}, nodes = {...}} */
export interface UIDef { n: number; config?: any; nodes?: (UIDef | null | undefined | false)[] }

const isElement = (v: any): v is UIElement => v instanceof UIElement;

export class UIBox extends Moveable {
  draw_layers!: any[];
  definition!: UIDef;
  UIRoot!: UIElement;
  attention_text?: any;

  constructor(args?: { T?: any; definition: UIDef; config?: any }) {
    super();
    if (args) this.init_uibox(args);
  }

  init_uibox(args: { T?: any; definition: UIDef; config?: any }) {
    // the game passes `{args.T}` (a list, not `{T = ...}`), so a UIBox always starts at 0, 0, 1, 1
    this.init_moveable({});
    this.states.drag.can = false;
    this.draw_layers = [];
    this.definition = args.definition;
    if (args.config) {
      this.config = args.config;
      args.config.major = args.config.major ?? args.config.parent ?? this;
      this.set_alignment({
        major: args.config.major,
        type: args.config.align ?? args.config.type ?? '',
        bond: args.config.bond ?? 'Strong',
        offset: args.config.offset ?? { x: 0, y: 0 },
        lr_clamp: args.config.lr_clamp,
      });
      this.set_role({
        xy_bond: args.config.xy_bond,
        r_bond: args.config.r_bond,
        wh_bond: args.config.wh_bond ?? 'Weak',
        scale_bond: args.config.scale_bond ?? 'Weak',
      });
      this.states.collide.can = args.config.can_collide === undefined || args.config.can_collide === null ? true : args.config.can_collide;
      this.parent = this.config.parent;
    }
    this.set_parent_child(this.definition, null);
    this.Mid = this.Mid ?? this.UIRoot;
    this.calculate_xywh(this.UIRoot, this.T);
    this.T.w = this.UIRoot.T.w;
    this.T.h = this.UIRoot.T.h;
    this.UIRoot.set_wh();
    this.UIRoot.set_alignments();
    this.align_to_major();
    this.VT.x = this.T.x; this.VT.y = this.T.y;
    this.VT.w = this.T.w; this.VT.h = this.T.h;
    if (this.alignment && this.alignment.lr_clamp) this.lr_clamp();
    this.UIRoot.initialize_VT(true);
    if (Object.getPrototypeOf(this) === UIBox.prototype) {
      const it = args.config?.instance_type;
      (G.I as any)[it ?? 'UIBOX'].push(this);
    }
  }

  get_UIE_by_ID(id: string, node?: any): any {
    if (!node) node = this.UIRoot;
    if (node.config && node.config.id === id) return node;
    for (const v of childList(node.children)) {
      let res = this.get_UIE_by_ID(id, v);
      if (res) return res;
      if (v.config?.object && v.config.object.get_UIE_by_ID) {
        res = v.config.object.get_UIE_by_ID(id, null);
        if (res) return res;
      }
    }
    return null;
  }

  calculate_xywh(node: UIElement, _T: any, recalculate?: boolean, _scale?: number): [number, number] {
    node.ARGS.xywh_node_trans = node.ARGS.xywh_node_trans ?? {};
    const _nt = node.ARGS.xywh_node_trans;
    const _ct = { x: 0, y: 0, w: 0, h: 0 };
    const padding = node.config.padding ?? G.UIT.padding;
    if (node.UIT === G.UIT.B || node.UIT === G.UIT.T || node.UIT === G.UIT.O) {
      _nt.x = _T.x; _nt.y = _T.y;
      _nt.w = node.config.w ?? (node.config.object ? node.config.object.T.w : undefined);
      _nt.h = node.config.h ?? (node.config.object ? node.config.object.T.h : undefined);
      if (node.UIT === G.UIT.T) {
        node.config.text_drawable = null;
        const scale = node.config.scale ?? 1;
        if (node.config.ref_table && node.config.ref_value !== undefined && node.config.ref_value !== null) {
          node.config.text = tostring(node.config.ref_table[node.config.ref_value]);
          if (node.config.func && !recalculate) G.FUNCS[node.config.func](node);
        }
        if (node.config.text === undefined || node.config.text === null) node.config.text = '[UI ERROR]';
        node.config.lang = node.config.lang ?? G.LANG;
        const f = node.config.lang.font;
        let tx = f.FONT.getWidth(node.config.text) * f.squish * scale * G.TILESCALE * f.FONTSCALE;
        let ty = f.FONT.getHeight() * scale * G.TILESCALE * f.FONTSCALE * f.TEXT_HEIGHT_SCALE;
        if (node.config.vert) { const t = tx; tx = ty; ty = t; }
        _nt.x = _T.x; _nt.y = _T.y;
        _nt.w = tx / (G.TILESIZE * G.TILESCALE);
        _nt.h = ty / (G.TILESIZE * G.TILESCALE);
        node.content_dimensions = node.content_dimensions ?? {};
        node.content_dimensions.w = _T.w;
        node.content_dimensions.h = _T.h;
        node.set_values(_nt, recalculate);
      } else {
        node.content_dimensions = node.content_dimensions ?? {};
        node.content_dimensions.w = _nt.w;
        node.content_dimensions.h = _nt.h;
        node.set_values(_nt, recalculate);
      }
      return [_nt.w, _nt.h];
    }
    for (let i = 1; i <= 2; i++) {
      if (i === 1 || (i === 2 && ((node.config.maxw && _ct.w > node.config.maxw) || (node.config.maxh && _ct.h > node.config.maxh)))) {
        let fac = _scale ?? 1;
        if (i === 2) {
          const restriction = node.config.maxw ?? node.config.maxh;
          fac = fac * restriction / (node.config.maxw ? _ct.w : _ct.h);
        }
        _nt.x = _T.x; _nt.y = _T.y; _nt.w = node.config.minw ?? 0; _nt.h = node.config.minh ?? 0;
        if (node.UIT === G.UIT.ROOT) { _nt.x = 0; _nt.y = 0; _nt.w = node.config.minw ?? 0; _nt.h = node.config.minh ?? 0; }
        _ct.x = _nt.x + padding; _ct.y = _nt.y + padding; _ct.w = 0; _ct.h = 0;
        for (const v of node.children as any[]) {
          if (!isElement(v)) continue;
          if (v.config && v.config.scale) v.config.scale = v.config.scale * fac;
          const [_tw, _th] = this.calculate_xywh(v, _ct, recalculate, fac);
          if (_th !== undefined && _tw !== undefined && _th !== null && _tw !== null) {
            if (v.UIT === G.UIT.R) {
              _ct.h = _ct.h + _th + padding;
              _ct.y = _ct.y + _th + padding;
              if (_tw + padding > _ct.w) _ct.w = _tw + padding;
              if (v.config && v.config.emboss) { _ct.h += v.config.emboss; _ct.y += v.config.emboss; }
            } else {
              _ct.w = _ct.w + _tw + padding;
              _ct.x = _ct.x + _tw + padding;
              if (_th + padding > _ct.h) _ct.h = _th + padding;
              if (v.config && v.config.emboss) _ct.h += v.config.emboss;
            }
          }
        }
      }
    }
    node.content_dimensions = node.content_dimensions ?? {};
    node.content_dimensions.w = _ct.w + padding;
    node.content_dimensions.h = _ct.h + padding;
    _nt.w = Math.max(_ct.w + padding, _nt.w);
    _nt.h = Math.max(_ct.h + padding, _nt.h);
    node.set_values(_nt, recalculate);
    return [_nt.w, _nt.h];
  }

  remove_group(node: any, group: string): any {
    node = node ?? this.UIRoot;
    const kids = node.children;
    for (const k of Object.keys(kids)) {
      if (this.remove_group(kids[k], group)) {
        if (Array.isArray(kids) && /^\d+$/.test(k)) kids[Number(k)] = undefined;
        else delete kids[k];
      }
    }
    if (Array.isArray(kids)) {
      // a Lua table with holes: keep the order, drop the holes
      const kept = kids.filter((v: any) => v !== undefined);
      kids.length = 0;
      kids.push(...kept);
    }
    if (node.config && node.config.group && node.config.group === group) { node.remove(); return true; }
    this.calculate_xywh(this.UIRoot, this.T, true);
    this.UIRoot.set_wh();
    this.UIRoot.set_alignments();
    return undefined;
  }

  get_group(node: any, group: string, ingroup: any[] = []): any[] {
    node = node ?? this.UIRoot;
    for (const v of childList(node.children)) this.get_group(v, group, ingroup);
    if (node.config && node.config.group && node.config.group === group) { ingroup.push(node); return ingroup; }
    return ingroup;
  }

  set_parent_child(node: UIDef, parent: UIElement | null) {
    const UIE = new UIElement(parent, this, node.n, node.config);
    if (parent && parent.config && parent.config.group) {
      if (UIE.config) UIE.config.group = parent.config.group; else UIE.config = { group: parent.config.group };
    }
    if (parent && parent.config && parent.config.button) {
      if (UIE.config) UIE.config.button_UIE = parent; else UIE.config = { button_UIE: parent };
    }
    if (parent && parent.config && parent.config.button_UIE) {
      if (UIE.config) UIE.config.button_UIE = parent.config.button_UIE; else UIE.config = { button: parent.config.button };
    }
    if (node.n && node.n === G.UIT.O && UIE.config.button) UIE.config.object.states.click.can = false;
    if ((node.n === G.UIT.C || node.n === G.UIT.R || node.n === G.UIT.ROOT) && node.nodes) {
      for (const v of nodeList(node.nodes)) this.set_parent_child(v, UIE);
    }
    if (!parent) {
      this.UIRoot = UIE;
      this.UIRoot.parent = this;
    } else {
      parent.children.push(UIE);
    }
    if (node.config && node.config.mid) this.Mid = UIE;
  }

  remove() {
    if (this === G.OVERLAY_MENU) G.REFRESH_ALERTS = true;
    this.UIRoot.remove();
    array_remove((G.I as any)[this.config?.instance_type ?? 'UIBOX'], this);
    remove_all(this.children);
    super.remove();
  }

  draw() {
    if (this.FRAME.DRAW >= G.FRAMES.DRAW && !G.OVERLAY_TUTORIAL) return;
    this.FRAME.DRAW = G.FRAMES.DRAW;
    each(this.children, (v, k) => { if (k !== 'h_popup' && k !== 'alert') v.draw(); });
    if (this.states.visible) {
      add_to_drawhash(this);
      this.UIRoot.draw_self();
      this.UIRoot.draw_children();
      for (const v of this.draw_layers) {
        if (!v) continue;
        if (v.draw_self) v.draw_self(); else v.draw();
        if (v.draw_children) v.draw_children();
      }
    }
    if (this.children.alert) this.children.alert.draw();
    this.draw_boundingrect();
  }

  recalculate(_x?: any) {
    this.calculate_xywh(this.UIRoot, this.T, true);
    this.UIRoot.set_wh();
    this.UIRoot.set_alignments();
    this.T.w = this.UIRoot.T.w;
    this.T.h = this.UIRoot.T.h;
    G.REFRESH_FRAME_MAJOR_CACHE = (G.REFRESH_FRAME_MAJOR_CACHE ?? 0) + 1;
    this.UIRoot.initialize_VT();
    G.REFRESH_FRAME_MAJOR_CACHE = G.REFRESH_FRAME_MAJOR_CACHE > 1 ? G.REFRESH_FRAME_MAJOR_CACHE - 1 : null;
  }

  move(dt: number) {
    super.move(dt);
    Moveable.prototype.move.call(this.UIRoot, dt);
  }

  drag(offset?: any) {
    super.drag(offset);
    Moveable.prototype.move.call(this.UIRoot, undefined as any);
  }

  add_child(node: UIDef, parent: UIElement) {
    this.set_parent_child(node, parent);
    this.recalculate();
  }

  set_container(container: Node) {
    this.UIRoot.set_container(container);
    super.set_container(container);
  }
}
classes.UIBox = UIBox;

/** the UIElements of a children table, in order (named entries such as h_popup excluded) */
function childList(children: any): any[] {
  if (!children) return [];
  if (Array.isArray(children)) return children.filter((v) => v);
  return Object.values(children).filter((v) => v);
}

/** definition node lists may contain nil holes (`cond and {...} or nil`) */
export function nodeList(nodes: any): UIDef[] {
  if (!nodes) return [];
  if (Array.isArray(nodes)) return nodes.filter((v) => v && typeof v === 'object') as UIDef[];
  return Object.keys(nodes).sort((a, b) => Number(a) - Number(b)).map((k) => nodes[k]).filter((v) => v && typeof v === 'object');
}

export class UIElement extends Moveable {
  UIT!: number;
  UIBox!: UIBox;
  content_dimensions!: any;
  pixellated_rect?: any;
  last_clicked?: number;
  button_clicked?: boolean;
  disable_button?: boolean;

  constructor(parent: any, box: UIBox, uit: number, config: any) {
    super();
    this.parent = parent;
    this.UIT = uit;
    this.UIBox = box;
    this.config = config ?? {};
    if (this.config && this.config.object) this.config.object.parent = this;
    this.children = [];
    this.ARGS = this.ARGS ?? {};
    this.content_dimensions = { w: 0, h: 0 };
  }

  set_values(_T: any, recalculate?: boolean) {
    if (!recalculate || !this.T) {
      this.init_moveable({ T: _T });
      this.states.click.can = false;
      this.states.drag.can = false;
      this.static_rotation = true;
    } else {
      this.T.x = _T.x; this.T.y = _T.y; this.T.w = _T.w; this.T.h = _T.h;
    }
    if (this.config.button_UIE) { this.states.collide.can = true; this.states.hover.can = false; this.states.click.can = true; }
    if (this.config.button) { this.states.collide.can = true; this.states.click.can = true; }
    if (this.config.on_demand_tooltip || this.config.tooltip || this.config.detailed_tooltip) this.states.collide.can = true;
    this.set_role({ role_type: 'Minor', major: this.UIBox, offset: { x: _T.x, y: _T.y }, wh_bond: 'Weak', scale_bond: 'Weak' });
    if (this.config.draw_layer) this.UIBox.draw_layers[this.config.draw_layer] = this;
    if (this.config.collideable) this.states.collide.can = true;
    if (this.config.can_collide !== undefined && this.config.can_collide !== null) {
      this.states.collide.can = this.config.can_collide;
      if (this.config.object) this.config.object.states.collide.can = this.states.collide.can;
    }
    if (this.UIT === G.UIT.O && !this.config.no_role) {
      this.config.object.set_role(this.config.role ?? { role_type: 'Minor', major: this, xy_bond: 'Strong', wh_bond: 'Weak', scale_bond: 'Weak' });
    }
    if (this.config && this.config.ref_value !== undefined && this.config.ref_value !== null && this.config.ref_table) {
      this.config.prev_value = this.config.ref_table[this.config.ref_value];
    }
    if (this.UIT === G.UIT.T) this.static_rotation = true;
    if (this.config.juice) {
      if (this.UIT === G.UIT.O) this.config.object.juice_up(0.5);
      else this.juice_up();
      this.config.juice = false;
    }
    if (!this.config.colour) {
      if (this.UIT === G.UIT.ROOT) this.config.colour = G.C.UI.BACKGROUND_DARK;
      if (this.UIT === G.UIT.T) this.config.colour = G.C.UI.TEXT_LIGHT;
      if (this.UIT === G.UIT.O) this.config.colour = G.C.WHITE;
      if (this.UIT === G.UIT.B || this.UIT === G.UIT.C || this.UIT === G.UIT.R) this.config.colour = G.C.CLEAR;
    }
    if (!this.config.outline_colour) {
      if (this.UIT === G.UIT.O) this.config.colour = G.C.UI.OUTLINE_LIGHT;
      else this.config.outline_colour = G.C.UI.OUTLINE_LIGHT;
    }
    if (this.config.focus_args && !this.config.focus_args.registered) {
      if (this.config.focus_args.button) G.CONTROLLER.add_to_registry(this.config.button_UIE ?? this, this.config.focus_args.button);
      if (this.config.focus_args.snap_to) G.CONTROLLER.snap_to({ node: this });
      if (this.config.focus_args.funnel_to) {
        let _par = this.parent;
        while (_par && _par instanceof UIElement) {
          if (_par.config.focus_args && _par.config.focus_args.funnel_from) {
            _par.config.focus_args.funnel_from = this;
            this.config.focus_args.funnel_to = _par;
            break;
          }
          _par = _par.parent;
        }
      }
      this.config.focus_args.registered = true;
    }
    if (this.config.force_focus) this.states.collide.can = true;
    if (this.config.button_delay && !this.config.button_delay_start) {
      this.config.button_delay_start = G.TIMERS.REAL;
      this.config.button_delay_end = G.TIMERS.REAL + this.config.button_delay;
      this.config.button_delay_progress = 0;
    }
    this.layered_parallax = this.layered_parallax ?? { x: 0, y: 0 };
    if (this.config && this.config.func && (((this.config.button_UIE || this.config.button) && this.config.func !== 'set_button_pip') || this.config.insta_func)) {
      G.FUNCS[this.config.func](this);
    }
  }

  initialize_VT(_first?: boolean) {
    this.move_with_major(0);
    this.calculate_parrallax();
    for (const v of childList(this.children)) if (v.initialize_VT) v.initialize_VT();
    this.VT.w = this.T.w; this.VT.h = this.T.h;
    if (this.UIT === G.UIT.T) this.update_text();
    if (this.config.object) {
      if (!this.config.no_role) {
        this.config.object.hard_set_T(this.T.x, this.T.y, this.T.w, this.T.h);
        this.config.object.move_with_major(0);
        this.config.object.alignment.prev_type = '';
        this.config.object.align_to_major();
      }
      if (this.config.object.recalculate) this.config.object.recalculate();
    }
  }

  juice_up(amount?: number, rot_amt?: number) {
    if (this.UIT === G.UIT.O) { if (this.config.object) this.config.object.juice_up(amount, rot_amt); }
    else super.juice_up(amount, rot_amt);
  }

  can_drag(): any {
    if (this.states.drag.can) return this;
    return this.UIBox.can_drag();
  }

  draw() {}

  draw_children(_layer?: any) {
    if (!this.states.visible) return;
    each(this.children, (v, k) => {
      if (!v.config?.draw_layer && k !== 'h_popup' && k !== 'alert') {
        if (v.draw_self && !v.config.draw_after) v.draw_self(); else v.draw();
        if (v.draw_children) v.draw_children();
        if (v.draw_self && v.config.draw_after) v.draw_self(); else v.draw();
      }
    });
  }

  set_wh(): [number, number] {
    const padding = (this.config && this.config.padding) ?? G.UIT.padding;
    let _max_w = 0, _max_h = 0;
    if (Object.keys(this.children).length === 0 || this.config.no_fill) return [this.T.w, this.T.h];
    each(this.children, (w) => {
      if (w.set_wh) {
        const [_cw, _ch] = w.set_wh();
        if (_cw !== undefined && _ch !== undefined && _cw !== null && _ch !== null) {
          if (_cw > _max_w) _max_w = _cw;
          if (_ch > _max_h) _max_h = _ch;
        } else {
          _max_w = padding; _max_h = padding;
        }
      }
    });
    each(this.children, (w) => {
      if (w.UIT === G.UIT.R) w.T.w = _max_w;
      if (w.UIT === G.UIT.C) w.T.h = _max_h;
    });
    return [this.T.w, this.T.h];
  }

  align(x: number, y: number) {
    this.role.offset.y = this.role.offset.y + y;
    this.role.offset.x = this.role.offset.x + x;
    each(this.children, (v) => { if (v.align) v.align(x, y); });
  }

  set_alignments() {
    each(this.children, (v) => {
      if (this.config && this.config.align && v.align) {
        const padding = this.config.padding ?? G.UIT.padding;
        const a: string = this.config.align;
        if (a.includes('c')) {
          if (v.UIT === G.UIT.T || v.UIT === G.UIT.B || v.UIT === G.UIT.O) v.align(0, 0.5 * (this.T.h - 2 * padding - v.T.h));
          else v.align(0, 0.5 * (this.T.h - this.content_dimensions.h));
        }
        if (a.includes('m')) v.align(0.5 * (this.T.w - this.content_dimensions.w), 0);
        if (a.includes('b')) v.align(0, this.T.h - this.content_dimensions.h);
        if (a.includes('r')) v.align(this.T.w - this.content_dimensions.w, 0);
      }
      if (v.set_alignments) v.set_alignments();
    });
  }

  update_text() {
    if (this.config && this.config.text !== undefined && this.config.text !== null && !this.config.text_drawable) {
      this.config.lang = this.config.lang ?? G.LANG;
      this.config.text_drawable = love.graphics.newText(this.config.lang.font.FONT, [G.C.WHITE, this.config.text]);
    }
    if (this.config.ref_table && this.config.ref_table[this.config.ref_value] !== this.config.prev_value) {
      this.config.text = tostring(this.config.ref_table[this.config.ref_value]);
      this.config.text_drawable.set(this.config.text);
      if (!this.config.no_recalc && this.config.prev_value !== undefined && this.config.prev_value !== null &&
        tostring(this.config.prev_value).length !== this.config.text.length) this.UIBox.recalculate();
      this.config.prev_value = this.config.ref_table[this.config.ref_value];
    }
  }

  update_object() {
    if (this.config.ref_table && this.config.ref_value !== undefined && this.config.ref_table[this.config.ref_value] !== this.config.object) {
      this.config.object = this.config.ref_table[this.config.ref_value];
      this.UIBox.recalculate();
    }
    if (this.config.object) {
      this.config.object.config.refresh_movement = true;
      if (this.config.object.states.hover.is && !this.states.hover.is) {
        this.hover();
        this.states.hover.is = true;
      }
      if (!this.config.object.states.hover.is && this.states.hover.is) {
        this.stop_hover();
        this.states.hover.is = false;
      }
    }
    if (this.config.object && this.config.object.ui_object_updated) {
      this.config.object.ui_object_updated = null;
      this.config.object.parent = this;
      this.config.object.set_role(this.config.role ?? { role_type: 'Minor', major: this });
      this.config.object.move_with_major(0);
      if (this.config.object.non_recalc) {
        this.parent.content_dimensions.w = this.config.object.T.w;
        this.align(this.parent.T.x - this.config.object.T.x, this.parent.T.y - this.config.object.T.y);
        this.parent.set_alignments();
      } else {
        this.UIBox.recalculate();
      }
    }
  }

  draw_self() {
    if (!this.states.visible) {
      if (this.config.force_focus) add_to_drawhash(this);
      return;
    }
    if (this.config.force_focus || this.config.force_collision || this.config.button_UIE || this.config.button || this.states.collide.can) {
      add_to_drawhash(this);
    }
    const g = love.graphics;
    let button_active = true;
    let parallax_dist = 1.5;
    let button_being_pressed = false;

    if (this.config.button || this.config.button_UIE) {
      const pp = this.parent && this.parent !== this.UIBox ? this.parent.layered_parallax : null;
      this.layered_parallax.x = (pp ? pp.x : 0) + (this.config.shadow ? 0.4 * this.shadow_parrallax.x : 0) / G.TILESIZE;
      this.layered_parallax.y = (pp ? pp.y : 0) + (this.config.shadow ? 0.4 * this.shadow_parrallax.y : 0) / G.TILESIZE;
      if (this.config.button && ((this.last_clicked && this.last_clicked > G.TIMERS.REAL - 0.1) ||
        ((this.config.button && (this.states.hover.is || this.states.drag.is)) && G.CONTROLLER.is_cursor_down))) {
        this.layered_parallax.x -= parallax_dist * this.shadow_parrallax.x / G.TILESIZE * (this.config.button_dist ?? 1);
        this.layered_parallax.y -= parallax_dist * this.shadow_parrallax.y / G.TILESIZE * (this.config.button_dist ?? 1);
        parallax_dist = 0;
        button_being_pressed = true;
      }
      if (this.config.button_UIE && !this.config.button_UIE.config.button) button_active = false;
    }

    if (this.config.colour[3] > 0.01) {
      if (this.UIT === G.UIT.T && this.config.scale) {
        const f = this.config.lang.font;
        this.ARGS.text_parallax = this.ARGS.text_parallax ?? {};
        const tp = this.ARGS.text_parallax;
        tp.sx = -this.shadow_parrallax.x * 0.5 / (this.config.scale * f.FONTSCALE);
        tp.sy = -this.shadow_parrallax.y * 0.5 / (this.config.scale * f.FONTSCALE);
        if ((this.config.button_UIE && button_active) || (!this.config.button_UIE && this.config.shadow && G.SETTINGS.GRAPHICS.shadows === 'On')) {
          prep_draw(this, 0.97);
          if (this.config.vert) { g.translate(0, this.VT.h); g.rotate(-Math.PI / 2); }
          if ((this.config.shadow || (this.config.button_UIE && button_active)) && G.SETTINGS.GRAPHICS.shadows === 'On') {
            g.setColor(0, 0, 0, 0.3 * this.config.colour[3]);
            g.draw(this.config.text_drawable,
              (f.TEXT_OFFSET.x + (this.config.vert ? -tp.sy : tp.sx)) * (this.config.scale ?? 1) * f.FONTSCALE / G.TILESIZE,
              (f.TEXT_OFFSET.y + (this.config.vert ? tp.sx : tp.sy)) * (this.config.scale ?? 1) * f.FONTSCALE / G.TILESIZE,
              0,
              this.config.scale * f.squish * f.FONTSCALE / G.TILESIZE,
              this.config.scale * f.FONTSCALE / G.TILESIZE);
          }
          g.pop();
        }
        prep_draw(this, 1);
        if (this.config.vert) { g.translate(0, this.VT.h); g.rotate(-Math.PI / 2); }
        if (!button_active) g.setColor(G.C.UI.TEXT_INACTIVE);
        else g.setColor(this.config.colour);
        g.draw(this.config.text_drawable,
          f.TEXT_OFFSET.x * this.config.scale * f.FONTSCALE / G.TILESIZE,
          f.TEXT_OFFSET.y * this.config.scale * f.FONTSCALE / G.TILESIZE,
          0,
          this.config.scale * f.squish * f.FONTSCALE / G.TILESIZE,
          this.config.scale * f.FONTSCALE / G.TILESIZE);
        g.pop();
      } else if (this.UIT === G.UIT.B || this.UIT === G.UIT.C || this.UIT === G.UIT.R || this.UIT === G.UIT.ROOT) {
        prep_draw(this, 1);
        g.scale(1 / G.TILESIZE);
        if (this.config.shadow && G.SETTINGS.GRAPHICS.shadows === 'On') {
          g.scale(0.98);
          if (this.config.shadow_colour) g.setColor(this.config.shadow_colour);
          else g.setColor(0, 0, 0, 0.3 * this.config.colour[3]);
          if (this.config.r && this.VT.w > 0.01) this.draw_pixellated_rect('shadow', parallax_dist);
          else g.rectangle('fill', -this.shadow_parrallax.x * parallax_dist, -this.shadow_parrallax.y * parallax_dist, this.VT.w * G.TILESIZE, this.VT.h * G.TILESIZE);
          g.scale(1 / 0.98);
        }
        g.scale(button_being_pressed ? 0.985 : 1);
        if (this.config.emboss) {
          g.setColor(darken(this.config.colour, this.states.hover.is ? 0.5 : 0.3));
          this.draw_pixellated_rect('emboss', parallax_dist, this.config.emboss);
        }
        const collided_button = this.config.button_UIE ?? this;
        this.ARGS.button_colours = this.ARGS.button_colours ?? [];
        const bc = this.ARGS.button_colours;
        bc.length = 0;
        bc.push(this.config.button_delay ? mix_colours(this.config.colour, G.C.L_BLACK, 0.5) : this.config.colour);
        if ((collided_button.config.hover && collided_button.states.hover.is) || (collided_button.last_clicked && collided_button.last_clicked > G.TIMERS.REAL - 0.1)) {
          bc.push(G.C.UI.HOVER);
        }
        for (const v of bc) {
          g.setColor(v);
          if (this.config.r && this.VT.w > 0.01) {
            if (this.config.button_delay) {
              g.setColor(G.C.GREY);
              this.draw_pixellated_rect('fill', parallax_dist);
              g.setColor(v);
              this.draw_pixellated_rect('fill', parallax_dist, null, this.config.button_delay_progress);
            } else if (this.config.progress_bar) {
              g.setColor(this.config.progress_bar.empty_col ?? G.C.GREY);
              this.draw_pixellated_rect('fill', parallax_dist);
              g.setColor(this.config.progress_bar.filled_col ?? G.C.BLUE);
              this.draw_pixellated_rect('fill', parallax_dist, null,
                this.config.progress_bar.ref_table[this.config.progress_bar.ref_value] / this.config.progress_bar.max);
            } else {
              this.draw_pixellated_rect('fill', parallax_dist);
            }
          } else {
            g.rectangle('fill', 0, 0, this.VT.w * G.TILESIZE, this.VT.h * G.TILESIZE);
          }
        }
        g.pop();
      } else if (this.UIT === G.UIT.O && this.config.object) {
        if (this.config.focus_with_object && this.config.object.states.focus.is) {
          this.object_focus_timer = this.object_focus_timer ?? G.TIMERS.REAL;
          const lw = 50 * Math.max(0, this.object_focus_timer - G.TIMERS.REAL + 0.3) ** 2;
          prep_draw(this, 1);
          g.scale(1 / G.TILESIZE);
          g.setLineWidth(lw + 1.5);
          g.setColor(adjust_alpha(G.C.WHITE, 0.2 * lw));
          this.draw_pixellated_rect('fill', parallax_dist);
          g.setColor(this.config.colour[3] > 0 ? mix_colours(G.C.WHITE, this.config.colour, 0.8) : G.C.WHITE);
          this.draw_pixellated_rect('line', parallax_dist);
          g.pop();
        } else {
          this.object_focus_timer = null;
        }
        this.config.object.draw();
      }
    }

    if (this.config.outline && this.config.outline_colour[3] > 0.01) {
      prep_draw(this, 1);
      g.scale(1 / G.TILESIZE);
      g.setLineWidth(this.config.outline);
      if (this.config.line_emboss) {
        g.setColor(darken(this.config.outline_colour, this.states.hover.is ? 0.5 : 0.3));
        this.draw_pixellated_rect('line_emboss', parallax_dist, this.config.line_emboss);
      }
      g.setColor(this.config.outline_colour);
      if (this.config.r && this.VT.w > 0.01) this.draw_pixellated_rect('line', parallax_dist);
      else g.rectangle('line', 0, 0, this.VT.w * G.TILESIZE, this.VT.h * G.TILESIZE);
      g.pop();
    }

    if (this.states.focus.is) {
      this.focus_timer = this.focus_timer ?? G.TIMERS.REAL;
      const lw = 50 * Math.max(0, this.focus_timer - G.TIMERS.REAL + 0.3) ** 2;
      prep_draw(this, 1);
      g.scale(1 / G.TILESIZE);
      g.setLineWidth(lw + 1.5);
      g.setColor(adjust_alpha(G.C.WHITE, 0.2 * lw));
      this.draw_pixellated_rect('fill', parallax_dist);
      g.setColor(this.config.colour[3] > 0 ? mix_colours(G.C.WHITE, this.config.colour, 0.8) : G.C.WHITE);
      this.draw_pixellated_rect('line', parallax_dist);
      g.pop();
    } else {
      this.focus_timer = null;
    }

    if (this.config.chosen) {
      prep_draw(this, 0.98);
      g.scale(1 / G.TILESIZE);
      if (this.config.shadow && G.SETTINGS.GRAPHICS.shadows === 'On') {
        g.setColor(0, 0, 0, 0.3 * this.config.colour[3]);
        g.polygon('fill', get_chosen_triangle_from_rect(this.layered_parallax.x - this.shadow_parrallax.x * parallax_dist * 0.5,
          this.layered_parallax.y - this.shadow_parrallax.y * parallax_dist * 0.5, this.VT.w * G.TILESIZE, this.VT.h * G.TILESIZE, this.config.chosen === 'vert'));
      }
      g.pop();
      prep_draw(this, 1);
      g.scale(1 / G.TILESIZE);
      g.setColor(G.C.RED);
      g.polygon('fill', get_chosen_triangle_from_rect(this.layered_parallax.x, this.layered_parallax.y, this.VT.w * G.TILESIZE, this.VT.h * G.TILESIZE, this.config.chosen === 'vert'));
      g.pop();
    }
    this.draw_boundingrect();
  }

  draw_pixellated_rect(_type: string, _parallax: number, _emboss?: number | null, _progress?: number) {
    const pr = this.pixellated_rect;
    if (!pr || pr[_type].vertices.length < 1 || _parallax !== pr.parallax || pr.w !== this.VT.w || pr.h !== this.VT.h ||
      pr.sw !== this.shadow_parrallax.x || pr.sh !== this.shadow_parrallax.y || pr.progress !== (_progress ?? 1)) {
      const P: any = this.pixellated_rect = {
        w: this.VT.w, h: this.VT.h, sw: this.shadow_parrallax.x, sh: this.shadow_parrallax.y, progress: _progress ?? 1,
        fill: { vertices: [] }, shadow: { vertices: [] }, line: { vertices: [] }, emboss: { vertices: [] }, line_emboss: { vertices: [] },
        parallax: _parallax,
      };
      const ext_up = this.config.ext_up ? this.config.ext_up * G.TILESIZE : 0;
      const m = Math.min(this.VT.w, this.VT.h + Math.abs(ext_up) / G.TILESIZE);
      const res = this.config.res ?? (m > 3.5 ? 0.8 : m > 0.3 ? 0.6 : 0.15);
      const totw = this.VT.w * G.TILESIZE, toth = (this.VT.h + Math.abs(ext_up) / G.TILESIZE) * G.TILESIZE;
      const subw = this.VT.w * G.TILESIZE - 4 * res, subh = (this.VT.h + Math.abs(ext_up) / G.TILESIZE) * G.TILESIZE - 4 * res;
      const e = ext_up;
      const vertices = [
        subw / 2, subh / 2 - e,
        0, 4 * res - e,
        1 * res, 4 * res - e,
        1 * res, 2 * res - e,
        2 * res, 2 * res - e,
        2 * res, 1 * res - e,
        4 * res, 1 * res - e,
        4 * res, 0 * res - e,
        subw, 0 * res - e,
        subw, 1 * res - e,
        subw + 2 * res, 1 * res - e,
        subw + 2 * res, 2 * res - e,
        subw + 3 * res, 2 * res - e,
        subw + 3 * res, 4 * res - e,
        totw, 4 * res - e,
        totw, subh - e,
        subw + 3 * res, subh - e,
        subw + 3 * res, subh + 2 * res - e,
        subw + 2 * res, subh + 2 * res - e,
        subw + 2 * res, subh + 3 * res - e,
        subw, subh + 3 * res - e,
        subw, toth - e,
        4 * res, toth - e,
        4 * res, subh + 3 * res - e,
        2 * res, subh + 3 * res - e,
        2 * res, subh + 2 * res - e,
        1 * res, subh + 2 * res - e,
        1 * res, subh - e,
        0, subh - e,
        0, 4 * res - e,
      ];
      // Lua indices are 1-based: k odd = x, k even = y
      for (let i = 0; i < vertices.length; i++) {
        const k = i + 1;
        let v = vertices[i];
        if (k % 2 === 1 && v > totw * P.progress) v = totw * P.progress;
        P.fill.vertices[i] = v;
        if (k > 4) {
          P.line.vertices[k - 5] = v;
          if (_emboss) P.line_emboss.vertices[k - 5] = v + (k % 2 === 0 ? -_emboss * this.shadow_parrallax.y : -0.7 * _emboss * this.shadow_parrallax.x);
        }
        if (k % 2 === 0) {
          P.shadow.vertices[i] = v - this.shadow_parrallax.y * _parallax;
          if (_emboss) P.emboss.vertices[i] = v + _emboss * G.TILESIZE;
        } else {
          P.shadow.vertices[i] = v - this.shadow_parrallax.x * _parallax;
          if (_emboss) P.emboss.vertices[i] = v;
        }
      }
    }
    love.graphics.polygon((_type === 'line' || _type === 'line_emboss') ? 'line' : 'fill', this.pixellated_rect[_type].vertices);
  }

  update(dt: number) {
    G.ARGS.FUNC_TRACKER = G.ARGS.FUNC_TRACKER ?? {};
    if (this.config.button_delay) {
      this.config.button_temp = this.config.button ?? this.config.button_temp;
      this.config.button = null;
      this.config.button_delay_progress = (G.TIMERS.REAL - this.config.button_delay_start) / this.config.button_delay;
      if (G.TIMERS.REAL >= this.config.button_delay_end) this.config.button_delay = null;
    }
    if (this.config.button_temp && !this.config.button_delay) this.config.button = this.config.button_temp;
    if (this.button_clicked) this.button_clicked = null as any;
    if (this.config && this.config.func) {
      G.ARGS.FUNC_TRACKER[this.config.func] = (G.ARGS.FUNC_TRACKER[this.config.func] ?? 0) + 1;
      const f = G.FUNCS[this.config.func];
      if (f) f(this);
    }
    if (this.UIT === G.UIT.T) this.update_text();
    if (this.UIT === G.UIT.O) this.update_object();
    super.update(dt);
  }

  collides_with_point(p: { x: number; y: number }): boolean {
    if (this.UIBox.states.collide.can) return super.collides_with_point(p);
    return false;
  }

  click() {
    if (this.config.button && (!this.last_clicked || this.last_clicked + 0.1 < G.TIMERS.REAL) && this.states.visible && !this.under_overlay && !this.disable_button) {
      if (this.config.one_press) this.disable_button = true;
      this.last_clicked = G.TIMERS.REAL;
      if (this.config.id === 'overlay_menu_back_button') {
        G.CONTROLLER.mod_cursor_context_layer(-1);
        G.NO_MOD_CURSOR_STACK = true;
      }
      if (G.OVERLAY_TUTORIAL && G.OVERLAY_TUTORIAL.button_listen === this.config.button) G.FUNCS.tut_next();
      const f = G.FUNCS[this.config.button];
      if (f) f(this);
      else console.warn('no button callback', this.config.button);
      G.NO_MOD_CURSOR_STACK = null;
      if (this.config.choice) {
        const choices = this.UIBox.get_group(null, this.config.group);
        for (const v of choices) if (v.config && v.config.choice) v.config.chosen = false;
        this.config.chosen = true;
      }
      play_sound('button', 1, 0.3);
      G.ROOM.jiggle = G.ROOM.jiggle + 0.5;
      this.button_clicked = true;
    }
    if (this.config.button_UIE) this.config.button_UIE.click();
  }

  put_focused_cursor(): [number, number] {
    if (this.config.focus_args && this.config.focus_args.type === 'tab') {
      for (const v of childList(this.children)) {
        if (v.children[0]?.config.chosen) return v.children[0].put_focused_cursor();
      }
    }
    return super.put_focused_cursor();
  }

  remove() {
    if (this.config && this.config.object) {
      this.config.object.remove();
      this.config.object = null;
    }
    if (this === G.CONTROLLER.text_input_hook) G.CONTROLLER.text_input_hook = null;
    remove_all(this.children);
    super.remove();
  }

  hover() {
    if (this.config && this.config.on_demand_tooltip) {
      this.config.h_popup = hooks.create_popup_UIBox_tooltip!(this.config.on_demand_tooltip);
      this.config.h_popup_config = {
        align: this.T.y > G.ROOM.T.h / 2 ? 'tm' : 'bm',
        offset: { x: 0, y: this.T.y > G.ROOM.T.h / 2 ? -0.1 : 0.1 },
        parent: this,
      };
    }
    if (this.config.tooltip) {
      this.config.h_popup = hooks.create_popup_UIBox_tooltip!(this.config.tooltip);
      this.config.h_popup_config = { align: 'tm', offset: { x: 0, y: -0.1 }, parent: this };
    }
    if (this.config.detailed_tooltip && G.CONTROLLER.HID.pointer) {
      this.config.h_popup = hooks.create_UIBox_detailed_tooltip!(this.config.detailed_tooltip);
      this.config.h_popup_config = { align: 'tm', offset: { x: 0, y: -0.1 }, parent: this };
    }
    super.hover();
  }

  stop_hover() {
    super.stop_hover();
    if (this.config && this.config.on_demand_tooltip) this.config.h_popup = null;
  }

  release(other: any) {
    if (this.parent) this.parent.release(other);
  }
}

export function is_UI_containter(node: any) {
  return node.UIT === G.UIT.C || node.UIT === G.UIT.R || node.UIT === G.UIT.ROOT;
}
