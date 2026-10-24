// engine/controller.lua: how the cursor and keyboard reach game objects
// (hover, click, drag, release). Mouse and keyboard only: the gamepad paths
// of the game (focus navigation, axis cursor) are not used in the browser.
import { G } from './globals';
import { love } from '../love';
import { Event } from './event';
import { Vector_Dist, EMPTY } from './util';

interface Target { target: any; handled: boolean; prev_target: any }

export class Controller {
  clicked: Target = { target: null, handled: true, prev_target: null };
  focused: Target = { target: null, handled: true, prev_target: null };
  dragging: Target = { target: null, handled: true, prev_target: null };
  hovering: Target = { target: null, handled: true, prev_target: null };
  released_on: Target = { target: null, handled: true, prev_target: null };
  collision_list: any[] = [];
  nodes_at_cursor: any[] = [];
  cursor_down: any = { T: { x: 0, y: 0 }, target: null, time: 0, handled: true };
  cursor_up: any = { T: { x: 0, y: 0 }, target: null, time: 0.1, handled: true };
  cursor_hover: any = { T: { x: 0, y: 0 }, target: null, time: 0, handled: true };
  cursor_collider: any = null;
  cursor_position = { x: 0, y: 0 };
  pressed_keys: Record<string, boolean> = {};
  held_keys: Record<string, boolean> = {};
  held_key_times: Record<string, number | null> = {};
  released_keys: Record<string, boolean> = {};
  pressed_buttons: Record<string, boolean> = {};
  held_buttons: Record<string, boolean> = {};
  held_button_times: Record<string, number> = {};
  released_buttons: Record<string, boolean> = {};
  interrupt: any = { focus: false };
  locks: Record<string, any> = {};
  locked: boolean | null = null;
  button_registry: Record<string, any[]> = {};
  snap_cursor_to: any = null;
  cursor_context = { layer: 1, stack: [] as any[] };
  cardarea_context: Record<string, any> = {};
  HID = { last_type: '', dpad: false, pointer: true, touch: false, controller: false, mouse: true, axis_cursor: false };
  GAMEPAD: any = { object: null, mapping: null, name: null };
  GAMEPAD_CONSOLE = '';
  is_cursor_down = false;
  text_input_hook: any = null;
  capslock = false;
  frame_buttonpress = false;
  overlay_timer = 0;
  L_cursor_queue: { x: number; y: number } | null = null;
  COYOTE_FOCUS: any = null;
  lock_input?: boolean;
  focus_cursor_stack: any;
  focus_cursor_stack_level: any;
  screen_keyboard: any = null;

  set_HID_flags(HID_type: string, _button?: string) {
    if (HID_type && HID_type !== this.HID.last_type) {
      this.HID.dpad = HID_type === 'button';
      this.HID.pointer = HID_type === 'mouse' || HID_type === 'axis_cursor' || HID_type === 'touch';
      this.HID.controller = HID_type === 'button' || HID_type === 'axis_cursor';
      this.HID.mouse = HID_type === 'mouse';
      this.HID.touch = HID_type === 'touch';
      this.HID.axis_cursor = HID_type === 'axis_cursor';
      this.HID.last_type = HID_type;
      love.mouse.setVisible(this.HID.mouse || this.HID.touch);
    }
  }

  set_cursor_position() {
    if (this.HID.mouse || this.HID.touch) {
      this.interrupt.focus = false;
      if (this.focused.target) {
        this.focused.target.states.focus.is = false;
        this.focused.target = null;
      }
      [this.cursor_position.x, this.cursor_position.y] = love.mouse.getPosition();
      G.CURSOR.T.x = this.cursor_position.x / (G.TILESCALE * G.TILESIZE);
      G.CURSOR.T.y = this.cursor_position.y / (G.TILESCALE * G.TILESIZE);
      G.CURSOR.VT.x = G.CURSOR.T.x;
      G.CURSOR.VT.y = G.CURSOR.T.y;
    }
  }

  update(dt: number) {
    this.locked = false;
    this.locks.wipe = !!G.screenwipe;
    for (const k of Object.keys(this.locks)) if (this.locks[k]) this.locked = true;

    if (this.locks.frame_set) {
      this.locks.frame_set = null;
      this.overlay_timer = 0;
      G.E_MANAGER.add_event(new Event({
        trigger: 'after', delay: 0.1, timer: 'UPTIME', blocking: false, blockable: false, no_delete: true,
        func: () => { this.locks.frame = null; return true; },
      }));
    }
    this.overlay_timer = this.overlay_timer ?? 0;
    if (G.OVERLAY_MENU) this.overlay_timer += dt;
    else this.overlay_timer = 0;
    if (this.overlay_timer > 1.5) this.locks.frame = null;

    this.cull_registry();
    G.CURSOR.states.visible = false;
    this.set_cursor_position();

    if (!G.screenwipe) {
      for (const k of Object.keys(this.pressed_keys)) if (this.pressed_keys[k]) this.key_press_update(k, dt);
      for (const k of Object.keys(this.held_keys)) if (this.held_keys[k]) this.key_hold_update(k, dt);
      for (const k of Object.keys(this.released_keys)) if (this.released_keys[k]) this.key_release_update(k, dt);
    }
    this.frame_buttonpress = false;
    this.pressed_keys = EMPTY(this.pressed_keys);
    this.released_keys = EMPTY(this.released_keys);
    this.pressed_buttons = EMPTY(this.pressed_buttons);
    this.released_buttons = EMPTY(this.released_buttons);

    this.get_cursor_collision(G.CURSOR.T);
    this.update_focus();
    this.set_cursor_hover();
    if (this.L_cursor_queue) {
      this.L_cursor_press(this.L_cursor_queue.x, this.L_cursor_queue.y);
      this.L_cursor_queue = null;
    }

    this.dragging.prev_target = this.dragging.target;
    this.released_on.prev_target = this.released_on.target;
    this.clicked.prev_target = this.clicked.target;
    this.hovering.prev_target = this.hovering.target;

    if (!this.cursor_down.handled) {
      if (this.cursor_down.target.states.drag.can) {
        this.cursor_down.target.states.drag.is = true;
        this.cursor_down.target.set_offset(this.cursor_down.T, 'Click');
        this.dragging.target = this.cursor_down.target;
        this.dragging.handled = false;
      }
      this.cursor_down.handled = true;
    }

    if (!this.cursor_up.handled) {
      if (this.dragging.target) {
        this.dragging.target.stop_drag();
        this.dragging.target.states.drag.is = false;
        this.dragging.target = null;
      }
      if (this.cursor_down.target) {
        const t = this.cursor_down.target;
        if (!t.click_timeout || t.click_timeout * G.SPEEDFACTOR > this.cursor_up.time - this.cursor_down.time) {
          if (Vector_Dist(this.cursor_down.T, this.cursor_up.T) < G.MIN_CLICK_DIST) {
            if (t.states.click.can) {
              this.clicked.target = t;
              this.clicked.handled = false;
            }
          } else if (this.dragging.prev_target && this.cursor_up.target && this.cursor_up.target.states.release_on.can) {
            this.released_on.target = this.cursor_up.target;
            this.released_on.handled = false;
          }
        }
      }
      this.cursor_up.handled = true;
    }

    if (this.cursor_hover.target && this.cursor_hover.target.states.hover.can && (!this.HID.touch || this.is_cursor_down)) {
      this.hovering.target = this.cursor_hover.target;
      if (this.hovering.prev_target && this.hovering.prev_target !== this.hovering.target) this.hovering.prev_target.states.hover.is = false;
      this.hovering.target.states.hover.is = true;
      this.hovering.target.set_offset(this.cursor_hover.T, 'Hover');
    } else if ((!this.cursor_hover.target || (this.HID.touch && !this.is_cursor_down)) && this.hovering.target) {
      this.hovering.target.states.hover.is = false;
      this.hovering.target = null;
    }

    if (!this.clicked.handled) {
      this.clicked.target.click();
      this.clicked.handled = true;
    }

    this.process_registry();

    if (this.dragging.target) this.dragging.target.drag();

    if (!this.released_on.handled && this.dragging.prev_target) {
      if (this.dragging.prev_target === this.hovering.target) { this.hovering.target.stop_hover(); this.hovering.target = null; }
      this.released_on.target.release(this.dragging.prev_target);
      this.released_on.handled = true;
    }

    if (this.hovering.target) {
      this.hovering.target.set_offset(this.cursor_hover.T, 'Hover');
      if (this.hovering.prev_target !== this.hovering.target) {
        if (this.hovering.target !== this.dragging.target && !this.HID.touch) {
          this.hovering.target.hover();
        }
        if (this.hovering.prev_target) this.hovering.prev_target.stop_hover();
      }
    } else if (this.hovering.prev_target) {
      this.hovering.prev_target.stop_hover();
    }
    if (this.hovering.target && this.hovering.target === this.dragging.target && !this.HID.touch) {
      this.hovering.target.stop_hover();
    }
  }

  cull_registry() {
    for (const k of Object.keys(this.button_registry)) {
      const reg = this.button_registry[k];
      for (let i = reg.length - 1; i >= 0; i--) if (reg[i].node.REMOVED) reg.splice(i, 1);
    }
  }

  add_to_registry(node: any, registry: string) {
    this.button_registry[registry] = this.button_registry[registry] ?? [];
    this.button_registry[registry].unshift({ node, menu: !!G.OVERLAY_MENU || !!G.SETTINGS.paused });
  }

  process_registry() {
    for (const k of Object.keys(this.button_registry)) {
      for (const r of this.button_registry[k]) {
        if (r.click && r.node.click) {
          if (r.menu === !!G.OVERLAY_MENU && r.node.T.x > -2 && r.node.T.x < G.ROOM.T.w + 2 && r.node.T.y > -2 && r.node.T.y < G.ROOM.T.h + 2) {
            r.node.click();
          }
          r.click = null;
        }
      }
    }
  }

  mod_cursor_context_layer(delta: number) {
    if (delta === 1) {
      this.cursor_context.stack[this.cursor_context.layer] = { node: this.focused.target, cursor_pos: { x: G.CURSOR.T.x, y: G.CURSOR.T.y }, interrupt: this.interrupt.focus };
      this.cursor_context.layer++;
    } else if (delta === -1) {
      this.cursor_context.stack[this.cursor_context.layer] = null;
      this.cursor_context.layer--;
    } else if (delta === -1000) {
      this.cursor_context.layer = 1;
      this.cursor_context.stack = [this.cursor_context.stack[1]];
    } else if (delta === -2000) {
      this.cursor_context.layer = 1;
      this.cursor_context.stack = [];
    }
    this.navigate_focus();
  }

  snap_to(args: any) {
    this.snap_cursor_to = { node: args.node, T: args.T, type: args.node ? 'node' : 'transform' };
  }

  save_cardarea_focus(name: string) {
    if (G[name]) {
      if (this.focused.target && this.focused.target.area && this.focused.target.area === G[name]) {
        this.cardarea_context[name] = this.focused.target.rank;
        return true;
      }
      this.cardarea_context[name] = null;
    }
    return false;
  }

  recall_cardarea_focus(area: any) {
    if (typeof area === 'string') this.cardarea_context[area] = null;
  }

  update_cursor(hard_set_T?: any) {
    if (hard_set_T) {
      G.CURSOR.T.x = hard_set_T.x;
      G.CURSOR.T.y = hard_set_T.y;
      this.cursor_position.x = G.CURSOR.T.x * (G.TILESCALE * G.TILESIZE);
      this.cursor_position.y = G.CURSOR.T.y * (G.TILESCALE * G.TILESIZE);
      G.CURSOR.VT.x = G.CURSOR.T.x;
      G.CURSOR.VT.y = G.CURSOR.T.y;
    }
  }

  key_press_update(key: string, _dt: number) {
    if (this.locks.frame) return;
    if (key.startsWith('kp')) key = key.slice(2);
    if (key === 'enter') key = 'return';
    if (this.text_input_hook) {
      if (key === 'escape') this.text_input_hook = null;
      else if (key === 'capslock') this.capslock = !this.capslock;
      else G.FUNCS.text_input_key({ e: this.text_input_hook, key, caps: this.held_keys.lshift || this.held_keys.rshift });
      return;
    }
    if (key === 'escape') {
      if (G.STATE === G.STATES.SPLASH) {
        G.FUNCS.skip_splash?.();
      } else if (!G.OVERLAY_MENU) {
        G.FUNCS.options();
      } else if (!G.OVERLAY_MENU.config.no_esc) {
        G.FUNCS.exit_overlay_menu();
      }
    }
    if ((this.locked && !G.SETTINGS.paused) || this.locks.frame || this.frame_buttonpress) return;
    this.frame_buttonpress = true;
    this.held_key_times[key] = 0;
  }

  key_hold_update(key: string, dt: number) {
    if ((this.locked && !G.SETTINGS.paused) || this.locks.frame || this.frame_buttonpress) return;
    const t = this.held_key_times[key];
    if (t !== undefined && t !== null) {
      if (key === 'r' && !G.SETTINGS.paused) {
        if (t > 0.7) {
          this.held_key_times[key] = null;
          G.FUNCS.quick_restart?.();
        } else {
          this.held_key_times[key] = t + dt;
        }
      }
    }
  }

  key_release_update(_key: string, _dt: number) {
    if ((this.locked && !G.SETTINGS.paused) || this.locks.frame || this.frame_buttonpress) return;
    this.frame_buttonpress = true;
  }

  key_press(key: string) { this.pressed_keys[key] = true; this.held_keys[key] = true; }
  key_release(key: string) { delete this.held_keys[key]; this.released_keys[key] = true; }

  get_cursor_collision(cursor_trans: any) {
    this.collision_list = EMPTY(this.collision_list);
    this.nodes_at_cursor = EMPTY(this.nodes_at_cursor);
    if (this.COYOTE_FOCUS) return;
    if (this.dragging.target) {
      this.dragging.target.states.collide.is = true;
      this.nodes_at_cursor.push(this.dragging.target);
      this.collision_list.push(this.dragging.target);
    }
    if (!G.DRAW_HASH[0] ||
      cursor_trans.x - G.ROOM.T.x < -G.DRAW_HASH_BUFF || cursor_trans.x - G.ROOM.T.x > G.TILE_W + G.DRAW_HASH_BUFF ||
      cursor_trans.y - G.ROOM.T.y < -G.DRAW_HASH_BUFF || cursor_trans.y - G.ROOM.T.y > G.TILE_H + G.DRAW_HASH_BUFF) return;
    const H = G.DRAW_HASH;
    for (let i = H.length - 1; i >= 0; i--) {
      const v = H[i];
      if (v.collides_with_point(cursor_trans) && !v.REMOVED) {
        this.nodes_at_cursor.push(v);
        if (v.states.collide.can) {
          v.states.collide.is = true;
          this.collision_list.push(v);
        }
      }
    }
  }

  set_cursor_hover() {
    this.cursor_hover.T = this.cursor_hover.T ?? {};
    this.cursor_hover.T.x = G.CURSOR.T.x;
    this.cursor_hover.T.y = G.CURSOR.T.y;
    this.cursor_hover.time = G.TIMERS.TOTAL;
    this.cursor_hover.prev_target = this.cursor_hover.target;
    this.cursor_hover.target = null;
    if (this.interrupt.focus || (this.locked && (!G.SETTINGS.paused || G.screenwipe)) || this.locks.frame || this.COYOTE_FOCUS) {
      this.cursor_hover.target = G.ROOM;
      return;
    }
    for (const v of this.collision_list) {
      if (v.states.hover.can && (!v.states.drag.is || this.HID.touch)) {
        this.cursor_hover.target = v;
        break;
      }
    }
    if (!this.cursor_hover.target || (this.dragging.target && !this.HID.touch)) this.cursor_hover.target = G.ROOM;
    if (this.cursor_hover.target !== this.cursor_hover.prev_target) this.cursor_hover.handled = false;
  }

  queue_L_cursor_press(x: number, y: number) {
    if (this.locks.frame) return;
    if (G.STATE === G.STATES.SPLASH) this.key_press('escape');
    this.L_cursor_queue = { x, y };
  }

  queue_R_cursor_press(_x?: number, _y?: number) {
    if (this.locks.frame) return;
    if (!G.SETTINGS.paused && G.hand && G.hand.highlighted[0]) {
      if ((G.play && G.play.cards.length > 0) || this.locked || this.locks.frame || (G.GAME.STOP_USE && G.GAME.STOP_USE > 0)) return;
      G.hand.unhighlight_all();
    }
  }

  L_cursor_press(x?: number, y?: number) {
    x = x ?? this.cursor_position.x;
    y = y ?? this.cursor_position.y;
    if ((this.locked && (!G.SETTINGS.paused || G.screenwipe)) || this.locks.frame) return;
    this.cursor_down.T = { x: x / (G.TILESCALE * G.TILESIZE), y: y / (G.TILESCALE * G.TILESIZE) };
    this.cursor_down.time = G.TIMERS.TOTAL;
    this.cursor_down.handled = false;
    this.cursor_down.target = null;
    this.is_cursor_down = true;
    const press_node = (this.HID.touch && this.cursor_hover.target) || this.hovering.target || this.focused.target;
    if (press_node) this.cursor_down.target = press_node.states.click.can ? press_node : (press_node.can_drag() ?? null);
    if (!this.cursor_down.target) this.cursor_down.target = G.ROOM;
  }

  L_cursor_release(x?: number, y?: number) {
    x = x ?? this.cursor_position.x;
    y = y ?? this.cursor_position.y;
    if ((this.locked && (!G.SETTINGS.paused || G.screenwipe)) || this.locks.frame) return;
    this.cursor_up.T = { x: x / (G.TILESCALE * G.TILESIZE), y: y / (G.TILESCALE * G.TILESIZE) };
    this.cursor_up.time = G.TIMERS.TOTAL;
    this.cursor_up.handled = false;
    this.cursor_up.target = null;
    this.is_cursor_down = false;
    this.cursor_up.target = this.hovering.target ?? this.focused.target;
    if (!this.cursor_up.target) this.cursor_up.target = G.ROOM;
  }

  /** gamepad focus is not used: with a mouse the game clears it every frame */
  update_focus(_dir?: string) {
    this.focused.prev_target = this.focused.target;
    if (this.focused.target) this.focused.target.states.focus.is = false;
    this.focused.target = null;
  }

  navigate_focus(dir?: string) {
    this.update_focus(dir);
    this.update_cursor();
  }

  capture_focused_input(_button: string, _type: string, _dt: number) { return false; }
}
