// The run setup overlay (UI_definitions.lua: G.UIDEF.run_setup,
// run_setup_option, stake_option, viewed_stake_option, stake_description,
// deck_stake_column) and its callbacks (button_callbacks.lua: setup_run,
// can_continue, change_viewed_back, change_stake, RUN_SETUP_*,
// toggle_seeded_run, can_start_run, start_setup_run). "Continue" opens the
// API's most recent unfinished run.
import { G, UIBox, DynaText, Moveable, tostring, number_format, scale_number, pseudorandom_element } from '@/shared/lib/engine';
import { localize } from '@/shared/lib/localization';
import {
  create_UIBox_generic_options, create_tabs, create_option_cycle, create_toggle, create_text_input, UIBox_button, simple_text_container,
} from '@/shared/ui';
import { get_stake_sprite, get_stake_col } from '@/shared/ui/stake';
import { get_deck_win_stake, profile, save_memory } from '@/shared/config';
import { api, type GameSummaryView } from '@/shared/api';
import { Card, CardArea } from '@/entities/card';
import { Back } from '@/entities/back';

/** the latest unfinished run, fetched when the main menu shows */
export const saved = { game: null as GameSummaryView | null };

export function fetch_saved_game() {
  api.listGames(5).then((list) => {
    saved.game = list.find((g) => g.phase !== 'game_over') ?? null;
  }).catch(() => { saved.game = null; });
}

function stake_description(_stake: number) {
  const _stake_center = G.P_CENTER_POOLS.Stake[_stake - 1];
  const ret_nodes: any[] = [];
  if (_stake_center) localize({ type: 'descriptions', key: _stake_center.key, set: _stake_center.set, nodes: ret_nodes });
  const desc_t = ret_nodes.map((v) => ({ n: G.UIT.R, config: { align: 'cm', maxw: 5.3 }, nodes: v }));
  return { n: G.UIT.C, config: { align: 'cm', padding: 0.05, r: 0.1, colour: G.C.L_BLACK }, nodes: [
    { n: G.UIT.R, config: { align: 'cm', padding: 0 }, nodes: [
      { n: G.UIT.T, config: { text: localize({ type: 'name_text', key: _stake_center.key, set: _stake_center.set }), scale: 0.35, colour: G.C.WHITE } },
    ] },
    { n: G.UIT.R, config: { align: 'cm', padding: 0.03, colour: G.C.WHITE, r: 0.1, minh: 1, minw: 5.5 }, nodes: desc_t },
  ] };
}

function stake_option(_type: string) {
  const middle = { n: G.UIT.R, config: { align: 'cm', minh: 1.7, minw: 7.3 }, nodes: [
    { n: G.UIT.O, config: { id: null, func: 'RUN_SETUP_check_stake2', object: new Moveable() } },
  ] };
  let max_stake = get_deck_win_stake(G.GAME.viewed_back.effect.center.key);
  if (profile().all_unlocked) max_stake = 8;
  const stake_options: number[] = [];
  for (let i = 1; i <= Math.min(max_stake + 1, 8); i++) stake_options.push(i);
  return { n: G.UIT.ROOT, config: { align: 'tm', colour: G.C.CLEAR, minh: 2.03, minw: 8.3 }, nodes: [
    _type === 'Continue' ? middle : create_option_cycle({ options: stake_options, opt_callback: 'change_stake', current_option: G.viewed_stake, colour: G.C.RED, w: 6, mid: middle }),
  ] };
}

function viewed_stake_option() {
  G.viewed_stake = G.viewed_stake ?? 1;
  let max_stake = get_deck_win_stake(G.GAME.viewed_back.effect.center.key);
  if (profile().all_unlocked) max_stake = 8;
  // (not a continued run's stake: a run from before progress was kept may be above it)
  if (G.SETTINGS.current_setup !== 'Continue') {
    G.viewed_stake = Math.min(max_stake + 1, G.viewed_stake);
    profile().MEMORY.stake = G.viewed_stake;
    save_memory();
  }
  const stake_sprite = get_stake_sprite(G.viewed_stake);
  return { n: G.UIT.ROOT, config: { align: 'cm', colour: G.C.BLACK, r: 0.1 }, nodes: [
    { n: G.UIT.C, config: { align: 'cm', padding: 0 }, nodes: [
      { n: G.UIT.T, config: { text: localize('k_stake'), scale: 0.4, colour: G.C.L_BLACK, vert: true } },
    ] },
    { n: G.UIT.C, config: { align: 'cm', padding: 0.1 }, nodes: [
      { n: G.UIT.C, config: { align: 'cm', padding: 0 }, nodes: [
        { n: G.UIT.O, config: { colour: G.C.BLUE, object: stake_sprite, hover: true, can_collide: false } },
      ] },
      stake_description(G.viewed_stake),
    ] },
  ] };
}

export function deck_stake_column(_deck_key: string) {
  const deck_usage = profile().deck_usage[_deck_key];
  const stake_col: any[] = [];
  let valid_option = false;
  const n = G.P_CENTER_POOLS.Stake.length;
  for (let i = n; i >= 1; i--) {
    const _wins = deck_usage?.wins?.[i] ?? 0;
    if ((deck_usage && deck_usage.wins?.[i - 1]) || i === 1 || profile().all_unlocked) valid_option = true;
    stake_col.push({ n: G.UIT.R, config: { id: i, align: 'cm', colour: _wins > 0 ? G.C.GREY : G.C.CLEAR, outline: 0, outline_colour: G.C.WHITE, r: 0.1, minh: 0.25, minw: valid_option ? 0.45 : 0.25, func: 'RUN_SETUP_check_back_stake_highlight' }, nodes: [
      { n: G.UIT.R, config: { align: 'cm', minh: valid_option ? 0.17 : 0.13, minw: valid_option ? 0.37 : 0.13, colour: _wins > 0 ? get_stake_col(i) : G.C.UI.TRANSPARENT_LIGHT, r: 0.1 }, nodes: [] },
    ] });
    if (i > 1) stake_col.push({ n: G.UIT.R, config: { align: 'cm', minh: 0.1, minw: 0.04 }, nodes: [] });
  }
  return { n: G.UIT.ROOT, config: { align: 'cm', colour: G.C.CLEAR }, nodes: stake_col };
}

function run_setup_option(type: string) {
  G.SETTINGS.current_setup = type;
  const mem = profile().MEMORY;
  const back_center = G.P_CENTER_POOLS.Back.find((b: any) => b.name === mem.deck) ?? G.P_CENTERS.b_red;
  G.GAME.viewed_back = new Back(back_center);
  const sg = saved.game;
  if (type === 'Continue') {
    G.viewed_stake = 1;
    if (sg) {
      G.GAME.viewed_back.change_to(G.P_CENTERS[sg.settings.deck] ?? G.P_CENTERS.b_red);
      G.viewed_stake = sg.settings.stake ?? 1;
    }
  }
  if (type === 'New Run') {
    if (G.OVERLAY_MENU) {
      const seed_toggle = G.OVERLAY_MENU.get_UIE_by_ID('run_setup_seed');
      if (seed_toggle) seed_toggle.states.visible = true;
    }
    // (a stake remembered in this browser may be above what the deck offers now)
    const max_stake = profile().all_unlocked ? 8 : get_deck_win_stake(G.GAME.viewed_back.effect.center.key);
    G.viewed_stake = Math.min(mem.stake ?? 1, max_stake + 1);
    G.FUNCS.change_stake({ to_key: G.viewed_stake });
  } else {
    G.run_setup_seed = null;
    if (G.OVERLAY_MENU) {
      const seed_toggle = G.OVERLAY_MENU.get_UIE_by_ID('run_setup_seed');
      if (seed_toggle) seed_toggle.states.visible = false;
    }
  }
  const area = new CardArea(G.ROOM.T.x + 0.2 * G.ROOM.T.w / 2, G.ROOM.T.h, G.CARD_W, G.CARD_H, { card_limit: 5, type: 'deck', highlight_limit: 0, deck_height: 0.75, thin_draw: 1 });
  for (let i = 1; i <= 10; i++) {
    const card = new Card(G.ROOM.T.x + 0.2 * G.ROOM.T.w / 2, G.ROOM.T.h, G.CARD_W, G.CARD_H, pseudorandom_element(G.P_CARDS)[0], G.P_CENTERS.c_base, { playing_card: i, viewed_back: true });
    card.sprite_facing = 'back';
    card.facing = 'back';
    area.emplace(card);
    if (i === 10) { G.sticker_card = card; card.sticker = undefined; }
  }
  const ordered_names: string[] = [];
  let viewed_deck = 1;
  G.P_CENTER_POOLS.Back.forEach((v: any, k: number) => {
    ordered_names.push(v.name);
    if (v.name === G.GAME.viewed_back.name) viewed_deck = k + 1;
  });
  const lwidth = 1.4, rwidth = 1.8;
  const scale = 0.39;
  G.setup_seed = '';
  const row = (label: string, value: string, colour: any, s = 0.8 * scale) => ({ n: G.UIT.R, config: { align: 'cm' }, nodes: [
    { n: G.UIT.C, config: { align: 'cm', minw: lwidth, maxw: lwidth }, nodes: [{ n: G.UIT.T, config: { text: label, colour: G.C.UI.TEXT_DARK, scale: scale * 0.8 } }] },
    { n: G.UIT.C, config: { align: 'cm' }, nodes: [{ n: G.UIT.T, config: { text: ': ', colour: G.C.UI.TEXT_DARK, scale: scale * 0.8 } }] },
    { n: G.UIT.C, config: { align: 'cl', minw: rwidth, maxw: lwidth }, nodes: [{ n: G.UIT.T, config: { text: value, colour, scale: s } }] },
  ] });
  const best = Number(localStorage_get('balatro-fe.best.' + (sg?.id ?? '')) ?? 0);
  const deck_column = { n: G.UIT.C, config: { align: 'cm' }, nodes: [
    { n: G.UIT.O, config: { id: G.GAME.viewed_back.name, func: 'RUN_SETUP_check_back_stake_column', object: new UIBox({ definition: deck_stake_column(G.GAME.viewed_back.effect.center.key), config: { offset: { x: 0, y: 0 } } }) } },
  ] };
  return { n: G.UIT.ROOT, config: { align: 'cm', colour: G.C.CLEAR, minh: 6.6, minw: 6 }, nodes: [
    type === 'Continue'
      ? { n: G.UIT.R, config: { align: 'tm', minh: 3.8, padding: 0.15 }, nodes: [
        { n: G.UIT.R, config: { align: 'cm', minh: 3.3, minw: 6.8 }, nodes: [
          { n: G.UIT.C, config: { align: 'cm', colour: G.C.BLACK, padding: 0.15, r: 0.1, emboss: 0.05 }, nodes: [
            { n: G.UIT.C, config: { align: 'cm' }, nodes: [{ n: G.UIT.R, config: { align: 'cm', shadow: false }, nodes: [{ n: G.UIT.O, config: { object: area } }] }] },
            { n: G.UIT.C, config: { align: 'cm', minw: 4, maxw: 4, minh: 1.7, r: 0.1, colour: G.C.L_BLACK, padding: 0.1 }, nodes: [
              { n: G.UIT.R, config: { align: 'cm', r: 0.1, minw: 4, maxw: 4, minh: 0.6 }, nodes: [
                { n: G.UIT.O, config: { id: null, func: 'RUN_SETUP_check_back_name', object: new Moveable() } },
              ] },
              { n: G.UIT.R, config: { align: 'cm', colour: G.C.WHITE, padding: 0.03, minh: 1.75, r: 0.1 }, nodes: [
                row(localize('k_round'), tostring(sg?.round ?? 0), G.C.RED),
                row(localize('k_ante'), tostring(sg?.ante ?? 1), G.C.BLUE),
                row(localize('k_money'), localize('$') + tostring(sg?.dollars ?? 0), G.C.ORANGE),
                row(localize('k_best_hand'), number_format(best), G.C.RED, scale_number(best, 0.8 * scale)),
                sg && localStorage_get('balatro-fe.seeded.' + sg.id) ? row(localize('k_seed'), tostring(sg.settings.seed), G.C.RED) : null,
              ] },
            ] },
            deck_column,
          ] },
        ] },
      ] }
      : { n: G.UIT.R, config: { align: 'cm', minh: 3.8 }, nodes: [
        create_option_cycle({ options: ordered_names, opt_callback: 'change_viewed_back', current_option: viewed_deck, colour: G.C.RED, w: 3.5, mid:
          { n: G.UIT.R, config: { align: 'cm', minh: 3.3, minw: 5 }, nodes: [
            { n: G.UIT.C, config: { align: 'cm', colour: G.C.BLACK, padding: 0.15, r: 0.1, emboss: 0.05 }, nodes: [
              { n: G.UIT.C, config: { align: 'cm' }, nodes: [{ n: G.UIT.R, config: { align: 'cm', shadow: false }, nodes: [{ n: G.UIT.O, config: { object: area } }] }] },
              { n: G.UIT.C, config: { align: 'cm', minh: 1.7, r: 0.1, colour: G.C.L_BLACK, padding: 0.1 }, nodes: [
                { n: G.UIT.R, config: { align: 'cm', r: 0.1, minw: 4, maxw: 4, minh: 0.6 }, nodes: [
                  { n: G.UIT.O, config: { id: null, func: 'RUN_SETUP_check_back_name', object: new Moveable() } },
                ] },
                { n: G.UIT.R, config: { align: 'cm', colour: G.C.WHITE, minh: 1.7, r: 0.1 }, nodes: [
                  { n: G.UIT.O, config: { id: G.GAME.viewed_back.name, func: 'RUN_SETUP_check_back', object: new UIBox({ definition: G.GAME.viewed_back.generate_UI(), config: { offset: { x: 0, y: 0 } } }) } },
                ] },
              ] },
              deck_column,
            ] },
          ] },
        }),
      ] },
    { n: G.UIT.R, config: { align: 'cm' }, nodes: [
      type === 'Continue'
        ? { n: G.UIT.R, config: { align: 'cm', minh: 2.2, minw: 5 }, nodes: [
          { n: G.UIT.R, config: { align: 'cm', minh: 0.17 }, nodes: [] },
          { n: G.UIT.R, config: { align: 'cm' }, nodes: [
            { n: G.UIT.O, config: { id: null, func: 'RUN_SETUP_check_stake', insta_func: true, object: new Moveable() } },
          ] },
        ] }
        : { n: G.UIT.R, config: { align: 'cm', minh: 2.2, minw: 6.8 }, nodes: [
          { n: G.UIT.O, config: { id: null, func: 'RUN_SETUP_check_stake', insta_func: true, object: new Moveable() } },
        ] },
    ] },
    { n: G.UIT.R, config: { align: 'cm', padding: 0.05, minh: 0.9 }, nodes: [
      { n: G.UIT.O, config: { align: 'cm', func: 'toggle_seeded_run', object: new Moveable() }, nodes: [] },
    ] },
    { n: G.UIT.R, config: { align: 'cm', padding: 0 }, nodes: [
      { n: G.UIT.C, config: { align: 'cm', minw: 2.4, id: 'run_setup_seed' }, nodes: [
        type === 'New Run' ? create_toggle({ col: true, label: localize('k_seeded_run'), label_scale: 0.25, w: 0, scale: 0.7, ref_table: G, ref_value: 'run_setup_seed' }) : null,
      ] },
      { n: G.UIT.C, config: { align: 'cm', minw: 5, minh: 0.8, padding: 0.2, r: 0.1, hover: true, colour: G.C.BLUE, button: 'start_setup_run', shadow: true, func: 'can_start_run' }, nodes: [
        { n: G.UIT.R, config: { align: 'cm', padding: 0 }, nodes: [
          { n: G.UIT.T, config: { text: localize('b_play_cap'), scale: 0.8, colour: G.C.UI.TEXT_LIGHT, func: 'set_button_pip', focus_args: { button: 'x', set_button_pip: true } } },
        ] },
      ] },
      { n: G.UIT.C, config: { align: 'cm', minw: 2.5 }, nodes: [] },
    ] },
  ] };
}

function localStorage_get(k: string) {
  try { return localStorage.getItem(k); } catch { return null; }
}

export function run_setup(from_game_over?: string | false) {
  G.run_setup_seed = null;
  const _challenge_chosen = from_game_over === 'challenge_list';
  const fgo = from_game_over && from_game_over !== 'challenge_list';
  const _can_continue = !!G.MAIN_MENU_UI && !!saved.game;
  G.FUNCS.false_ret = () => false;
  const tabs = [
    { label: localize('b_new_run'), chosen: !_challenge_chosen && !_can_continue, tab_definition_function: run_setup_option, tab_definition_function_args: 'New Run' },
    G.STAGE === G.STAGES.MAIN_MENU
      ? { label: localize('b_continue'), chosen: !_challenge_chosen && _can_continue, tab_definition_function: run_setup_option, tab_definition_function_args: 'Continue', func: 'can_continue' }
      : { label: localize('b_challenges'), tab_definition_function: G.UIDEF.challenges, tab_definition_function_args: fgo, chosen: _challenge_chosen },
    G.STAGE === G.STAGES.MAIN_MENU
      ? { label: localize('b_challenges'), tab_definition_function: G.UIDEF.challenges, tab_definition_function_args: fgo, chosen: _challenge_chosen }
      : null,
  ].filter((x) => x);
  return create_UIBox_generic_options({ no_back: fgo, no_esc: fgo, contents: [
    { n: G.UIT.R, config: { align: 'cm', padding: 0, draw_layer: 1 }, nodes: [
      create_tabs({ tabs, snap_to_nav: true }),
    ] },
  ] });
}

export function register_run_setup_funcs() {
  G.UIDEF.run_setup = run_setup;
  G.UIDEF.run_setup_option = run_setup_option;
  G.UIDEF.stake_option = stake_option;
  G.UIDEF.viewed_stake_option = viewed_stake_option;
  G.UIDEF.deck_stake_column = deck_stake_column;

  G.FUNCS.setup_run = (e: any) => {
    G.SETTINGS.paused = true;
    const id = e?.config?.id;
    const from = (id === 'from_game_over' || id === 'from_game_won' || id === 'challenge_list') ? id : false;
    G.FUNCS.overlay_menu({ definition: run_setup(from) });
    if (id === 'from_game_over' || id === 'from_game_won') G.OVERLAY_MENU.config.no_esc = true;
  };

  G.FUNCS.can_continue = (e: any) => {
    if (e.config.func) {
      const ok = !!saved.game;
      if (!ok) { e.config.colour = G.C.UI.BACKGROUND_INACTIVE; e.config.button = null; }
      e.config.func = null;
      return ok;
    }
    return undefined;
  };

  G.FUNCS.change_viewed_back = (args: any) => {
    G.viewed_stake = G.viewed_stake ?? 1;
    G.GAME.viewed_back.change_to(G.P_CENTER_POOLS.Back[args.to_key - 1]);
    const max_stake = get_deck_win_stake(G.GAME.viewed_back.effect.center.key);
    G.viewed_stake = Math.min(G.viewed_stake, max_stake + 1);
    profile().MEMORY.deck = args.to_val;
    save_memory();
  };

  G.FUNCS.change_stake = (args: any) => {
    G.viewed_stake = args.to_key;
    profile().MEMORY.stake = args.to_key;
    save_memory();
  };

  G.FUNCS.RUN_SETUP_check_back = (e: any) => {
    if (G.GAME.viewed_back.name !== e.config.id) {
      e.config.object.remove();
      e.config.object = new UIBox({ definition: G.GAME.viewed_back.generate_UI(), config: { offset: { x: 0, y: 0 }, align: 'cm', parent: e } });
      e.config.id = G.GAME.viewed_back.name;
    }
  };

  G.FUNCS.RUN_SETUP_check_back_name = (e: any) => {
    if (e.config.object && G.GAME.viewed_back.name !== e.config.id) {
      e.config.object.remove();
      e.config.object = new UIBox({
        definition: { n: G.UIT.ROOT, config: { align: 'cm', colour: G.C.CLEAR }, nodes: [
          { n: G.UIT.O, config: { id: G.GAME.viewed_back.name, func: 'RUN_SETUP_check_back_name', object: new DynaText({ string: G.GAME.viewed_back.get_name(), maxw: 4, colours: [G.C.WHITE], shadow: true, bump: true, scale: 0.5, pop_in: 0, silent: true }) } },
        ] },
        config: { offset: { x: 0, y: 0 }, align: 'cm', parent: e },
      });
      e.config.id = G.GAME.viewed_back.name;
    }
  };

  G.FUNCS.RUN_SETUP_check_stake = (e: any) => {
    if (G.GAME.viewed_back.name !== e.config.id) {
      e.config.object.remove();
      e.config.object = new UIBox({ definition: stake_option(G.SETTINGS.current_setup), config: { offset: { x: 0, y: 0 }, align: 'tmi', parent: e } });
      e.config.id = G.GAME.viewed_back.name;
    }
  };

  G.FUNCS.RUN_SETUP_check_stake2 = (e: any) => {
    if (G.viewed_stake !== e.config.id) {
      e.config.object.remove();
      e.config.object = new UIBox({ definition: viewed_stake_option(), config: { offset: { x: 0, y: 0 }, align: 'cm', parent: e } });
      e.config.id = G.viewed_stake;
    }
  };

  G.FUNCS.RUN_SETUP_check_back_stake_column = (e: any) => {
    if (G.GAME.viewed_back.name !== e.config.id) {
      e.config.object.remove();
      e.config.object = new UIBox({ definition: deck_stake_column(G.GAME.viewed_back.effect.center.key), config: { offset: { x: 0, y: 0 }, align: 'cm', parent: e } });
      e.config.id = G.GAME.viewed_back.name;
    }
  };

  G.FUNCS.RUN_SETUP_check_back_stake_highlight = (e: any) => {
    if (G.viewed_stake === e.config.id && e.config.outline < 0.1) e.config.outline = 0.8;
    else if (G.viewed_stake !== e.config.id && e.config.outline > 0.1) e.config.outline = 0;
  };

  G.FUNCS.toggle_seeded_run = (e: any) => {
    if (e.config.object && !G.run_setup_seed) {
      e.config.object.remove();
      e.config.object = null;
    } else if (!e.config.object && G.run_setup_seed) {
      e.config.object = new UIBox({
        definition: { n: G.UIT.ROOT, config: { align: 'cm', colour: G.C.CLEAR }, nodes: [
          { n: G.UIT.C, config: { align: 'cm', minw: 2.5, padding: 0.05 }, nodes: [
            simple_text_container('ml_disabled_seed', { colour: G.C.UI.TEXT_LIGHT, scale: 0.26, shadow: true }),
          ] },
          { n: G.UIT.C, config: { align: 'cm', minw: 0.1 }, nodes: [
            create_text_input({ max_length: 8, all_caps: true, ref_table: G, ref_value: 'setup_seed', prompt_text: localize('k_enter_seed') }),
            { n: G.UIT.C, config: { align: 'cm', minw: 0.1 }, nodes: [] },
            UIBox_button({ label: localize('ml_paste_seed'), minw: 1, minh: 0.6, button: 'paste_seed', colour: G.C.BLUE, scale: 0.3, col: true }),
          ] },
          { n: G.UIT.C, config: { align: 'cm', minw: 2.5 }, nodes: [] },
        ] },
        config: { offset: { x: 0, y: 0 }, parent: e, type: 'cm' },
      });
      e.config.object.recalculate();
    }
  };

  G.FUNCS.can_start_run = (e: any) => {
    if (!G.GAME.viewed_back.effect.center.unlocked) {
      e.config.colour = G.C.UI.BACKGROUND_INACTIVE;
      e.config.button = null;
    } else {
      e.config.colour = G.C.BLUE;
      e.config.button = 'start_setup_run';
    }
  };

  G.FUNCS.start_setup_run = (_e: any) => {
    if (G.OVERLAY_MENU) G.FUNCS.exit_overlay_menu();
    if (G.SETTINGS.current_setup === 'New Run') {
      const seed = G.run_setup_seed && G.setup_seed ? String(G.setup_seed) : null;
      const deck = G.GAME.viewed_back.effect.center.key;
      G.FUNCS.start_run(null, { request: { seed, deck, stake: G.viewed_stake ?? 1, challenge: G.challenge_tab?.id ?? null, game_speed: G.SETTINGS.GAMESPEED } });
    } else if (G.SETTINGS.current_setup === 'Continue' && saved.game) {
      G.FUNCS.start_run(null, { open_id: saved.game.id, continue: true });
    }
  };
}
