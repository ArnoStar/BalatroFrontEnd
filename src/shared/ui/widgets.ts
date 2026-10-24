// Generic UI builders from UI_definitions.lua: buttons, tabs, option cycles,
// sliders, toggles, text input, overlay frames, tooltips and attention text.
import {
  G, UIBox, DynaText, Sprite, Moveable, Particles, Event, copy_table, lighten, darken, fmtF,
} from '@/shared/lib/engine';
import type { UIDef } from '@/shared/lib/engine';
import { localize } from '@/shared/lib/localization';

export type Def = UIDef | null | undefined | false;

export function UIBox_button(args: any = {}): UIDef {
  args.button = args.button ?? 'exit_overlay_menu';
  args.colour = args.colour ?? G.C.RED;
  args.label = args.label ?? ['LABEL'];
  args.minw = args.minw ?? 2.7;
  args.maxw = args.maxw ?? (args.minw - 0.2);
  if (args.minw < args.maxw) args.maxw = args.minw - 0.2;
  args.minh = args.minh ?? 0.9;
  args.scale = args.scale ?? 0.5;
  args.text_colour = args.text_colour ?? G.C.UI.TEXT_LIGHT;
  const but_UIT = args.col === true ? G.UIT.C : G.UIT.R;
  const label: any[] = [];
  let button_pip: string | null = null;
  args.label.forEach((v: string, i: number) => {
    if (i === args.label.length - 1 && args.focus_args && args.focus_args.set_button_pip) button_pip = 'set_button_pip';
    label.push({
      n: G.UIT.R, config: { align: 'cm', padding: 0, minw: args.minw, maxw: args.maxw }, nodes: [
        { n: G.UIT.T, config: { text: v, scale: args.scale, colour: args.text_colour, shadow: args.shadow, focus_args: button_pip ? args.focus_args : null, func: button_pip, ref_table: args.ref_table } },
      ],
    });
  });
  if (args.count) {
    label.push({ n: G.UIT.R, config: { align: 'cm', minh: 0.4 }, nodes: [
      { n: G.UIT.T, config: { scale: 0.35, text: `${args.count.tally} / ${args.count.of}`, colour: [1, 1, 1, 0.9] } },
    ] });
  }
  return {
    n: but_UIT, config: { align: 'cm' }, nodes: [{
      n: G.UIT.C, config: {
        align: 'cm', padding: args.padding ?? 0, r: 0.1, hover: true, colour: args.colour, one_press: args.one_press,
        button: args.button !== 'nil' ? args.button : null, choice: args.choice, chosen: args.chosen, focus_args: args.focus_args,
        minh: args.minh - 0.3 * (args.count ? 1 : 0), shadow: true, func: args.func, id: args.id, back_func: args.back_func,
        ref_table: args.ref_table, mid: args.mid,
      }, nodes: label,
    }],
  };
}

export function create_UIBox_generic_options(args: any = {}): UIDef {
  const back_func = args.back_func ?? 'exit_overlay_menu';
  const contents = args.contents ?? [{ n: G.UIT.T, config: { text: 'EMPTY', colour: G.C.UI.RED, scale: 0.4 } }];
  if (args.infotip) {
    G.E_MANAGER.add_event(new Event({
      blocking: false, blockable: false, timer: 'REAL',
      func: () => {
        if (G.OVERLAY_MENU) {
          const tip = G.OVERLAY_MENU.get_UIE_by_ID('overlay_menu_infotip');
          if (tip) {
            tip.config.object.remove();
            tip.config.object = new UIBox({ definition: overlay_infotip(args.infotip), config: { offset: { x: 0, y: 0 }, align: 'bm', parent: tip } });
          }
        }
        return true;
      },
    }));
  }
  return {
    n: G.UIT.ROOT, config: { align: 'cm', minw: G.ROOM.T.w * 5, minh: G.ROOM.T.h * 5, padding: 0.1, r: 0.1, colour: args.bg_colour ?? [G.C.GREY[0], G.C.GREY[1], G.C.GREY[2], 0.7] }, nodes: [
      { n: G.UIT.R, config: { align: 'cm', minh: 1, r: 0.3, padding: 0.07, minw: 1, colour: args.outline_colour ?? G.C.JOKER_GREY, emboss: 0.1 }, nodes: [
        { n: G.UIT.C, config: { align: 'cm', minh: 1, r: 0.2, padding: 0.2, minw: 1, colour: args.colour ?? G.C.L_BLACK }, nodes: [
          { n: G.UIT.R, config: { align: 'cm', padding: args.padding ?? 0.2, minw: args.minw ?? 7 }, nodes: contents },
          !args.no_back ? { n: G.UIT.R, config: {
            id: args.back_id ?? 'overlay_menu_back_button', align: 'cm', minw: 2.5, button_delay: args.back_delay, padding: 0.1, r: 0.1, hover: true,
            colour: args.back_colour ?? G.C.ORANGE, button: back_func, shadow: true, focus_args: { nav: 'wide', button: 'b', snap_to: args.snap_back },
          }, nodes: [
            { n: G.UIT.R, config: { align: 'cm', padding: 0, no_fill: true }, nodes: [
              { n: G.UIT.T, config: { id: args.back_id ?? null, text: args.back_label ?? localize('b_back'), scale: 0.5, colour: G.C.UI.TEXT_LIGHT, shadow: true, func: !args.no_pip ? 'set_button_pip' : null, focus_args: !args.no_pip ? { button: args.back_button ?? 'b' } : null } },
            ] },
          ] } : null,
        ] },
      ] },
      { n: G.UIT.R, config: { align: 'cm' }, nodes: [
        { n: G.UIT.O, config: { id: 'overlay_menu_infotip', object: new Moveable() } },
      ] },
    ],
  };
}

export function UIBox_dyn_container(inner: Def[], horizontal?: boolean, colour_override?: any, background_override?: any, flipped?: boolean, padding?: number): UIDef {
  return { n: G.UIT.R, config: { align: 'cm', padding: 0.03, colour: G.C.UI.TRANSPARENT_DARK, r: 0.1 }, nodes: [
    { n: G.UIT.R, config: { align: 'cm', padding: 0.05, colour: colour_override ?? G.C.DYN_UI.MAIN, r: 0.1 }, nodes: [
      { n: G.UIT.R, config: { align: horizontal ? 'cl' : (flipped ? 'bm' : 'tm'), colour: background_override ?? G.C.DYN_UI.BOSS_DARK, minw: horizontal ? 100 : 0, minh: horizontal ? 0 : 30, r: 0.1, padding: padding ?? 0.08 }, nodes: inner as any },
    ] },
  ] };
}

export function simple_text_container(_loc: string, args: any = {}): UIDef | null {
  if (!_loc) return null;
  const res = localize(_loc);
  if (res && typeof res === 'object') {
    const container = (Array.isArray(res) ? res : Object.values(res)).map((v: any) => ({
      n: G.UIT.R, config: { align: 'cm', padding: 0 }, nodes: [
        { n: G.UIT.T, config: { text: v, scale: args.scale ?? 0.35, colour: args.colour ?? G.C.UI.TEXT_DARK, shadow: args.shadow } },
      ],
    }));
    return { n: args.col ? G.UIT.C : G.UIT.R, config: { align: 'cm', padding: args.padding ?? 0.03 }, nodes: container };
  }
  return null;
}

export function overlay_infotip(text_rows: any): UIDef {
  if (typeof text_rows !== 'object') text_rows = ['ERROR'];
  const rows = (Array.isArray(text_rows) ? text_rows : Object.values(text_rows).filter((v) => typeof v === 'string')).map((v: string) => ({
    n: G.UIT.R, config: { align: 'cm' }, nodes: [
      { n: G.UIT.T, config: { text: v, colour: G.C.UI.TEXT_LIGHT, scale: 0.45, juice: true, shadow: true, lang: text_rows.lang } },
    ],
  }));
  return { n: G.UIT.ROOT, config: { align: 'cm', colour: G.C.CLEAR, padding: 0.1 }, nodes: rows };
}

export function transparent_multiline_text(desc_nodes: any[][]): UIDef {
  return { n: G.UIT.R, config: { align: 'cm', padding: 0.03 }, nodes: desc_nodes.map((v) => ({ n: G.UIT.R, config: { align: 'cm' }, nodes: v })) };
}

export function create_UIBox_card_alert(args: any = {}): UIDef {
  return { n: G.UIT.ROOT, config: { align: 'cm', colour: G.C.CLEAR, refresh_movement: true }, nodes: [
    { n: G.UIT.R, config: { align: 'cm', r: 0.15, minw: 0.42, minh: 0.42, colour: args.no_bg ? G.C.CLEAR : (args.bg_col ?? (args.red_bad ? darken(G.C.RED, 0.1) : G.C.RED)), draw_layer: 1, emboss: 0.05, refresh_movement: true }, nodes: [
      { n: G.UIT.O, config: { object: new DynaText({
        string: args.text ?? '!', colours: [G.C.WHITE], shadow: true, rotate: true, H_offset: args.y_offset ?? 0,
        bump_rate: args.text ? 3 : 7, bump_amount: args.bump_amount ?? 3, bump: true, maxw: args.maxw, text_rot: args.text_rot ?? 0.2,
        spacing: 3 * (args.scale ?? 1), scale: args.scale ?? 0.48,
      }) } },
    ] },
  ] };
}

export function create_slider(args: any = {}): UIDef {
  args.colour = args.colour ?? G.C.RED;
  args.w = args.w ?? 1;
  args.h = args.h ?? 0.5;
  args.label_scale = args.label_scale ?? 0.5;
  args.text_scale = args.text_scale ?? 0.3;
  args.min = args.min ?? 0;
  args.max = args.max ?? 1;
  args.decimal_places = args.decimal_places ?? 0;
  args.text = fmtF(args.ref_table[args.ref_value], args.decimal_places);
  const startval = args.w * (args.ref_table[args.ref_value] - args.min) / (args.max - args.min);
  let t: UIDef = { n: G.UIT.C, config: { align: 'cm', minw: args.w, min_h: args.h, padding: 0.1, r: 0.1, colour: G.C.CLEAR, focus_args: { type: 'slider' } }, nodes: [
    { n: G.UIT.C, config: { align: 'cl', minw: args.w, r: 0.1, min_h: args.h, collideable: true, hover: true, colour: G.C.BLACK, emboss: 0.05, func: 'slider', refresh_movement: true }, nodes: [
      { n: G.UIT.B, config: { w: startval, h: args.h, r: 0.1, colour: args.colour, ref_table: args, refresh_movement: true } },
    ] },
    { n: G.UIT.C, config: { align: 'cm', minh: args.h, r: 0.1, minw: 0.8, colour: args.colour, shadow: true }, nodes: [
      { n: G.UIT.T, config: { ref_table: args, ref_value: 'text', scale: args.text_scale, colour: G.C.UI.TEXT_LIGHT, decimal_places: args.decimal_places } },
    ] },
  ] };
  if (args.label) {
    t = { n: G.UIT.R, config: { align: 'cm', minh: 1, minw: 1, padding: 0.1 * args.label_scale, colour: G.C.CLEAR }, nodes: [
      { n: G.UIT.R, config: { align: 'cm', padding: 0 }, nodes: [
        { n: G.UIT.T, config: { text: args.label, scale: args.label_scale, colour: G.C.UI.TEXT_LIGHT } },
      ] },
      { n: G.UIT.R, config: { align: 'cm', padding: 0 }, nodes: [t] },
    ] };
  }
  return t;
}

export function create_toggle(args: any = {}): UIDef {
  args.active_colour = args.active_colour ?? G.C.RED;
  args.inactive_colour = args.inactive_colour ?? G.C.BLACK;
  args.w = args.w ?? 3;
  args.h = args.h ?? 0.5;
  args.scale = args.scale ?? 1;
  args.label = args.label ?? 'TEST?';
  args.label_scale = args.label_scale ?? 0.4;
  args.ref_table = args.ref_table ?? {};
  args.ref_value = args.ref_value ?? 'test';
  const check = new Sprite(0, 0, 0.5 * args.scale, 0.5 * args.scale, G.ASSET_ATLAS.icons, { x: 1, y: 0 });
  check.states.drag.can = false;
  check.states.visible = false;
  let info: UIDef | null = null;
  if (args.info) {
    info = { n: G.UIT.R, config: { align: 'cm', minh: 0.05 }, nodes: args.info.map((v: string) => ({
      n: G.UIT.R, config: { align: 'cm', minh: 0.05 }, nodes: [{ n: G.UIT.T, config: { text: v, scale: 0.25, colour: G.C.UI.TEXT_LIGHT } }],
    })) };
  }
  let t: UIDef = { n: args.col ? G.UIT.C : G.UIT.R, config: { align: 'cm', padding: 0.1, r: 0.1, colour: G.C.CLEAR, focus_args: { funnel_from: true } }, nodes: [
    { n: G.UIT.C, config: { align: 'cr', minw: args.w }, nodes: [
      { n: G.UIT.T, config: { text: args.label, scale: args.label_scale, colour: G.C.UI.TEXT_LIGHT } },
      { n: G.UIT.B, config: { w: 0.1, h: 0.1 } },
    ] },
    { n: G.UIT.C, config: { align: 'cl', minw: 0.3 * args.w }, nodes: [
      { n: G.UIT.C, config: { align: 'cm', r: 0.1, colour: G.C.BLACK }, nodes: [
        { n: G.UIT.C, config: {
          align: 'cm', r: 0.1, padding: 0.03, minw: 0.4 * args.scale, minh: 0.4 * args.scale, outline_colour: G.C.WHITE, outline: 1.2 * args.scale,
          line_emboss: 0.5 * args.scale, ref_table: args, colour: args.inactive_colour, button: 'toggle_button', button_dist: 0.2, hover: true,
          toggle_callback: args.callback, func: 'toggle', focus_args: { funnel_to: true },
        }, nodes: [{ n: G.UIT.O, config: { object: check } }] },
      ] },
    ] },
  ] };
  if (args.info) t = { n: args.col ? G.UIT.C : G.UIT.R, config: { align: 'cm' }, nodes: [t, info] };
  return t;
}

export function create_option_cycle(args: any = {}): UIDef {
  args.colour = args.colour ?? G.C.RED;
  args.options = args.options ?? ['Option 1', 'Option 2'];
  args.current_option = args.current_option ?? 1;
  args.current_option_val = args.options[args.current_option - 1];
  args.scale = args.scale ?? 1;
  args.w = (args.w ?? 2.5) * args.scale;
  args.h = (args.h ?? 0.8) * args.scale;
  args.text_scale = (args.text_scale ?? 0.5) * args.scale;
  args.l = '<';
  args.r = '>';
  args.focus_args = args.focus_args ?? {};
  args.focus_args.type = 'cycle';
  let info: UIDef | null = null;
  if (args.info) {
    info = { n: G.UIT.R, config: { align: 'cm', minh: 0.05 }, nodes: args.info.map((v: string) => ({
      n: G.UIT.R, config: { align: 'cm', minh: 0.05 }, nodes: [{ n: G.UIT.T, config: { text: v, scale: 0.3 * args.scale, colour: G.C.UI.TEXT_LIGHT } }],
    })) };
  }
  const disabled = args.options.length < 2;
  const pips = args.options.map((_: any, i: number) => ({
    n: G.UIT.B, config: { w: 0.1 * args.scale, h: 0.1 * args.scale, r: 0.05, id: 'pip_' + (i + 1), colour: args.current_option === i + 1 ? G.C.WHITE : G.C.BLACK },
  }));
  const choice_pips = !args.no_pips ? { n: G.UIT.R, config: { align: 'cm', padding: (0.05 - (args.options.length > 15 ? 0.03 : 0)) * args.scale }, nodes: pips } : null;
  let t: UIDef = { n: G.UIT.C, config: { align: 'cm', padding: 0.1, r: 0.1, colour: G.C.CLEAR, id: args.id ? (!args.label ? args.id : null) : null, focus_args: args.focus_args }, nodes: [
    { n: G.UIT.C, config: { align: 'cm', r: 0.1, minw: 0.6 * args.scale, hover: !disabled, colour: !disabled ? args.colour : G.C.BLACK, shadow: !disabled, button: !disabled ? 'option_cycle' : null, ref_table: args, ref_value: 'l', focus_args: { type: 'none' } }, nodes: [
      { n: G.UIT.T, config: { ref_table: args, ref_value: 'l', scale: args.text_scale, colour: !disabled ? G.C.UI.TEXT_LIGHT : G.C.UI.TEXT_INACTIVE } },
    ] },
    args.mid ? { n: G.UIT.C, config: { id: 'cycle_main' }, nodes: [
      { n: G.UIT.R, config: { align: 'cm', minh: 0.05 }, nodes: [args.mid] },
      !disabled ? choice_pips : null,
    ] } : { n: G.UIT.C, config: { id: 'cycle_main', align: 'cm', minw: args.w, minh: args.h, r: 0.1, padding: 0.05, colour: args.colour, emboss: 0.1, hover: true, can_collide: true, on_demand_tooltip: args.on_demand_tooltip }, nodes: [
      { n: G.UIT.R, config: { align: 'cm' }, nodes: [
        { n: G.UIT.R, config: { align: 'cm' }, nodes: [
          { n: G.UIT.O, config: { object: new DynaText({ string: [{ ref_table: args, ref_value: 'current_option_val' }], colours: [G.C.UI.TEXT_LIGHT], pop_in: 0, pop_in_rate: 8, reset_pop_in: true, shadow: true, float: true, silent: true, bump: true, scale: args.text_scale, non_recalc: true }) } },
        ] },
        { n: G.UIT.R, config: { align: 'cm', minh: 0.05 }, nodes: [] },
        !disabled ? choice_pips : null,
      ] },
    ] },
    { n: G.UIT.C, config: { align: 'cm', r: 0.1, minw: 0.6 * args.scale, hover: !disabled, colour: !disabled ? args.colour : G.C.BLACK, shadow: !disabled, button: !disabled ? 'option_cycle' : null, ref_table: args, ref_value: 'r', focus_args: { type: 'none' } }, nodes: [
      { n: G.UIT.T, config: { ref_table: args, ref_value: 'r', scale: args.text_scale, colour: !disabled ? G.C.UI.TEXT_LIGHT : G.C.UI.TEXT_INACTIVE } },
    ] },
  ] };
  if (args.cycle_shoulders) {
    t = { n: G.UIT.R, config: { align: 'cm', colour: G.C.CLEAR }, nodes: [
      { n: G.UIT.C, config: { minw: 0.7, align: 'cm', colour: G.C.CLEAR, func: 'set_button_pip', focus_args: { button: 'leftshoulder', type: 'none', orientation: 'cm', scale: 0.7, offset: { x: -0.1, y: 0 } } }, nodes: [] },
      { n: G.UIT.C, config: { id: 'cycle_shoulders', padding: 0.1 }, nodes: [t] },
      { n: G.UIT.C, config: { minw: 0.7, align: 'cm', colour: G.C.CLEAR, func: 'set_button_pip', focus_args: { button: 'rightshoulder', type: 'none', orientation: 'cm', scale: 0.7, offset: { x: 0.1, y: 0 } } }, nodes: [] },
    ] };
  } else {
    t = { n: G.UIT.R, config: { align: 'cm', colour: G.C.CLEAR, padding: 0.0 }, nodes: [t] };
  }
  if (args.label || args.info) {
    t = { n: G.UIT.R, config: { align: 'cm', padding: 0.05, id: args.id ?? null }, nodes: [
      args.label ? { n: G.UIT.R, config: { align: 'cm' }, nodes: [{ n: G.UIT.T, config: { text: args.label, scale: 0.5 * args.scale, colour: G.C.UI.TEXT_LIGHT } }] } : null,
      t,
      info,
    ] };
  }
  return t;
}

export function create_tabs(args: any = {}): UIDef {
  args.colour = args.colour ?? G.C.RED;
  args.tab_alignment = args.tab_alignment ?? 'cm';
  args.scale = args.scale ?? 1;
  args.tab_w = args.tab_w ?? 0;
  args.tab_h = args.tab_h ?? 0;
  args.text_scale = args.text_scale ?? 0.5;
  const tab_buttons: UIDef[] = [];
  args.tabs.forEach((v: any, i: number) => {
    if (v.chosen) args.current = { k: i + 1, v };
    tab_buttons.push(UIBox_button({
      id: 'tab_but_' + (v.label ?? ''), ref_table: v, button: 'change_tab', label: [v.label], minh: 0.8 * args.scale, minw: 2.5 * args.scale,
      col: true, choice: true, scale: args.text_scale, chosen: v.chosen, func: v.func, focus_args: { type: 'none' },
    }));
  });
  return { n: G.UIT.R, config: { padding: 0.0, align: 'cm', colour: G.C.CLEAR }, nodes: [
    { n: G.UIT.R, config: { align: 'cm', colour: G.C.CLEAR }, nodes: [
      (args.tabs.length > 1 && !args.no_shoulders) ? { n: G.UIT.C, config: { minw: 0.7, align: 'cm', colour: G.C.CLEAR, func: 'set_button_pip', focus_args: { button: 'leftshoulder', type: 'none', orientation: 'cm', scale: 0.7, offset: { x: -0.1, y: 0 } } }, nodes: [] } : null,
      { n: G.UIT.C, config: { id: args.no_shoulders ? 'no_shoulders' : 'tab_shoulders', ref_table: args, align: 'cm', padding: 0.15, group: 1, collideable: true, focus_args: args.tabs.length > 1 ? { type: 'tab', nav: 'wide', snap_to: args.snap_to_nav, no_loop: args.no_loop } : null }, nodes: tab_buttons },
      (args.tabs.length > 1 && !args.no_shoulders) ? { n: G.UIT.C, config: { minw: 0.7, align: 'cm', colour: G.C.CLEAR, func: 'set_button_pip', focus_args: { button: 'rightshoulder', type: 'none', orientation: 'cm', scale: 0.7, offset: { x: 0.1, y: 0 } } }, nodes: [] } : null,
    ] },
    { n: G.UIT.R, config: { align: args.tab_alignment, padding: args.padding ?? 0.1, no_fill: true, minh: args.tab_h, minw: args.tab_w }, nodes: [
      { n: G.UIT.O, config: { id: 'tab_contents', object: new UIBox({ definition: args.current.v.tab_definition_function(args.current.v.tab_definition_function_args), config: { offset: { x: 0, y: 0 } } }) } },
    ] },
  ] };
}

export function create_text_input(args: any = {}): UIDef {
  args.colour = copy_table(args.colour) ?? copy_table(G.C.BLUE);
  args.hooked_colour = copy_table(args.hooked_colour) ?? darken(copy_table(G.C.BLUE), 0.3);
  args.w = args.w ?? 2.5;
  args.h = args.h ?? 0.7;
  args.text_scale = args.text_scale ?? 0.4;
  args.max_length = args.max_length ?? 16;
  args.all_caps = args.all_caps ?? false;
  args.prompt_text = args.prompt_text ?? localize('k_enter_text');
  args.current_prompt_text = '';
  const value: string = args.ref_table[args.ref_value] ?? '';
  // letters are keyed 1..max_length, as the UI refers to them by ref_value
  const text: any = { ref_table: args.ref_table, ref_value: args.ref_value, letters: {}, current_position: value.length };
  const ui_letters: UIDef[] = [];
  for (let i = 1; i <= args.max_length; i++) {
    text.letters[i] = value.charAt(i - 1) ?? '';
    ui_letters.push({ n: G.UIT.T, config: { ref_table: text.letters, ref_value: i, scale: args.text_scale, colour: G.C.UI.TEXT_LIGHT, id: 'letter_' + i } });
  }
  args.text = text;
  const position_text_colour = lighten(copy_table(G.C.BLUE), 0.4);
  ui_letters.push({ n: G.UIT.T, config: { ref_table: args, ref_value: 'current_prompt_text', scale: args.text_scale, colour: lighten(copy_table(args.colour), 0.4), id: 'prompt' } });
  ui_letters.push({ n: G.UIT.B, config: { r: 0.03, w: 0.1, h: 0.4, colour: position_text_colour, id: 'position', func: 'flash' } });
  return { n: G.UIT.C, config: { align: 'cm', draw_layer: 1, colour: G.C.CLEAR }, nodes: [
    { n: G.UIT.C, config: { id: 'text_input', align: 'cm', padding: 0.05, r: 0.1, draw_layer: 2, hover: true, colour: args.colour, minw: args.w, min_h: args.h, button: 'select_text_input', shadow: true }, nodes: [
      { n: G.UIT.R, config: { ref_table: args, padding: 0.05, align: 'cm', r: 0.1, colour: G.C.CLEAR }, nodes: [
        { n: G.UIT.R, config: { ref_table: args, align: 'cm', r: 0.1, colour: G.C.CLEAR, func: 'text_input' }, nodes: ui_letters },
      ] },
    ] },
  ] };
}

export function create_dynatext_pips(args: any = {}): UIDef | null {
  args.active_colour = copy_table(args.colour) ?? G.C.RED;
  args.inactive_colour = copy_table(args.inactive_colour) ?? [0, 0, 0, 0.08];
  args.w = args.w ?? 0.07;
  args.h = args.h ?? 0.07;
  if (!args.dynatext || !(args.dynatext.strings.length > 1)) return null;
  const pips = args.dynatext.strings.map((_: any, i: number) => ({
    n: G.UIT.C, config: { ref_table: args.dynatext, minw: args.w, minh: args.h, colour: G.C.UI.TEXT_INACTIVE, r: 0.1, id: 'pip_' + (i + 1), pipcol1: args.active_colour, pipcol2: args.inactive_colour, func: 'pip_dynatext' },
  }));
  return { n: G.UIT.R, config: { padding: 0.05, align: 'cm' }, nodes: pips };
}

export function create_popup_UIBox_tooltip(tooltip: any): UIDef {
  const rows: UIDef[] = [];
  if (tooltip.title) {
    rows.push({ n: G.UIT.R, config: { align: 'cm' }, nodes: [
      { n: G.UIT.C, config: { align: 'cm' }, nodes: [{ n: G.UIT.T, config: { text: tooltip.title, colour: G.C.UI.TEXT_DARK, scale: 0.4 } }] },
    ] });
  }
  for (const line of tooltip.text ?? []) {
    if (typeof line === 'object') {
      rows.push({ n: G.UIT.R, config: { align: 'cm', padding: 0.03 }, nodes: [
        { n: G.UIT.T, config: { ref_table: line.ref_table, ref_value: line.ref_value, colour: G.C.UI.TEXT_DARK, scale: 0.4 } },
      ] });
    } else {
      rows.push({ n: G.UIT.R, config: { align: 'cm', padding: 0.03 }, nodes: [
        { n: G.UIT.T, config: { text: line, colour: G.C.UI.TEXT_DARK, scale: 0.4 } },
      ] });
    }
  }
  if (tooltip.filler) rows.push(tooltip.filler.func(tooltip.filler.args));
  return { n: G.UIT.ROOT, config: { align: 'cm', padding: 0.05, r: 0.1, colour: G.C.RED, emboss: 0.05 }, nodes: [
    { n: G.UIT.C, config: { align: 'cm', padding: 0.05, r: 0.1, colour: G.C.WHITE, emboss: 0.05 }, nodes: rows },
  ] };
}

/** attention_text: a popping message over a node (or covering it), that fades away */
export function attention_text(args: any = {}) {
  args.text = args.text ?? 'test';
  args.scale = args.scale ?? 1;
  args.colour = copy_table(args.colour ?? G.C.WHITE);
  args.hold = (args.hold ?? 0) + 0.1 * G.SPEEDFACTOR;
  args.pos = args.pos ?? { x: 0, y: 0 };
  args.align = args.align ?? 'cm';
  args.fade = 1;
  if (args.cover) {
    args.cover_colour = copy_table(args.cover_colour ?? G.C.RED);
    args.cover_colour_l = copy_table(lighten(args.cover_colour, 0.2));
    args.cover_colour_d = copy_table(darken(args.cover_colour, 0.2));
  } else {
    args.cover_colour = copy_table(G.C.CLEAR);
  }
  args.uibox_config = { align: args.align ?? 'cm', offset: args.offset ?? { x: 0, y: 0 }, major: args.cover ?? args.major ?? null };
  G.E_MANAGER.add_event(new Event({
    trigger: 'after', delay: 0, blockable: false, blocking: false,
    func: () => {
      args.AT = new UIBox({
        T: [args.pos.x, args.pos.y, 0, 0],
        definition: { n: G.UIT.ROOT, config: {
          align: args.cover_align ?? 'cm', minw: (args.cover ? args.cover.T.w : 0.001) + (args.cover_padding ?? 0),
          minh: (args.cover ? args.cover.T.h : 0.001) + (args.cover_padding ?? 0), padding: 0.03, r: 0.1, emboss: args.emboss, colour: args.cover_colour,
        }, nodes: [
          { n: G.UIT.O, config: { draw_layer: 1, object: new DynaText({ scale: args.scale, string: args.text, maxw: args.maxw, colours: [args.colour], float: true, shadow: true, silent: !args.noisy, pop_in: 0, pop_in_rate: 6, rotate: args.rotate ?? null }) } },
        ] },
        config: args.uibox_config,
      });
      args.AT.attention_text = true;
      args.text = args.AT.UIRoot.children[0].config.object;
      args.text.pulse(0.5);
      if (args.cover) {
        new Particles(args.pos.x, args.pos.y, 0, 0, {
          timer_type: 'TOTAL', timer: 0.01, pulse_max: 15, max: 0, scale: 0.3, vel_variation: 0.2, padding: 0.1, fill: true,
          lifespan: 0.5, speed: 2.5, attach: args.AT.UIRoot, colours: [args.cover_colour, args.cover_colour_l, args.cover_colour_d],
        });
      }
      if (args.backdrop_colour) {
        args.backdrop_colour = copy_table(args.backdrop_colour);
        new Particles(args.pos.x, args.pos.y, 0, 0, {
          timer_type: 'TOTAL', timer: 5, scale: 2.4 * (args.backdrop_scale ?? 1), lifespan: 5, speed: 0, attach: args.AT, colours: [args.backdrop_colour],
        });
      }
      return true;
    },
  }));
  G.E_MANAGER.add_event(new Event({
    trigger: 'after', delay: args.hold, blockable: false, blocking: false,
    func: () => {
      if (!args.start_time) {
        args.start_time = G.TIMERS.TOTAL;
        args.text.pop_out(3);
      } else {
        args.fade = Math.max(0, 1 - 3 * (G.TIMERS.TOTAL - args.start_time));
        if (args.cover_colour) args.cover_colour[3] = Math.min(args.cover_colour[3], 2 * args.fade);
        if (args.cover_colour_l) args.cover_colour_l[3] = Math.min(args.cover_colour_l[3], args.fade);
        if (args.cover_colour_d) args.cover_colour_d[3] = Math.min(args.cover_colour_d[3], args.fade);
        if (args.backdrop_colour) args.backdrop_colour[3] = Math.min(args.backdrop_colour[3], args.fade);
        args.colour[3] = Math.min(args.colour[3], args.fade);
        if (args.fade <= 0) {
          args.AT.remove();
          return true;
        }
      }
      return false;
    },
  }));
}

