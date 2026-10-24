// The main menu's profile and language overlays (UI_definitions.lua:
// G.UIDEF.profile_select, profile_option, language_selector; button_callbacks.lua:
// profile_select, can_load_profile, load_profile, can_delete_profile,
// delete_profile, language_selection, change_lang). This front end has one
// profile (kept in the browser) and English only.
import { G, Event, play_sound } from '@/shared/lib/engine';
import { localize } from '@/shared/lib/localization';
import { create_UIBox_generic_options, create_tabs, create_text_input } from '@/shared/ui';
import { profile, save_profile } from '@/shared/config';
import { create_progress_box, set_profile_progress } from '@/widgets/stats';

function profile_option(_profile: number) {
  G.focused_profile = _profile;
  const current = _profile === G.SETTINGS.profile;
  const p = G.PROFILES[_profile - 1];
  if (current) set_profile_progress();
  const lwidth = 1, rwidth = 1, scale = 1;
  return { n: G.UIT.ROOT, config: { align: 'cm', colour: G.C.CLEAR }, nodes: [
    { n: G.UIT.R, config: { align: 'cm', padding: 0.1, minh: 0.8 }, nodes: [
      { n: G.UIT.R, config: { align: 'cm' }, nodes: [
        create_text_input({ w: 4, max_length: 16, prompt_text: localize('k_enter_name'), ref_table: p, ref_value: 'name', extended_corpus: true, keyboard_offset: 1 }),
      ] },
    ] },
    { n: G.UIT.R, config: { align: 'cm', padding: 0.1 }, nodes: [
      { n: G.UIT.C, config: { align: 'cm', minw: 6 }, nodes: [
        current ? create_progress_box(true) : { n: G.UIT.C, config: { align: 'cm', minh: 4, minw: 5.2, colour: G.C.BLACK, r: 0.1 }, nodes: [
          { n: G.UIT.T, config: { text: localize('k_empty_caps'), scale: 0.5, colour: G.C.UI.TRANSPARENT_LIGHT } },
        ] },
      ] },
      { n: G.UIT.C, config: { align: 'cm', minh: 4 }, nodes: [
        { n: G.UIT.R, config: { align: 'cm', minh: 1 }, nodes: [
          current ? { n: G.UIT.R, config: { align: 'cm' }, nodes: [
            { n: G.UIT.C, config: { align: 'cm', minw: lwidth }, nodes: [{ n: G.UIT.T, config: { text: localize('k_wins'), colour: G.C.UI.TEXT_LIGHT, scale: scale * 0.7 } }] },
            { n: G.UIT.C, config: { align: 'cm' }, nodes: [{ n: G.UIT.T, config: { text: ': ', colour: G.C.UI.TEXT_LIGHT, scale: scale * 0.7 } }] },
            { n: G.UIT.C, config: { align: 'cl', minw: rwidth }, nodes: [{ n: G.UIT.T, config: { text: String(profile().career_stats.c_wins ?? 0), colour: G.C.RED, shadow: true, scale: 1 * scale } }] },
          ] } : null,
        ] },
        { n: G.UIT.R, config: { align: 'cm', padding: 0.2 }, nodes: [
          { n: G.UIT.R, config: { align: 'cm', padding: 0 }, nodes: [
            { n: G.UIT.R, config: { align: 'cm', minw: 4, maxw: 4, minh: 0.8, padding: 0.2, r: 0.1, hover: true, colour: G.C.BLUE, func: 'can_load_profile', button: 'load_profile', shadow: true, focus_args: { nav: 'wide' } }, nodes: [
              { n: G.UIT.T, config: { text: current ? localize('b_current_profile') : localize('b_create_profile'), scale: 0.5, colour: G.C.UI.TEXT_LIGHT } },
            ] },
          ] },
          { n: G.UIT.R, config: { align: 'cm', padding: 0, minh: 0.7 }, nodes: [
            { n: G.UIT.R, config: { align: 'cm', minw: 3, maxw: 4, minh: 0.6, padding: 0.2, r: 0.1, hover: true, colour: G.C.RED, func: 'can_delete_profile', button: 'delete_profile', shadow: true, focus_args: { nav: 'wide' } }, nodes: [
              { n: G.UIT.T, config: { text: current ? localize('b_reset_profile') : localize('b_delete_profile'), scale: 0.3, colour: G.C.UI.TEXT_LIGHT } },
            ] },
          ] },
          { n: G.UIT.R, config: { align: 'cm', minw: 3, maxw: 4, minh: 0.7 }, nodes: [
            { n: G.UIT.T, config: { text: localize('k_achievements_disabled'), scale: 0.3, colour: G.C.UI.TEXT_LIGHT } },
          ] },
        ] },
      ] },
    ] },
    { n: G.UIT.R, config: { align: 'cm', padding: 0 }, nodes: [
      { n: G.UIT.T, config: { id: 'warning_text', text: localize('ph_click_confirm'), scale: 0.4, colour: G.C.CLEAR } },
    ] },
  ] };
}

function profile_select() {
  G.focused_profile = G.focused_profile ?? G.SETTINGS.profile ?? 1;
  return create_UIBox_generic_options({ padding: 0, contents: [
    { n: G.UIT.R, config: { align: 'cm', padding: 0, draw_layer: 1, minw: 4 }, nodes: [
      create_tabs({ tabs: [1, 2, 3].map((i) => ({ label: i, chosen: G.focused_profile === i, tab_definition_function: profile_option, tab_definition_function_args: i })), snap_to_nav: true }),
    ] },
  ] });
}

function language_selector() {
  const langs = Object.keys(G.LANGUAGES).map((k) => G.LANGUAGES[k]).filter((v: any) => !v.omit).sort((a: any, b: any) => (a.label < b.label ? -1 : 1));
  const rows: any[] = [];
  let _row: any[] = [];
  langs.forEach((v: any, k: number) => {
    _row.push({ n: G.UIT.C, config: { align: 'cm', func: 'beta_lang_alert', padding: 0.05, r: 0.1, minh: 0.7, minw: 4.5, button: v.beta ? 'warn_lang' : 'change_lang', ref_table: v, colour: v.beta ? G.C.RED : G.C.BLUE, hover: true, shadow: true, focus_args: { snap_to: k === 0 } }, nodes: [
      { n: G.UIT.R, config: { align: 'cm' }, nodes: [{ n: G.UIT.T, config: { text: v.label, lang: v, scale: 0.45, colour: G.C.UI.TEXT_LIGHT, shadow: true } }] },
    ] });
    if (_row[2] || k === langs.length - 1) { rows.push({ n: G.UIT.R, config: { align: 'cm', padding: 0.1 }, nodes: _row }); _row = []; }
  });
  return create_UIBox_generic_options({ contents: [{ n: G.UIT.R, config: { align: 'cm', padding: 0.05 }, nodes: rows }] });
}

export function register_main_menu_overlays() {
  G.UIDEF.profile_select = profile_select;
  G.UIDEF.profile_option = profile_option;
  G.UIDEF.language_selector = language_selector;
  G.FUNCS.profile_select = () => {
    G.SETTINGS.paused = true;
    G.focused_profile = G.SETTINGS.profile;
    G.FUNCS.overlay_menu({ definition: profile_select() });
  };
  G.FUNCS.can_load_profile = (e: any) => {
    // the current profile is the only one here
    e.config.colour = G.C.UI.BACKGROUND_INACTIVE;
    e.config.button = null;
  };
  G.FUNCS.can_delete_profile = (e: any) => {
    const ok = G.focused_profile === G.SETTINGS.profile && !e.config.disable_button;
    e.config.colour = ok ? G.C.RED : G.C.UI.BACKGROUND_INACTIVE;
    e.config.button = ok ? 'delete_profile' : null;
  };
  G.FUNCS.delete_profile = (e: any) => {
    const warning_text = e.UIBox.get_UIE_by_ID('warning_text');
    if (warning_text.config.colour !== G.C.WHITE) {
      warning_text.juice_up();
      warning_text.config.colour = G.C.WHITE;
      warning_text.config.shadow = true;
      e.config.disable_button = true;
      G.E_MANAGER.add_event(new Event({ trigger: 'after', delay: 0.06, blockable: false, blocking: false, func: () => { play_sound('tarot2', 0.76, 0.4); return true; } }));
      G.E_MANAGER.add_event(new Event({ trigger: 'after', delay: 0.35, blockable: false, blocking: false, func: () => { e.config.disable_button = null; return true; } }));
      play_sound('tarot2', 1, 0.4);
    } else {
      // reset: the profile's stats kept in this browser
      const p = profile();
      for (const k of Object.keys(p.high_scores)) p.high_scores[k].amt = 0;
      p.hand_usage = {}; p.joker_usage = {}; p.consumeable_usage = {}; p.voucher_usage = {};
      p.challenge_progress.completed = {};
      save_profile();
      G.FUNCS.exit_overlay_menu();
    }
  };
  G.FUNCS.language_selection = () => {
    G.SETTINGS.paused = true;
    G.FUNCS.overlay_menu({ definition: language_selector() });
  };
  G.FUNCS.beta_lang_alert = () => { /* no beta languages here */ };
  G.FUNCS.change_lang = (e: any) => {
    const lang = e.config.ref_table;
    if (!lang || lang === G.LANG) G.FUNCS.exit_overlay_menu();
  };
}
