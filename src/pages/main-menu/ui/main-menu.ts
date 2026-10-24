// The main menu: Game:main_menu (game.lua), set_main_menu_UI
// (common_events.lua) and its buttons (UI_definitions.lua).
import {
  G, Sprite, UIBox, Event, prep_stage, ease_value, ease_background_colour, play_sound, delay, mix_colours, math_random,
  RESET_STATES,
} from '@/shared/lib/engine';
import { localize } from '@/shared/lib/localization';
import { UIBox_button } from '@/shared/ui';
import { Card, CardArea } from '@/entities/card';
import { Back } from '@/entities/back';
import { init_game_object } from '@/entities/run';
import { fetch_saved_game } from '@/widgets/run-setup';

function create_UIBox_main_menu_buttons() {
  const text_scale = 0.45;
  let language: any = null;
  if (!G.F_ENGLISH_ONLY) {
    language = new Sprite(0, 0, 0.6, 0.6, G.ASSET_ATLAS.icons, { x: 2, y: 0 });
    language.states.drag.can = false;
  }
  return {
    n: G.UIT.ROOT, config: { align: 'cm', colour: G.C.CLEAR }, nodes: [
      { n: G.UIT.C, config: { align: 'bm' }, nodes: [
        { n: G.UIT.R, config: { align: 'cm', padding: 0.2, r: 0.1, emboss: 0.1, colour: G.C.L_BLACK, mid: true }, nodes: [
          UIBox_button({ id: 'main_menu_play', button: 'setup_run', colour: G.C.BLUE, minw: 3.65, minh: 1.55, label: [localize('b_play_cap')], scale: text_scale * 2, col: true }),
          { n: G.UIT.C, config: { align: 'cm' }, nodes: [
            UIBox_button({ button: 'options', colour: G.C.ORANGE, minw: 2.65, minh: 1.35, label: [localize('b_options_cap')], scale: text_scale * 1.2, col: true }),
            G.F_QUIT_BUTTON ? { n: G.UIT.C, config: { align: 'cm', minw: 0.2 }, nodes: [] } : null,
            G.F_QUIT_BUTTON ? UIBox_button({ button: 'quit', colour: G.C.RED, minw: 2.65, minh: 1.35, label: [localize('b_quit_cap')], scale: text_scale * 1.2, col: true }) : null,
          ] },
          UIBox_button({ id: 'collection_button', button: 'your_collection', colour: G.C.PALE_GREEN, minw: 3.65, minh: 1.55, label: [localize('b_collection_cap')], scale: text_scale * 1.5, col: true }),
        ] },
      ] },
      { n: G.UIT.C, config: { align: 'br', minw: 3.2, padding: 0.1 }, nodes: [
        !G.F_ENGLISH_ONLY ? { n: G.UIT.R, config: { align: 'cm', padding: 0.2, r: 0.1, emboss: 0.1, colour: G.C.L_BLACK }, nodes: [
          { n: G.UIT.R, config: { align: 'cm', padding: 0.15, minw: 1, r: 0.1, hover: true, colour: mix_colours(G.C.WHITE, G.C.GREY, 0.2), button: 'language_selection', shadow: true }, nodes: [
            { n: G.UIT.O, config: { object: language } },
            { n: G.UIT.T, config: { text: G.LANG.label, scale: 0.4, colour: G.C.UI.TEXT_LIGHT, shadow: true } },
          ] },
        ] } : null,
      ] },
    ],
  };
}

function create_UIBox_profile_button() {
  if (!G.PROFILES[G.SETTINGS.profile - 1].name) G.PROFILES[G.SETTINGS.profile - 1].name = 'P' + G.SETTINGS.profile;
  return { n: G.UIT.ROOT, config: { align: 'cm', colour: G.C.CLEAR }, nodes: [
    { n: G.UIT.R, config: { align: 'cm', padding: 0.2, r: 0.1, emboss: 0.1, colour: G.C.L_BLACK }, nodes: [
      { n: G.UIT.R, config: { align: 'cm' }, nodes: [{ n: G.UIT.T, config: { text: localize('k_profile'), scale: 0.4, colour: G.C.UI.TEXT_LIGHT, shadow: true } }] },
      { n: G.UIT.R, config: { align: 'cm' }, nodes: [
        { n: G.UIT.C, config: { align: 'cm', padding: 0.15, minw: 2, minh: 0.8, maxw: 2, r: 0.1, hover: true, colour: mix_colours(G.C.WHITE, G.C.GREY, 0.2), button: 'profile_select', shadow: true }, nodes: [
          { n: G.UIT.T, config: { ref_table: G.PROFILES[G.SETTINGS.profile - 1], ref_value: 'name', scale: 0.4, colour: G.C.UI.TEXT_LIGHT, shadow: true } },
        ] },
      ] },
    ] },
  ] };
}

function set_main_menu_UI() {
  G.MAIN_MENU_UI = new UIBox({
    definition: create_UIBox_main_menu_buttons(),
    config: { align: 'bmi', offset: { x: 0, y: 10 }, major: G.ROOM_ATTACH, bond: 'Weak' },
  });
  G.MAIN_MENU_UI.alignment.offset.y = 0;
  G.MAIN_MENU_UI.align_to_major();
  G.E_MANAGER.add_event(new Event({
    blockable: false, blocking: false,
    func: () => {
      G.PROFILE_BUTTON = new UIBox({
        definition: create_UIBox_profile_button(),
        config: { align: 'bli', offset: { x: -10, y: 0 }, major: G.ROOM_ATTACH, bond: 'Weak' },
      });
      G.PROFILE_BUTTON.alignment.offset.x = 0;
      G.PROFILE_BUTTON.align_to_major();
      return true;
    },
  }));
}

/** Game:main_menu: change_context is 'splash' after the splash screen, 'game' when leaving a run */
export function main_menu(change_context?: 'splash' | 'game') {
  if (change_context !== 'splash') {
    G.TIMERS.REAL = 12;
    G.TIMERS.TOTAL = 12;
  } else {
    RESET_STATES(G.STATES.MENU);
  }
  prep_stage(G.STAGES.MAIN_MENU, G.STATES.MENU, init_game_object);
  G.STAGE_UPDATE = null;
  fetch_saved_game();
  G.GAME.selected_back = new Back(G.P_CENTERS.b_red);
  G.FUNCS.change_shadows?.({ to_key: G.SETTINGS.GRAPHICS.shadows === 'On' ? 1 : 2 });
  ease_background_colour({ new_colour: G.C.BLACK, contrast: 1 });
  if (G.SPLASH_FRONT) { G.SPLASH_FRONT.remove(); G.SPLASH_FRONT = null; }
  if (G.SPLASH_BACK) { G.SPLASH_BACK.remove(); G.SPLASH_BACK = null; }
  G.SPLASH_BACK = new Sprite(-30, -13, G.ROOM.T.w + 60, G.ROOM.T.h + 22, G.ASSET_ATLAS.ui_1, { x: 2, y: 0 });
  G.SPLASH_BACK.set_alignment({ major: G.ROOM_ATTACH, type: 'cm', offset: { x: 0, y: 0 } });
  const splash_args = { mid_flash: change_context === 'splash' ? 1.6 : 0 };
  ease_value(splash_args, 'mid_flash', -(change_context === 'splash' ? 1.6 : 0), undefined, undefined, undefined, 4);
  G.SPLASH_BACK.define_draw_steps([{
    shader: 'splash',
    send: [
      { name: 'time', ref_table: G.TIMERS, ref_value: 'REAL_SHADER' },
      { name: 'vort_speed', val: 0.4 },
      { name: 'colour_1', ref_table: G.C, ref_value: 'RED' },
      { name: 'colour_2', ref_table: G.C, ref_value: 'BLUE' },
      { name: 'mid_flash', ref_table: splash_args, ref_value: 'mid_flash' },
      { name: 'vort_offset', val: 0 },
    ],
  }]);

  const SC_scale = 1.1;
  G.title_top = new CardArea(0, 0, G.CARD_W, G.CARD_H, { card_limit: 1, type: 'title' });
  G.SPLASH_LOGO = new Sprite(0, 0, 13 * SC_scale, 13 * SC_scale * (G.ASSET_ATLAS.balatro.py / G.ASSET_ATLAS.balatro.px), G.ASSET_ATLAS.balatro, { x: 0, y: 0 });
  G.SPLASH_LOGO.set_alignment({ major: G.title_top, type: 'cm', bond: 'Strong', offset: { x: 0, y: 0 } });
  G.SPLASH_LOGO.define_draw_steps([{ shader: 'dissolve' }]);
  G.SPLASH_LOGO.dissolve_colours = [G.C.WHITE, G.C.WHITE];
  G.SPLASH_LOGO.dissolve = 1;

  const replace_card = new Card(G.title_top.T.x, G.title_top.T.y, 1.2 * G.CARD_W * SC_scale, 1.2 * G.CARD_H * SC_scale, G.P_CARDS.S_A, G.P_CENTERS.c_base);
  G.title_top.emplace(replace_card);
  replace_card.states.visible = false;
  replace_card.no_ui = true;
  replace_card.ambient_tilt = 0.0;

  G.E_MANAGER.add_event(new Event({
    trigger: 'after', delay: change_context === 'game' ? 1.5 : 0, blockable: false, blocking: false,
    func: () => {
      if (change_context === 'splash') {
        replace_card.states.visible = true;
        replace_card.start_materialize([G.C.WHITE, G.C.WHITE], true, 2.5);
        play_sound('whoosh1', Math.random() * 0.1 + 0.3, 0.3);
        play_sound('crumple' + math_random(1, 5), Math.random() * 0.2 + 0.6, 0.65);
      } else {
        replace_card.states.visible = true;
        replace_card.start_materialize([G.C.WHITE, G.C.WHITE], undefined, 1.2);
      }
      G.VIBRATION += 1;
      return true;
    },
  }));
  G.E_MANAGER.add_event(new Event({
    trigger: 'after', delay: change_context === 'splash' ? 1.8 : change_context === 'game' ? 2 : 0.5, blockable: false, blocking: false,
    func: () => {
      play_sound('magic_crumple' + (change_context === 'splash' ? 2 : 3), change_context === 'splash' ? 1 : 1.3, 0.9);
      play_sound('whoosh1', 0.4, 0.8);
      ease_value(G.SPLASH_LOGO, 'dissolve', -1, undefined, undefined, undefined, change_context === 'splash' ? 2.3 : 0.9);
      G.VIBRATION += 1.5;
      return true;
    },
  }));
  delay(0.1 + (change_context === 'splash' ? 2 : change_context === 'game' ? 1.5 : 0));

  // with every joker unlocked, the game swaps the Ace for a random locked card: there are none
  G.E_MANAGER.add_event(new Event({ func: () => { G.CONTROLLER.lock_input = false; return true; } }));
  G.title_top.T.x = G.TILE_W / 2 - G.title_top.T.w / 2;
  G.title_top.T.y = G.TILE_H / 2 - G.title_top.T.h / 2 - 1.2;
  G.title_top.hard_set_VT();
  G.title_top.sort('order');
  G.title_top.set_ranks();
  G.title_top.align_cards();
  G.title_top.hard_set_cards();

  G.E_MANAGER.add_event(new Event({
    trigger: 'after', delay: change_context === 'splash' ? 4.05 : change_context === 'game' ? 3 : 1.5, blockable: false, blocking: false,
    func: () => { set_main_menu_UI(); return true; },
  }));

  new UIBox({
    definition: { n: G.UIT.ROOT, config: { align: 'cm', colour: G.C.UI.TRANSPARENT_DARK }, nodes: [
      { n: G.UIT.T, config: { text: G.VERSION, scale: 0.3, colour: G.C.UI.TEXT_LIGHT } },
    ] },
    config: { align: 'tri', offset: { x: 0, y: 0 }, major: G.ROOM_ATTACH, bond: 'Weak' },
  });
}
