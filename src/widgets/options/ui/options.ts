// The Options and Settings overlays (UI_definitions.lua: create_UIBox_options,
// create_UIBox_settings, G.UIDEF.settings_tab) and their callbacks
// (button_callbacks.lua: options, settings, change_gamespeed...).
import { G, tostring } from '@/shared/lib/engine';
import { localize } from '@/shared/lib/localization';
import { create_UIBox_generic_options, create_tabs, create_option_cycle, create_slider, create_toggle, UIBox_button } from '@/shared/ui';
import { save_settings } from '@/shared/config';
import { Card, CardArea } from '@/entities/card';

export function create_UIBox_options() {
  let current_seed: any = null, restart: any = null, main_menu: any = null, your_collection: any = null, credits: any = null;
  if (G.STAGE === G.STAGES.RUN) {
    restart = UIBox_button({ id: 'restart_button', label: [localize('b_start_new_run')], button: 'setup_run', minw: 5 });
    main_menu = UIBox_button({ label: [localize('b_main_menu')], button: 'go_to_menu', minw: 5 });
    your_collection = UIBox_button({ label: [localize('b_collection')], button: 'your_collection', minw: 5, id: 'your_collection' });
    current_seed = { n: G.UIT.R, config: { align: 'cm', padding: 0.05 }, nodes: [
      { n: G.UIT.C, config: { align: 'cm', padding: 0 }, nodes: [
        { n: G.UIT.T, config: { text: localize('b_seed') + ': ', scale: 0.4, colour: G.C.WHITE } },
      ] },
      { n: G.UIT.C, config: { align: 'cm', padding: 0, minh: 0.8 }, nodes: [
        { n: G.UIT.C, config: { align: 'cm', padding: 0, minh: 0.8 }, nodes: [
          { n: G.UIT.R, config: { align: 'cm', r: 0.1, colour: G.GAME.seeded ? G.C.RED : G.C.BLACK, minw: 1.8, minh: 0.5, padding: 0.1, emboss: 0.05 }, nodes: [
            { n: G.UIT.C, config: { align: 'cm' }, nodes: [
              { n: G.UIT.T, config: { text: tostring(G.GAME.pseudorandom.seed), scale: 0.43, colour: G.C.UI.TEXT_LIGHT, shadow: true } },
            ] },
          ] },
        ] },
      ] },
      UIBox_button({ col: true, button: 'copy_seed', label: [localize('b_copy')], colour: G.C.BLUE, scale: 0.3, minw: 1.3, minh: 0.5 }),
    ] };
  }
  if (G.STAGE === G.STAGES.MAIN_MENU) credits = UIBox_button({ label: [localize('b_credits')], button: 'show_credits', minw: 5 });
  const settings = UIBox_button({ button: 'settings', label: [localize('b_settings')], minw: 5, focus_args: { snap_to: true } });
  const high_scores = UIBox_button({ label: [localize('b_stats')], button: 'high_scores', minw: 5 });
  const customize = UIBox_button({ label: [localize('b_customize_deck')], button: 'customize_deck', minw: 5 });
  // (not in the game: bug reports of this browser version, features/bug-report)
  const report_bug = UIBox_button({ label: ['Report a bug'], button: 'report_bug', minw: 5, colour: G.C.RED });
  return create_UIBox_generic_options({ contents: [
    settings,
    G.GAME.seeded ? current_seed : null,
    restart,
    main_menu,
    high_scores,
    your_collection,
    customize,
    credits,
    report_bug,
  ].filter((x) => x) });
}

export function create_UIBox_settings() {
  const tabs: any[] = [
    { label: localize('b_set_game'), chosen: true, tab_definition_function: settings_tab, tab_definition_function_args: 'Game' },
    { label: localize('b_set_graphics'), tab_definition_function: settings_tab, tab_definition_function_args: 'Graphics' },
    { label: localize('b_set_audio'), tab_definition_function: settings_tab, tab_definition_function_args: 'Audio' },
  ];
  return create_UIBox_generic_options({ back_func: 'options', contents: [create_tabs({ tabs, tab_h: 7.05, tab_alignment: 'tm', snap_to_nav: true })] });
}

function settings_tab(tab: string) {
  const S = G.SETTINGS;
  if (tab === 'Game') {
    return { n: G.UIT.ROOT, config: { align: 'cm', padding: 0.05, colour: G.C.CLEAR }, nodes: [
      create_option_cycle({ label: localize('b_set_gamespeed'), scale: 0.8, options: [0.5, 1, 2, 4], opt_callback: 'change_gamespeed', current_option: S.GAMESPEED === 0.5 ? 1 : S.GAMESPEED === 4 ? 4 : S.GAMESPEED + 1 }),
      create_option_cycle({ w: 5, label: localize('b_set_play_discard_pos'), scale: 0.8, options: localize('ml_play_discard_pos_opt'), opt_callback: 'change_play_discard_position', current_option: S.play_button_pos }),
      create_slider({ label: localize('b_set_screenshake'), w: 4, h: 0.4, ref_table: S, ref_value: 'screenshake', min: 0, max: 100 }),
      create_toggle({ label: localize('ph_display_stickers'), ref_table: S, ref_value: 'run_stake_stickers' }),
      create_toggle({ label: localize('b_high_contrast_cards'), ref_table: S, ref_value: 'colourblind_option', callback: G.FUNCS.refresh_contrast_mode }),
      create_toggle({ label: localize('b_reduced_motion'), ref_table: S, ref_value: 'reduced_motion' }),
    ] };
  }
  if (tab === 'Audio') {
    return { n: G.UIT.ROOT, config: { align: 'cm', padding: 0.05, colour: G.C.CLEAR }, nodes: [
      create_slider({ label: localize('b_set_master_vol'), w: 5, h: 0.4, ref_table: S.SOUND, ref_value: 'volume', min: 0, max: 100 }),
      create_slider({ label: localize('b_set_music_vol'), w: 5, h: 0.4, ref_table: S.SOUND, ref_value: 'music_volume', min: 0, max: 100 }),
      create_slider({ label: localize('b_set_game_vol'), w: 5, h: 0.4, ref_table: S.SOUND, ref_value: 'game_sounds_volume', min: 0, max: 100 }),
    ] };
  }
  if (tab === 'Graphics') {
    return { n: G.UIT.ROOT, config: { align: 'cm', padding: 0.05, colour: G.C.CLEAR }, nodes: [
      create_option_cycle({ w: 4, scale: 0.8, label: localize('b_set_shadows'), options: localize('ml_shadow_opt'), opt_callback: 'change_shadows', current_option: S.GRAPHICS.shadows === 'On' ? 1 : 2 }),
      create_option_cycle({ w: 4, scale: 0.8, label: localize('b_set_pixel_smoothing'), options: localize('ml_smoothing_opt'), opt_callback: 'change_pixel_smoothing', current_option: S.GRAPHICS.texture_scaling }),
      create_slider({ label: localize('b_set_CRT'), w: 4, h: 0.4, ref_table: S.GRAPHICS, ref_value: 'crt', min: 0, max: 100 }),
      create_option_cycle({ w: 4, scale: 0.8, label: localize('b_set_CRT_bloom'), options: localize('ml_bloom_opt'), opt_callback: 'change_crt_bloom', current_option: S.GRAPHICS.bloom }),
    ] };
  }
  return { n: G.UIT.ROOT, config: { align: 'cm', padding: 0.05, colour: G.C.CLEAR, minh: 5, minw: 5 }, nodes: [] };
}

export function create_UIBox_customize_deck() {
  const suits = ['Spades', 'Hearts', 'Clubs', 'Diamonds'];
  return create_UIBox_generic_options({ back_func: 'options', contents: [
    { n: G.UIT.R, config: { align: 'cm', padding: 0 }, nodes: [
      create_tabs({ tabs: suits.map((s, i) => ({ label: localize(s, 'suits_plural'), chosen: i === 0, tab_definition_function: custom_deck_tab, tab_definition_function_args: s })), snap_to_nav: true, no_shoulders: true }),
    ] },
  ] });
}

function custom_deck_tab(_suit: string) {
  const t: any[] = [];
  const face_cards = new CardArea(0, 0, 4 * G.CARD_W, 1.4 * G.CARD_H, { card_limit: 3, type: 'title', highlight_limit: 0 });
  t.push({ n: G.UIT.R, config: { align: 'cm', colour: G.C.BLACK, r: 0.1, padding: 0.07, no_fill: true }, nodes: [{ n: G.UIT.O, config: { object: face_cards } }] });
  const raw = localize(_suit, 'collabs');
  const loc_options: string[] = [];
  for (const k of Object.keys(raw ?? {})) loc_options[Number(k) - 1] = raw[k];
  let current_option = 1;
  (G.COLLABS.options[_suit] as string[]).forEach((v, k) => { if (G.SETTINGS.CUSTOM_DECK.Collabs[_suit] === v) current_option = k + 1; });
  t.push({ n: G.UIT.R, config: { align: 'cm' }, nodes: [
    create_option_cycle({ options: loc_options, w: 5.5, cycle_shoulders: true, curr_suit: _suit, opt_callback: 'change_collab', current_option, colour: G.C.RED, focus_args: { snap_to: true, nav: 'wide' } }),
  ] });
  t.push(create_toggle({ label: localize('b_high_contrast_cards'), ref_table: G.SETTINGS, ref_value: 'colourblind_option', callback: G.FUNCS.refresh_contrast_mode }));
  for (const f of ['K', 'Q', 'J']) {
    const card: any = new Card(0, 0, G.CARD_W * 1.2, G.CARD_H * 1.2, G.P_CARDS[_suit.substring(0, 1) + '_' + f], G.P_CENTERS.c_base);
    card.no_ui = true;
    face_cards.emplace(card);
  }
  return { n: G.UIT.ROOT, config: { align: 'cm', padding: 0, colour: G.C.CLEAR, r: 0.1, minw: 7, minh: 4.2 }, nodes: t };
}

export function register_options_funcs() {
  G.UIDEF.custom_deck_tab = custom_deck_tab;
  G.FUNCS.customize_deck = () => {
    G.SETTINGS.paused = true;
    G.FUNCS.overlay_menu({ definition: create_UIBox_customize_deck() });
  };
  G.FUNCS.change_collab = (args: any) => {
    const suit = args.cycle_config.curr_suit;
    G.SETTINGS.CUSTOM_DECK.Collabs[suit] = G.COLLABS.options[suit][args.to_key - 1] ?? 'default';
    for (const v of G.I.CARD) {
      if (v.config && v.config.card && v.children.front && v.ability.effect !== 'Stone Card') v.set_sprites(null, v.config.card);
    }
    save_settings();
  };
  G.UIDEF.settings_tab = settings_tab;
  const exit = G.FUNCS.exit_overlay_menu;
  G.FUNCS.exit_overlay_menu = (...args: any[]) => { save_settings(); return exit(...args); };
  G.FUNCS.options = () => {
    G.SETTINGS.paused = true;
    G.FUNCS.overlay_menu({ definition: create_UIBox_options() });
  };
  G.FUNCS.settings = (_e: any, instant?: boolean) => {
    G.SETTINGS.paused = true;
    G.FUNCS.overlay_menu({ definition: create_UIBox_settings(), config: { offset: { x: 0, y: instant ? 0 : 10 } } });
  };
  G.FUNCS.change_gamespeed = (args: any) => { G.SETTINGS.GAMESPEED = args.to_val; save_settings(); };
  G.FUNCS.change_play_discard_position = (args: any) => {
    G.SETTINGS.play_button_pos = args.to_key;
    save_settings();
    // the run screen rebuilds its buttons in the new order (update_selecting_hand)
    if (G.buttons) { G.buttons.remove(); G.buttons = null; }
  };
  G.FUNCS.change_shadows = (args: any) => { G.SETTINGS.GRAPHICS.shadows = args.to_key === 1 ? 'On' : 'Off'; save_settings(); };
  G.FUNCS.change_pixel_smoothing = (args: any) => { G.SETTINGS.GRAPHICS.texture_scaling = args.to_key; save_settings(); };
  G.FUNCS.change_crt_bloom = (args: any) => { G.SETTINGS.GRAPHICS.bloom = args.to_key; save_settings(); };
  G.FUNCS.refresh_contrast_mode = () => {
    const p = G.C['SO_' + (G.SETTINGS.colourblind_option ? 2 : 1)];
    G.C.SUITS.Hearts = p.Hearts; G.C.SUITS.Diamonds = p.Diamonds; G.C.SUITS.Spades = p.Spades; G.C.SUITS.Clubs = p.Clubs;
    for (const v of G.I.CARD) {
      if (v.config && v.config.card && v.children.front && v.ability.effect !== 'Stone Card') v.set_sprites(null, v.config.card);
    }
    save_settings();
  };
}
