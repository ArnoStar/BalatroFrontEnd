// The generic widget callbacks of button_callbacks.lua (G.FUNCS): button pips,
// toggles, sliders, option cycles, tabs, text input and overlay menus.
import { G, UIBox, Moveable, Event, fmtF, copy_table, ease_colour } from '@/shared/lib/engine';
import { love } from '@/shared/lib/love';

function SWAP(t: any[], i: number, j: number) {
  const tmp = t[i]; t[i] = t[j]; t[j] = tmp;
}

/** GET_TEXT_FROM_INPUT */
function get_text_from_input(): string {
  const hook = G.CONTROLLER.text_input_hook;
  let s = '';
  for (const c of hook.children) {
    if (c.config && String(c.config.id ?? '').startsWith('letter_') && c.config.text !== '') s += c.config.text;
  }
  return s;
}

/** MODIFY_TEXT_INPUT (letters are keyed 1..n) */
function modify_text_input(args: { letter: string; text_table: any; pos: number; delete?: boolean }) {
  const letters = args.text_table.letters;
  const n = Object.keys(letters).length;
  if (args.delete && args.pos > 0) {
    if (args.pos >= n) {
      letters[args.pos] = '';
    } else {
      letters[args.pos] = letters[args.pos + 1];
      modify_text_input({ letter: args.letter, text_table: args.text_table, pos: args.pos + 1, delete: args.delete });
    }
    return;
  }
  const swapped = letters[args.pos];
  letters[args.pos] = args.letter;
  if (swapped !== undefined && swapped !== '') modify_text_input({ letter: swapped, text_table: args.text_table, pos: args.pos + 1 });
}

/** TRANSPOSE_TEXT_INPUT: moves the cursor (the 'position' child) among the letters */
function transpose_text_input(amount: number) {
  const hook = G.CONTROLLER.text_input_hook;
  const text = hook.config.ref_table.text;
  let pos = -1;
  for (let i = 0; i < hook.children.length; i++) {
    if (hook.children[i].config && hook.children[i].config.id === 'position') { pos = i; break; }
  }
  const dir = amount === 0 ? 0 : amount / Math.abs(amount);
  while (amount !== 0) {
    if (pos + dir < 0 || pos + dir >= hook.children.length - 1) break;
    const next = hook.children[pos + dir];
    const real_letter = String(next.config.id ?? '').startsWith('letter_') && next.config.text !== '';
    SWAP(hook.children, pos, pos + dir);
    if (real_letter) amount -= dir;
    pos += dir;
  }
  text.current_position = Math.min(pos, String(text.ref_table[text.ref_value]).length);
  hook.UIBox.recalculate(true);
  text.ref_table[text.ref_value] = get_text_from_input();
}

export function register_ui_funcs() {
  const F = G.FUNCS;

  // gamepad pips are not used with a mouse
  F.set_button_pip = (e: any) => {
    if (e.children.button_pip) { e.children.button_pip.remove(); delete e.children.button_pip; }
  };

  F.flash = (e: any) => {
    if (G.CONTROLLER.text_input_hook) {
      e.config.colour[3] = Math.floor(G.TIMERS.REAL * 2) % 2 === 1 ? 0 : 1;
      if (e.config.w !== 0.1) { e.config.w = 0.1; e.UIBox.recalculate(true); }
    } else {
      e.config.colour[3] = 0;
      if (e.config.w !== 0) { e.config.w = 0; e.UIBox.recalculate(true); }
    }
  };

  F.pip_dynatext = (e: any) => {
    if ('pip_' + String(e.config.ref_table.focused_string + 1) === e.config.id) {
      if (e.config.pip_state !== 1) { e.config.colour = e.config.pipcol1; e.config.pip_state = 1; }
    } else if (e.config.pip_state !== 2) {
      e.config.colour = e.config.pipcol2;
      e.config.pip_state = 2;
    }
  };

  F.toggle_button = (e: any) => {
    const rt = e.config.ref_table;
    rt.ref_table[rt.ref_value] = !rt.ref_table[rt.ref_value];
    if (e.config.toggle_callback) e.config.toggle_callback(rt.ref_table[rt.ref_value]);
  };

  F.toggle = (e: any) => {
    const rt = e.config.ref_table;
    if (!rt.ref_table[rt.ref_value] && e.config.toggle_active) {
      e.config.toggle_active = null;
      e.config.colour = rt.inactive_colour;
      e.children[0].states.visible = false;
      e.children[0].config.object.states.visible = false;
    } else if (rt.ref_table[rt.ref_value] && !e.config.toggle_active) {
      e.config.toggle_active = true;
      e.config.colour = rt.active_colour;
      e.children[0].states.visible = true;
      e.children[0].config.object.states.visible = true;
    }
  };

  F.slider = (e: any) => {
    const c = e.children[0];
    e.states.drag.can = true;
    c.states.drag.can = true;
    const d = G.CONTROLLER?.dragging.target;
    if (d && (d === e || d === c)) {
      const rt = c.config.ref_table;
      rt.ref_table[rt.ref_value] = Math.min(rt.max, Math.max(rt.min, rt.min + (rt.max - rt.min) * (G.CURSOR.T.x - e.parent.T.x - G.ROOM.T.x) / e.T.w));
      rt.text = fmtF(rt.ref_table[rt.ref_value], rt.decimal_places);
      c.T.w = (rt.ref_table[rt.ref_value] - rt.min) / (rt.max - rt.min) * rt.w;
      c.config.w = c.T.w;
      if (rt.callback) G.FUNCS[rt.callback](rt);
    }
  };

  F.slider_descreet = (e: any, per?: number) => {
    const c = e.children[0];
    e.states.drag.can = true;
    c.states.drag.can = true;
    if (per) {
      const rt = c.config.ref_table;
      rt.ref_table[rt.ref_value] = Math.min(rt.max, Math.max(rt.min, rt.ref_table[rt.ref_value] + per * (rt.max - rt.min)));
      rt.text = fmtF(rt.ref_table[rt.ref_value], rt.decimal_places);
      c.T.w = (rt.ref_table[rt.ref_value] - rt.min) / (rt.max - rt.min) * rt.w;
      c.config.w = c.T.w;
    }
  };

  F.option_cycle = (e: any) => {
    const rt = e.config.ref_table;
    const from_val = rt.options[rt.current_option - 1];
    const from_key = rt.current_option;
    const old_pip = e.UIBox.get_UIE_by_ID('pip_' + rt.current_option, e.parent.parent);
    const cycle_main = e.UIBox.get_UIE_by_ID('cycle_main', e.parent.parent);
    if (cycle_main && cycle_main.config.h_popup) {
      cycle_main.stop_hover();
      G.E_MANAGER.add_event(new Event({ func: () => { cycle_main.hover(); return true; } }));
    }
    if (e.config.ref_value === 'l') {
      rt.current_option -= 1;
      if (rt.current_option <= 0) rt.current_option = rt.options.length;
    } else {
      rt.current_option += 1;
      if (rt.current_option > rt.options.length) rt.current_option = 1;
    }
    const to_val = rt.options[rt.current_option - 1];
    const to_key = rt.current_option;
    rt.current_option_val = rt.options[rt.current_option - 1];
    const new_pip = e.UIBox.get_UIE_by_ID('pip_' + rt.current_option, e.parent.parent);
    if (old_pip) old_pip.config.colour = G.C.BLACK;
    if (new_pip) new_pip.config.colour = G.C.WHITE;
    if (rt.opt_callback) G.FUNCS[rt.opt_callback]({ from_val, to_val, from_key, to_key, cycle_config: rt });
  };

  F.key_button = (e: any) => {
    const args = e.config.ref_table;
    if (args.key) G.CONTROLLER.key_press_update(args.key);
  };

  F.text_input = (e: any) => {
    const args = e.config.ref_table;
    if (G.CONTROLLER.text_input_hook === e) {
      e.parent.parent.config.colour = args.hooked_colour;
      args.current_prompt_text = '';
      args.current_position_text = args.position_text;
    } else {
      e.parent.parent.config.colour = args.colour;
      args.current_prompt_text = args.text.ref_table[args.text.ref_value] === '' ? args.prompt_text : '';
      args.current_position_text = '';
    }
  };

  F.paste_seed = (e: any) => {
    G.CONTROLLER.text_input_hook = e.UIBox.get_UIE_by_ID('text_input').children[0].children[0];
    for (let i = 0; i < 8; i++) F.text_input_key({ key: 'right' });
    for (let i = 0; i < 8; i++) F.text_input_key({ key: 'backspace' });
    const clip = love.system.getClipboardText() ?? '';
    for (const c of clip) F.text_input_key({ key: c });
    F.text_input_key({ key: 'return' });
  };

  F.select_text_input = (e: any) => {
    G.CONTROLLER.text_input_hook = e.children[0].children[0];
    transpose_text_input(0);
    e.UIBox.recalculate(true);
  };

  F.text_input_key = (args: any = {}) => {
    if (args.key === '[' || args.key === ']') return;
    if (args.key === '0') args.key = 'o';
    const hook = G.CONTROLLER.text_input_hook;
    if (!hook) return;
    const hook_config = hook.config.ref_table;
    hook_config.orig_colour = hook_config.orig_colour ?? copy_table(hook_config.colour);
    args.key = args.key ?? '%';
    args.caps = args.caps || G.CONTROLLER.capslock || hook_config.all_caps;
    const keymap: Record<string, string> = { space: ' ', backspace: 'BACKSPACE', delete: 'DELETE', return: 'RETURN', right: 'RIGHT', left: 'LEFT' };
    const corpus = '123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz' + (hook_config.extended_corpus ? ' 0!$&()<>?:{}+-=,.[]_' : '');
    if (hook_config.extended_corpus) {
      const lower = '1234567890-=;\',./', upper = '!@#$%^&*()_+:"<>?';
      const i = lower.indexOf(args.key);
      if (i >= 0 && args.caps) args.key = upper[i];
    }
    const text = hook_config.text;
    args.key = keymap[args.key] ?? (args.caps ? String(args.key).toUpperCase() : args.key);
    transpose_text_input(0);
    const value = String(text.ref_table[text.ref_value]);
    if (value.length > 0 && args.key === 'BACKSPACE') {
      modify_text_input({ letter: '', text_table: text, pos: text.current_position, delete: true });
      transpose_text_input(-1);
    } else if (value.length > 0 && args.key === 'DELETE') {
      modify_text_input({ letter: '', text_table: text, pos: text.current_position + 1, delete: true });
      transpose_text_input(0);
    } else if (args.key === 'RETURN') {
      if (hook_config.callback) hook_config.callback();
      hook.parent.parent.config.colour = hook_config.colour;
      const temp = copy_table(hook_config.orig_colour);
      hook_config.colour[0] = G.C.WHITE[0];
      hook_config.colour[1] = G.C.WHITE[1];
      hook_config.colour[2] = G.C.WHITE[2];
      ease_colour(hook_config.colour, temp);
      G.CONTROLLER.text_input_hook = null;
    } else if (args.key === 'LEFT') {
      transpose_text_input(-1);
    } else if (args.key === 'RIGHT') {
      transpose_text_input(1);
    } else if (hook_config.max_length > value.length && String(args.key).length === 1 && corpus.includes(args.key)) {
      modify_text_input({ letter: args.key, text_table: text, pos: text.current_position + 1 });
      transpose_text_input(1);
    }
  };

  F.change_tab = (e: any) => {
    if (!e) return;
    const tip = G.OVERLAY_MENU?.get_UIE_by_ID('overlay_menu_infotip');
    if (tip && tip.config.object) {
      tip.config.object.remove();
      tip.config.object = new Moveable();
    }
    const tab_contents = e.UIBox.get_UIE_by_ID('tab_contents');
    tab_contents.config.object.remove();
    tab_contents.config.object = new UIBox({
      definition: e.config.ref_table.tab_definition_function(e.config.ref_table.tab_definition_function_args),
      config: { offset: { x: 0, y: 0 }, parent: tab_contents, type: 'cm' },
    });
    tab_contents.UIBox.recalculate();
  };

  F.overlay_menu = (args: any) => {
    if (!args) return;
    if (G.OVERLAY_MENU) G.OVERLAY_MENU.remove();
    G.CONTROLLER.locks.frame_set = true;
    G.CONTROLLER.locks.frame = true;
    G.CONTROLLER.cursor_down.target = null;
    G.CONTROLLER.mod_cursor_context_layer(G.NO_MOD_CURSOR_STACK ? 0 : 1);
    const c = args.config ?? {};
    const config = {
      align: c.align ?? 'cm', offset: c.offset ?? { x: 0, y: 10 }, major: c.major ?? G.ROOM_ATTACH, bond: 'Weak', no_esc: c.no_esc,
    };
    G.OVERLAY_MENU = true;
    G.OVERLAY_MENU = new UIBox({ definition: args.definition, config });
    G.OVERLAY_MENU.alignment.offset.y = 0;
    G.ROOM.jiggle = G.ROOM.jiggle + 1;
    G.OVERLAY_MENU.align_to_major();
  };

  F.exit_overlay_menu = () => {
    if (!G.OVERLAY_MENU) return;
    G.CONTROLLER.locks.frame_set = true;
    G.CONTROLLER.locks.frame = true;
    G.CONTROLLER.mod_cursor_context_layer(-1000);
    G.OVERLAY_MENU.remove();
    G.OVERLAY_MENU = null;
    G.VIEWING_DECK = null;
    G.SETTINGS.paused = false;
    G.save_settings?.();
  };

  F.text_super_juice = (e: any, amount: number) => {
    e.config.object.set_quiver(0.03 * amount);
    e.config.object.pulse(0.3 + 0.08 * amount);
    e.config.object.update_text();
    e.config.object.align_letters();
    e.update_object();
  };
}
