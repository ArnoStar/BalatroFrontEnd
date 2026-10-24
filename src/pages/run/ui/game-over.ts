// The end of a run: create_UIBox_game_over, create_UIBox_win and
// create_UIBox_round_scores_row (UI_definitions.lua), with Jimbo's quip
// (Game:update_game_over, win_game).
import {
  G, Moveable, DynaText, AnimatedSprite, Sprite, Event, copy_table, ease_value, darken, number_format, score_number_scale,
  play_sound, math_random,
} from '@/shared/lib/engine';
import { localize } from '@/shared/lib/localization';
import { create_UIBox_generic_options, UIBox_button } from '@/shared/ui';
import { Card_Character } from '@/entities/card';

export function create_UIBox_round_scores_row(score: string, text_colour?: any) {
  const GAME = G.GAME;
  let label = GAME.round_scores[score] ? localize('ph_score_' + score) : '';
  let check_high_score = false;
  let score_tab: any[] = [];
  const big = score === 'hand' || score === 'poker_hand';
  let label_w = big ? 3.5 : 2.9, score_w = big ? 3.5 : 1;
  const h = 0.5;
  if (score === 'furthest_ante') {
    label_w = 1.9; check_high_score = true; label = localize('k_ante');
    score_tab = [{ n: G.UIT.O, config: { object: new DynaText({ string: [number_format(GAME.round_resets.ante)], colours: [text_colour ?? G.C.FILTER], shadow: true, float: true, scale: 0.45 }) } }];
  }
  if (score === 'furthest_round') {
    label_w = 1.9; check_high_score = true; label = localize('k_round');
    score_tab = [{ n: G.UIT.O, config: { object: new DynaText({ string: [number_format(GAME.round)], colours: [text_colour ?? G.C.FILTER], shadow: true, float: true, scale: 0.45 }) } }];
  }
  if (score === 'seed') {
    label_w = 1.9; score_w = 1.9; label = localize('k_seed');
    score_tab = [{ n: G.UIT.O, config: { object: new DynaText({ string: [GAME.pseudorandom.seed], colours: [text_colour ?? G.C.WHITE], shadow: true, float: true, scale: 0.45 }) } }];
  }
  if (score === 'defeated_by') {
    label = localize('k_defeated_by');
    const cfg = (GAME.blind.config.blind && GAME.blind.config.blind.key) ? GAME.blind.config.blind : G.P_BLINDS.bl_small;
    const animation = new AnimatedSprite(0, 0, 1.4, 1.4, G.ANIMATION_ATLAS.blind_chips, cfg.pos);
    animation.define_draw_steps([{ shader: 'dissolve', shadow_height: 0.05 }, { shader: 'dissolve' }]);
    score_tab = [
      { n: G.UIT.R, config: { align: 'cm', minh: 0.6 }, nodes: [
        { n: G.UIT.O, config: { object: new DynaText({ string: localize({ type: 'name_text', key: cfg.key, set: 'Blind' }), colours: [G.C.WHITE], shadow: true, float: true, maxw: 2.2, scale: 0.45 }) } },
      ] },
      { n: G.UIT.R, config: { align: 'cm', padding: 0.1 }, nodes: [{ n: G.UIT.O, config: { object: animation } }] },
    ];
  }
  const label_scale = 0.5;
  if (score === 'poker_hand') {
    let handname = localize('k_none'), amount = 0;
    for (const k of Object.keys(GAME.hand_usage)) {
      const v = GAME.hand_usage[k];
      if (v.count > amount) { handname = v.order; amount = v.count; }
    }
    score_tab = [
      { n: G.UIT.O, config: { object: new DynaText({ string: [amount < 1 ? handname : localize(handname, 'poker_hands')], colours: [text_colour ?? G.C.WHITE], shadow: true, float: true, scale: 0.45, maxw: 2.5 }) } },
      { n: G.UIT.T, config: { text: ' (' + amount + ')', scale: 0.35, colour: G.C.JOKER_GREY } },
    ];
  } else if (score === 'hand') {
    check_high_score = true;
    const chip_sprite = new Sprite(0, 0, 0.3, 0.3, G.ASSET_ATLAS['ui_' + (G.SETTINGS.colourblind_option ? 2 : 1)], { x: 0, y: 0 });
    chip_sprite.states.drag.can = false;
    score_tab = [
      { n: G.UIT.C, config: { align: 'cm' }, nodes: [{ n: G.UIT.O, config: { w: 0.3, h: 0.3, object: chip_sprite } }] },
      { n: G.UIT.C, config: { align: 'cm' }, nodes: [
        { n: G.UIT.O, config: { object: new DynaText({ string: [number_format(GAME.round_scores[score].amt)], colours: [text_colour ?? G.C.RED], shadow: true, float: true, scale: Math.min(0.6, score_number_scale(1.2, GAME.round_scores[score].amt)) }) } },
      ] },
    ];
  } else if (GAME.round_scores[score] && !score_tab[0]) {
    score_tab = [{ n: G.UIT.O, config: { object: new DynaText({ string: [number_format(GAME.round_scores[score].amt)], colours: [text_colour ?? G.C.FILTER], shadow: true, float: true, scale: score_number_scale(0.6, GAME.round_scores[score].amt) }) } }];
  }
  const R = score === 'defeated_by' ? G.UIT.R : G.UIT.C;
  return { n: G.UIT.R, config: { align: 'cm', padding: 0.05, r: 0.1, colour: darken(G.C.JOKER_GREY, 0.1), emboss: 0.05, func: check_high_score ? 'high_score_alert' : null, id: score }, nodes: [
    { n: R, config: { align: 'cm', padding: 0.02, minw: label_w, maxw: label_w }, nodes: [
      { n: G.UIT.T, config: { text: label, scale: label_scale, colour: G.C.UI.TEXT_LIGHT, shadow: true } },
    ] },
    { n: R, config: { align: 'cr' }, nodes: [
      { n: G.UIT.C, config: { align: 'cm', minh: h, r: 0.1, minw: score === 'defeated_by' ? label_w : score_w, colour: (score === 'seed' && GAME.seeded) ? G.C.RED : G.C.BLACK, emboss: 0.05 }, nodes: [
        { n: G.UIT.C, config: { align: 'cm', padding: 0.05, r: 0.1, minw: score_w }, nodes: score_tab },
      ] },
    ] },
  ] };
}

function with_jimbo_spot(t: any) {
  t.nodes[0] = { n: G.UIT.R, config: { align: 'cm', padding: 0.1 }, nodes: [
    { n: G.UIT.C, config: { align: 'cm', padding: 2 }, nodes: [
      { n: G.UIT.R, config: { align: 'cm' }, nodes: [
        { n: G.UIT.O, config: { padding: 0, id: 'jimbo_spot', object: new Moveable(0, 0, G.CARD_W * 1.1, G.CARD_H * 1.1) } },
      ] },
    ] },
    { n: G.UIT.C, config: { align: 'cm', padding: 0.1 }, nodes: [t.nodes[0]] },
  ] };
  return t;
}

export function create_UIBox_game_over() {
  const eased_red = copy_table(G.GAME.round_resets.ante <= G.GAME.win_ante ? G.C.RED : G.C.BLUE);
  eased_red[3] = 0;
  ease_value(eased_red, 3, 0.8, null, null, true);
  const t: any = create_UIBox_generic_options({ bg_colour: eased_red, no_back: true, padding: 0, contents: [
    { n: G.UIT.R, config: { align: 'cm' }, nodes: [
      { n: G.UIT.O, config: { object: new DynaText({ string: [localize('ph_game_over')], colours: [G.C.RED], shadow: true, float: true, scale: 1.5, pop_in: 0.4, maxw: 6.5 }) } },
    ] },
    { n: G.UIT.R, config: { align: 'cm', padding: 0.15 }, nodes: [
      { n: G.UIT.C, config: { align: 'cm' }, nodes: [
        { n: G.UIT.R, config: { align: 'cm', padding: 0.05, colour: G.C.BLACK, emboss: 0.05, r: 0.1 }, nodes: [
          { n: G.UIT.R, config: { align: 'cm', padding: 0.08 }, nodes: [
            create_UIBox_round_scores_row('hand'),
            create_UIBox_round_scores_row('poker_hand'),
          ] },
          { n: G.UIT.R, config: { align: 'cm' }, nodes: [
            { n: G.UIT.C, config: { align: 'cm', padding: 0.08 }, nodes: [
              create_UIBox_round_scores_row('cards_played', G.C.BLUE),
              create_UIBox_round_scores_row('cards_discarded', G.C.RED),
              create_UIBox_round_scores_row('cards_purchased', G.C.MONEY),
              create_UIBox_round_scores_row('times_rerolled', G.C.GREEN),
              create_UIBox_round_scores_row('new_collection', G.C.WHITE),
              create_UIBox_round_scores_row('seed', G.C.WHITE),
              UIBox_button({ button: 'copy_seed', label: [localize('b_copy')], colour: G.C.BLUE, scale: 0.3, minw: 2.3, minh: 0.4, focus_args: { nav: 'wide' } }),
            ] },
            { n: G.UIT.C, config: { align: 'tr', padding: 0.08 }, nodes: [
              create_UIBox_round_scores_row('furthest_ante', G.C.FILTER),
              create_UIBox_round_scores_row('furthest_round', G.C.FILTER),
              create_UIBox_round_scores_row('defeated_by'),
            ] },
          ] },
        ] },
        { n: G.UIT.R, config: { align: 'cm', padding: 0.1 }, nodes: [
          { n: G.UIT.R, config: { id: 'from_game_over', align: 'cm', minw: 5, padding: 0.1, r: 0.1, hover: true, colour: G.C.RED, button: 'notify_then_setup_run', shadow: true, focus_args: { nav: 'wide', snap_to: true } }, nodes: [
            { n: G.UIT.R, config: { align: 'cm', padding: 0, no_fill: true, maxw: 4.8 }, nodes: [
              { n: G.UIT.T, config: { text: localize('b_start_new_run'), scale: 0.5, colour: G.C.UI.TEXT_LIGHT } },
            ] },
          ] },
          { n: G.UIT.R, config: { align: 'cm', minw: 5, padding: 0.1, r: 0.1, hover: true, colour: G.C.RED, button: 'go_to_menu', shadow: true, focus_args: { nav: 'wide' } }, nodes: [
            { n: G.UIT.R, config: { align: 'cm', padding: 0, no_fill: true, maxw: 4.8 }, nodes: [
              { n: G.UIT.T, config: { text: localize('b_main_menu'), scale: 0.5, colour: G.C.UI.TEXT_LIGHT } },
            ] },
          ] },
        ] },
      ] },
    ] },
  ] });
  return with_jimbo_spot(t);
}

export function create_UIBox_win() {
  const eased_green = copy_table(G.C.GREEN);
  eased_green[3] = 0;
  ease_value(eased_green, 3, 0.5, null, null, true);
  const t: any = create_UIBox_generic_options({ padding: 0, bg_colour: eased_green, colour: G.C.BLACK, outline_colour: G.C.EDITION, no_back: true, no_esc: true, contents: [
    { n: G.UIT.R, config: { align: 'cm' }, nodes: [
      { n: G.UIT.O, config: { object: new DynaText({ string: [localize('ph_you_win')], colours: [G.C.EDITION], shadow: true, float: true, spacing: 10, rotate: true, scale: 1.5, pop_in: 0.4, maxw: 6.5 }) } },
    ] },
    { n: G.UIT.R, config: { align: 'cm', padding: 0.15 }, nodes: [
      { n: G.UIT.C, config: { align: 'cm' }, nodes: [
        { n: G.UIT.R, config: { align: 'cm', padding: 0.08 }, nodes: [
          create_UIBox_round_scores_row('hand'),
          create_UIBox_round_scores_row('poker_hand'),
        ] },
        { n: G.UIT.R, config: { align: 'cm' }, nodes: [
          { n: G.UIT.C, config: { align: 'cm', padding: 0.08 }, nodes: [
            create_UIBox_round_scores_row('cards_played', G.C.BLUE),
            create_UIBox_round_scores_row('cards_discarded', G.C.RED),
            create_UIBox_round_scores_row('cards_purchased', G.C.MONEY),
            create_UIBox_round_scores_row('times_rerolled', G.C.GREEN),
            create_UIBox_round_scores_row('new_collection', G.C.WHITE),
            create_UIBox_round_scores_row('seed', G.C.WHITE),
            UIBox_button({ button: 'copy_seed', label: [localize('b_copy')], colour: G.C.BLUE, scale: 0.3, minw: 2.3, minh: 0.4 }),
          ] },
          { n: G.UIT.C, config: { align: 'tr', padding: 0.08 }, nodes: [
            create_UIBox_round_scores_row('furthest_ante', G.C.FILTER),
            create_UIBox_round_scores_row('furthest_round', G.C.FILTER),
            { n: G.UIT.R, config: { align: 'cm', minh: 0.4, minw: 0.1 }, nodes: [] },
            UIBox_button({ id: 'from_game_won', button: 'notify_then_setup_run', label: [localize('b_start_new_run')], minw: 2.5, maxw: 2.5, minh: 1, focus_args: { nav: 'wide', snap_to: true } }),
            { n: G.UIT.R, config: { align: 'cm', minh: 0.2, minw: 0.1 }, nodes: [] },
            UIBox_button({ button: 'go_to_menu', label: [localize('b_main_menu')], minw: 2.5, maxw: 2.5, minh: 1, focus_args: { nav: 'wide' } }),
          ] },
        ] },
        { n: G.UIT.R, config: { align: 'cm', padding: 0.08 }, nodes: [
          UIBox_button({ button: 'exit_overlay_menu', label: [localize('b_endless')], minw: 6.5, maxw: 5, minh: 1.2, scale: 0.7, shadow: true, colour: G.C.BLUE, focus_args: { nav: 'wide', button: 'x', set_button_pip: true } }),
        ] },
      ] },
    ] },
  ] });
  t.nodes[0] = { n: G.UIT.R, config: { align: 'cm', padding: 0.1 }, nodes: [
    { n: G.UIT.C, config: { align: 'cm', padding: 2 }, nodes: [
      { n: G.UIT.O, config: { padding: 0, id: 'jimbo_spot', object: new Moveable(0, 0, G.CARD_W * 1.1, G.CARD_H * 1.1) } },
    ] },
    { n: G.UIT.C, config: { align: 'cm', padding: 0.1 }, nodes: [t.nodes[0]] },
  ] };
  t.config.id = 'you_win_UI';
  return t;
}

function jimbo_quip(prefix: string, n: number) {
  G.E_MANAGER.add_event(new Event({
    trigger: 'after', delay: 2.5, blocking: false,
    func: () => {
      if (G.OVERLAY_MENU && G.OVERLAY_MENU.get_UIE_by_ID('jimbo_spot')) {
        const Jimbo = new Card_Character({ x: 0, y: 5 });
        const spot = G.OVERLAY_MENU.get_UIE_by_ID('jimbo_spot');
        spot.config.object.remove();
        spot.config.object = Jimbo;
        Jimbo.ui_object_updated = true;
        Jimbo.add_speech_bubble(prefix + math_random(1, n), undefined, { quip: true });
        Jimbo.say_stuff(5);
      }
      return true;
    },
  }));
}

/** Game:update_game_over's overlay */
export function show_game_over() {
  G.FUNCS.overlay_menu({ definition: create_UIBox_game_over(), config: { no_esc: true } });
  if (G.GAME.round_resets.ante <= G.GAME.win_ante) jimbo_quip('lq_', 10);
}

/** win_game (state_events.lua): the win overlay, then endless mode */
export function show_win() {
  G.E_MANAGER.add_event(new Event({
    trigger: 'immediate',
    func: () => {
      for (const v of G.I.CARD) v.sticker_run = null;
      play_sound('win');
      G.SETTINGS.paused = true;
      G.FUNCS.overlay_menu({ definition: create_UIBox_win(), config: { no_esc: true } });
      jimbo_quip('wq_', 7);
      return true;
    },
  }));
  G.E_MANAGER.add_event(new Event({
    trigger: 'immediate',
    func: () => {
      if (!G.SETTINGS.paused) { G.GAME.current_round.round_text = 'Endless Round '; return true; }
      return false;
    },
  }));
}
