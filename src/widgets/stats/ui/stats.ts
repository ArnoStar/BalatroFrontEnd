// Stats (UI_definitions.lua: create_UIBox_high_scores,
// create_UIBox_high_scores_row, create_progress_box, G.UIDEF.usage_tabs,
// create_UIBox_usage), from the profile this browser keeps.
import { G, UIBox, DynaText, Sprite, darken, adjust_alpha, mix_colours, number_format, score_number_scale } from '@/shared/lib/engine';
import { localize } from '@/shared/lib/localization';
import { create_UIBox_generic_options, create_tabs, UIBox_button, create_UIBox_card_alert } from '@/shared/ui';
import { profile } from '@/shared/config';
import { Card, CardArea } from '@/entities/card';

export function set_profile_progress() {
  const p = profile();
  let discovered = 0, of = 0, backs = 0, jokers = 0;
  for (const k of Object.keys(G.P_CENTERS)) {
    const v = G.P_CENTERS[k];
    if (v.omit || !v.set) continue;
    if (v.set === 'Joker' || v.consumeable || v.set === 'Edition' || v.set === 'Voucher' || v.set === 'Back' || v.set === 'Booster') {
      of++;
      if (v.discovered) discovered++;
    }
    if (v.set === 'Back') backs++;
    if (v.set === 'Joker') jokers++;
  }
  const stakes = G.P_CENTER_POOLS.Stake.length;
  const completed = G.CHALLENGES.filter((c: any) => p.challenge_progress.completed[c.id]).length;
  p.progress = {
    discovered: { tally: discovered, of },
    deck_stakes: { tally: 0, of: backs * stakes },
    joker_stickers: { tally: 0, of: jokers * stakes },
    challenges: { tally: completed, of: G.CHALLENGES.length },
  };
  p.high_scores.collection.amt = discovered;
  p.high_scores.collection.tot = of;
}

export function create_progress_box(smaller?: boolean) {
  const pp = profile().progress;
  pp.overall_tally = pp.discovered.tally / pp.discovered.of + pp.deck_stakes.tally / pp.deck_stakes.of + pp.joker_stickers.tally / pp.joker_stickers.of + pp.challenges.tally / pp.challenges.of;
  pp.overall_of = 4;
  const text_scale = smaller ? 0.7 : 1;
  const bar_colour = profile().all_unlocked ? G.C.RED : G.C.BLUE;
  const rows: any[] = [];
  const tabs: Record<string, any> = { collection: pp.discovered, challenges: pp.challenges, joker_stickers: pp.joker_stickers, deck_stake_wins: pp.deck_stakes };
  for (const v of ['collection', 'challenges', 'joker_stickers', 'deck_stake_wins']) {
    const tab = tabs[v];
    const filling = [
      { n: G.UIT.O, config: { object: new DynaText({ string: [Math.floor(0.01 + 100 * tab.tally / tab.of) + '%'], colours: [G.C.WHITE], shadow: true, float: true, scale: 0.55 * text_scale }) } },
      { n: G.UIT.T, config: { text: ' (' + tab.tally + '/' + tab.of + ')', scale: 0.35, colour: G.C.JOKER_GREY } },
    ];
    rows.push({ n: G.UIT.R, config: { align: 'cm', padding: 0.05, r: 0.1, colour: darken(G.C.JOKER_GREY, 0.1), emboss: 0.05 }, nodes: [
      { n: G.UIT.C, config: { align: 'cm', padding: 0.05, minw: 3.5 * text_scale, maxw: 3.5 * text_scale }, nodes: [
        { n: G.UIT.T, config: { text: localize('k_' + v), scale: 0.5 * text_scale, colour: G.C.UI.TEXT_LIGHT, shadow: true } },
      ] },
      { n: G.UIT.C, config: { align: 'cl', minh: smaller ? 0.5 : 0.8, r: 0.1, minw: 3.5 * text_scale, colour: G.C.BLACK, emboss: 0.05,
        progress_bar: { max: tab.of, ref_table: tab, ref_value: 'tally', empty_col: G.C.BLACK, filled_col: adjust_alpha(bar_colour, 0.5) } }, nodes: [
        { n: G.UIT.C, config: { align: 'cm', padding: 0.05, r: 0.1, minw: 3.5 * text_scale }, nodes: filling },
      ] },
    ] });
  }
  return { n: G.UIT.R, config: { align: 'cm', padding: 0.05, r: 0.1, colour: G.C.BLACK, emboss: 0.05 }, nodes: [
    { n: G.UIT.R, config: { align: 'cm', padding: 0.05 }, nodes: [
      { n: G.UIT.C, config: { align: 'cm', padding: 0.05, minw: 3.5 * text_scale, maxw: 3.5 * text_scale }, nodes: [
        { n: G.UIT.T, config: { text: localize('k_progress'), scale: 0.5, colour: G.C.UI.TEXT_LIGHT, shadow: true } },
      ] },
      { n: G.UIT.C, config: { align: 'cl', minh: 0.6, r: 0.1, minw: 3.5 * text_scale, colour: G.C.BLACK, emboss: 0.05,
        progress_bar: { max: pp.overall_of, ref_table: pp, ref_value: 'overall_tally', empty_col: G.C.BLACK, filled_col: adjust_alpha(bar_colour, 0.5) } }, nodes: [
        { n: G.UIT.C, config: { align: 'cm', padding: 0.05, r: 0.1, minw: 3.5 * text_scale }, nodes: [
          { n: G.UIT.O, config: { object: new DynaText({ string: [Math.floor(0.01 + 100 * pp.overall_tally / pp.overall_of) + '%'], colours: [G.C.WHITE], shadow: true, float: true, scale: 0.55 }) } },
        ] },
      ] },
    ] },
    { n: G.UIT.R, config: { align: 'cm', padding: 0.05 }, nodes: rows },
  ] };
}

function high_scores_row(score: string) {
  const hs = profile().high_scores;
  if (!hs[score]) return null;
  const label_scale = 0.65 - 0.025 * Math.max(String(hs[score].label).length - 8, 0);
  const label_w = 3.5, score_w = 4, h = 0.8;
  let score_tab: any[];
  const amt = hs[score].amt;
  if (score === 'poker_hand') {
    let handname = localize('k_none'), amount = 0;
    const hu = profile().hand_usage;
    for (const k of Object.keys(hu)) if (hu[k].count > amount) { handname = hu[k].order; amount = hu[k].count; }
    score_tab = [
      { n: G.UIT.O, config: { object: new DynaText({ string: [amount < 1 ? handname : localize(handname, 'poker_hands')], colours: [G.C.WHITE], shadow: true, float: true, scale: 0.55 }) } },
      { n: G.UIT.T, config: { text: ' (' + amount + ')', scale: 0.45, colour: G.C.JOKER_GREY } },
    ];
  } else if (score === 'most_money') {
    score_tab = [{ n: G.UIT.O, config: { object: new DynaText({ string: [localize('$') + number_format(amt)], colours: [G.C.MONEY], shadow: true, float: true, scale: score_number_scale(0.85, amt) }) } }];
  } else if (score === 'win_streak') {
    score_tab = [
      { n: G.UIT.O, config: { object: new DynaText({ string: [number_format(amt)], colours: [G.C.WHITE], shadow: true, float: true, scale: score_number_scale(0.85, amt) }) } },
      { n: G.UIT.T, config: { text: ' (' + hs.current_streak.amt + ')', scale: 0.45, colour: G.C.JOKER_GREY } },
    ];
  } else if (score === 'hand') {
    const chip_sprite = new Sprite(0, 0, 0.4, 0.4, G.ASSET_ATLAS['ui_' + (G.SETTINGS.colourblind_option ? 2 : 1)], { x: 0, y: 0 });
    chip_sprite.states.drag.can = false;
    score_tab = [
      { n: G.UIT.C, config: { align: 'cm' }, nodes: [{ n: G.UIT.O, config: { w: 0.4, h: 0.4, object: chip_sprite } }] },
      { n: G.UIT.C, config: { align: 'cm' }, nodes: [
        { n: G.UIT.O, config: { object: new DynaText({ string: [number_format(amt)], colours: [G.C.RED], shadow: true, float: true, scale: Math.min(0.75, score_number_scale(1.5, amt)) }) } },
      ] },
    ];
  } else {
    score_tab = [{ n: G.UIT.O, config: { object: new DynaText({ string: [number_format(amt)], colours: [G.C.FILTER], shadow: true, float: true, scale: score_number_scale(0.85, amt) }) } }];
  }
  return { n: G.UIT.R, config: { align: 'cm', padding: 0.05, r: 0.1, colour: darken(G.C.JOKER_GREY, 0.1), emboss: 0.05 }, nodes: [
    { n: G.UIT.C, config: { align: 'cm', padding: 0.05, minw: label_w, maxw: label_w }, nodes: [
      { n: G.UIT.T, config: { text: localize(score, 'high_scores'), scale: label_scale, colour: G.C.UI.TEXT_LIGHT, shadow: true } },
    ] },
    { n: G.UIT.C, config: { align: 'cl', minh: h, r: 0.1, minw: score_w, colour: G.C.BLACK, emboss: 0.05 }, nodes: [
      { n: G.UIT.C, config: { align: 'cm', padding: 0.05, r: 0.1, minw: score_w, maxw: score_w }, nodes: score_tab },
    ] },
  ] };
}

export function create_UIBox_high_scores() {
  set_profile_progress();
  const scores = ['hand', 'furthest_round', 'furthest_ante', 'poker_hand', 'most_money', 'win_streak'].map(high_scores_row);
  G.focused_profile = G.SETTINGS.profile;
  return create_UIBox_generic_options({ back_func: 'options', snap_back: true, contents: [
    { n: G.UIT.C, config: { align: 'cm', minw: 3, padding: 0.2, r: 0.1, colour: G.C.CLEAR }, nodes: [
      { n: G.UIT.R, config: { align: 'cm', padding: 0.1 }, nodes: scores },
    ] },
    { n: G.UIT.C, config: { align: 'cm', padding: 0.1, r: 0.1, colour: G.C.CLEAR }, nodes: [
      create_progress_box(),
      UIBox_button({ button: 'usage', label: [localize('k_card_stats')], minw: 7.5, minh: 1, focus_args: { nav: 'wide' } }),
    ] },
  ] });
}

function create_UIBox_usage(args: any[] = []) {
  const [_type, _set] = args;
  const table = profile()[_type] ?? {};
  const used: { count: number; key: string }[] = [];
  let max_amt = 0;
  for (const k of Object.keys(table)) {
    if (G.P_CENTERS[k] && (!_set || G.P_CENTERS[k].set === _set) && G.P_CENTERS[k].discovered) {
      used.push({ count: table[k].count, key: k });
      if (table[k].count > max_amt) max_amt = table[k].count;
    }
  }
  used.sort((a, b) => b.count - a.count);
  const histograms: any[] = [];
  for (let i = 0; i < 10; i++) {
    const v = used[i];
    if (v) {
      const card: any = new Card(0, 0, 0.7 * G.CARD_W, 0.7 * G.CARD_H, null, G.P_CENTERS[v.key]);
      card.ambient_tilt = 0.8;
      const area = new CardArea(G.ROOM.T.x + 0.2 * G.ROOM.T.w / 2, G.ROOM.T.h, G.CARD_W * 0.7, G.CARD_H * 0.7, { card_limit: 2, type: 'title', highlight_limit: 0 });
      area.emplace(card);
      histograms.push({ n: G.UIT.C, config: { align: 'bm', minh: 6.2, colour: G.C.UI.TRANSPARENT_DARK, r: 0.1 }, nodes: [
        { n: G.UIT.R, config: { align: 'bm' }, nodes: [
          { n: G.UIT.R, config: { align: 'cm', minh: 0.7 * G.CARD_H + 0.1 }, nodes: [{ n: G.UIT.O, config: { object: area } }] },
          { n: G.UIT.R, config: { align: 'cm', padding: 0.1 }, nodes: [{ n: G.UIT.T, config: { text: v.count, scale: 0.35, colour: mix_colours(G.C.FILTER, G.C.WHITE, 0.8), shadow: true } }] },
          { n: G.UIT.R, config: { align: 'cm' }, nodes: [
            { n: G.UIT.R, config: { align: 'cm', minh: v.count / max_amt * 3.6, minw: 0.8, colour: G.C.SECONDARY_SET[G.P_CENTERS[v.key].set] ?? G.C.RED, res: 0.15, r: 0.001 }, nodes: [] },
          ] },
        ] },
      ] });
    } else {
      histograms.push({ n: G.UIT.C, config: { align: 'bm', minh: 6.2, colour: G.C.UI.TRANSPARENT_DARK, r: 0.1 }, nodes: [
        { n: G.UIT.R, config: { align: 'bm' }, nodes: [
          { n: G.UIT.R, config: { align: 'cm', minh: 0.7 * G.CARD_H + 0.1, minw: 0.7 * G.CARD_W }, nodes: [] },
          { n: G.UIT.R, config: { align: 'cm', padding: 0.1 }, nodes: [{ n: G.UIT.T, config: { text: '-', scale: 0.35, colour: mix_colours(G.C.FILTER, G.C.WHITE, 0.8), shadow: true } }] },
          { n: G.UIT.R, config: { align: 'cm' }, nodes: [{ n: G.UIT.R, config: { align: 'cm', minh: 0.2, minw: 0.8, colour: G.C.UI.TRANSPARENT_LIGHT, res: 0.15, r: 0.001 }, nodes: [] }] },
        ] },
      ] });
    }
  }
  const title = _type === 'joker_usage' ? localize('ph_stat_joker') : _type === 'consumeable_usage' ? localize('ph_stat_consumable') : localize('ph_stat_voucher');
  return { n: G.UIT.ROOT, config: { align: 'cm', minw: 3, padding: 0.1, r: 0.1, colour: G.C.UI.TRANSPARENT_DARK }, nodes: [
    { n: G.UIT.R, config: { align: 'cm', padding: 0.1 }, nodes: [
      { n: G.UIT.B, config: { w: 0.2, h: 0.2, r: 0.1, colour: G.C.FILTER } },
      { n: G.UIT.T, config: { text: title, scale: 0.35, colour: G.C.WHITE } },
    ] },
    { n: G.UIT.R, config: { align: 'cm', padding: 0.1 }, nodes: histograms },
  ] };
}

function usage_tabs() {
  const tabs = [
    { label: localize('b_stat_jokers'), chosen: true, tab_definition_function: create_UIBox_usage, tab_definition_function_args: ['joker_usage'] },
    { label: localize('b_stat_consumables'), tab_definition_function: create_UIBox_usage, tab_definition_function_args: ['consumeable_usage'] },
    { label: localize('b_stat_tarots'), tab_definition_function: create_UIBox_usage, tab_definition_function_args: ['consumeable_usage', 'Tarot'] },
    { label: localize('b_stat_planets'), tab_definition_function: create_UIBox_usage, tab_definition_function_args: ['consumeable_usage', 'Planet'] },
    { label: localize('b_stat_spectrals'), tab_definition_function: create_UIBox_usage, tab_definition_function_args: ['consumeable_usage', 'Spectral'] },
    { label: localize('b_stat_vouchers'), tab_definition_function: create_UIBox_usage, tab_definition_function_args: ['voucher_usage', 'Voucher'] },
  ];
  return create_UIBox_generic_options({ back_func: 'high_scores', contents: [create_tabs({ tabs, tab_h: 8, snap_to_nav: true })] });
}

export function register_stats_funcs() {
  G.FUNCS.high_scores = () => {
    G.SETTINGS.paused = true;
    G.FUNCS.overlay_menu({ definition: create_UIBox_high_scores() });
  };
  G.FUNCS.usage = () => {
    G.SETTINGS.paused = true;
    G.FUNCS.overlay_menu({ definition: usage_tabs() });
  };
  G.FUNCS.high_score_alert = (e: any) => {
    if (e.config.id && !e.children.alert) {
      const rs = G.GAME.round_scores[e.config.id];
      if (rs && rs.high_score) {
        e.children.alert = new UIBox({
          definition: create_UIBox_card_alert({ no_bg: true, text: localize('k_high_score_ex'), scale: 0.3 }),
          config: { instance_type: 'ALERT', align: 'tri', offset: { x: 0.3, y: -0.18 }, major: e, parent: e },
        });
        e.children.alert.states.collide.can = false;
      }
    }
  };
}
