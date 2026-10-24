// create_UIBox_HUD and create_UIBox_HUD_blind (UI_definitions.lua): the run's
// left panel (blind, score, hand, money, hands/discards, ante, round).
import { G, DynaText, Moveable, darken } from '@/shared/lib/engine';
import { localize } from '@/shared/lib/localization';
import { get_stake_sprite } from '@/shared/ui/stake';

export function create_UIBox_HUD_blind() {
  const scale = 0.4;
  const stake_sprite = get_stake_sprite(G.GAME.stake || 1, 0.5);
  G.GAME.blind.change_dim(1.5, 1.5);

  return { n: G.UIT.ROOT, config: { align: 'cm', minw: 4.5, r: 0.1, colour: G.C.BLACK, emboss: 0.05, padding: 0.05, func: 'HUD_blind_visible', id: 'HUD_blind' }, nodes: [
    { n: G.UIT.R, config: { align: 'cm', minh: 0.7, r: 0.1, emboss: 0.05, colour: G.C.DYN_UI.MAIN }, nodes: [
      { n: G.UIT.C, config: { align: 'cm', minw: 3 }, nodes: [
        { n: G.UIT.O, config: { object: new DynaText({ string: [{ ref_table: G.GAME.blind, ref_value: 'loc_name' }], colours: [G.C.UI.TEXT_LIGHT], shadow: true, rotate: true, silent: true, float: true, scale: 1.6 * scale, y_offset: -4 }), id: 'HUD_blind_name' } },
      ] },
    ] },
    { n: G.UIT.R, config: { align: 'cm', minh: 2.74, r: 0.1, colour: G.C.DYN_UI.DARK }, nodes: [
      { n: G.UIT.R, config: { align: 'cm', padding: 0.05 }, nodes: [
        { n: G.UIT.R, config: { align: 'cm', minh: 0.3, maxw: 4.2 }, nodes: [
          { n: G.UIT.T, config: { ref_table: { val: '' }, ref_value: 'val', scale: scale * 0.9, colour: G.C.UI.TEXT_LIGHT, func: 'HUD_blind_debuff_prefix' } },
          { n: G.UIT.T, config: { ref_table: G.GAME.blind.loc_debuff_lines, ref_value: 0, scale: scale * 0.9, colour: G.C.UI.TEXT_LIGHT, id: 'HUD_blind_debuff_1', func: 'HUD_blind_debuff' } },
        ] },
        { n: G.UIT.R, config: { align: 'cm', minh: 0.3, maxw: 4.2 }, nodes: [
          { n: G.UIT.T, config: { ref_table: G.GAME.blind.loc_debuff_lines, ref_value: 1, scale: scale * 0.9, colour: G.C.UI.TEXT_LIGHT, id: 'HUD_blind_debuff_2', func: 'HUD_blind_debuff' } },
        ] },
      ] },
      { n: G.UIT.R, config: { align: 'cm', padding: 0.15 }, nodes: [
        { n: G.UIT.O, config: { object: G.GAME.blind, draw_layer: 1 } },
        { n: G.UIT.C, config: { align: 'cm', r: 0.1, padding: 0.05, emboss: 0.05, minw: 2.9, colour: G.C.BLACK }, nodes: [
          { n: G.UIT.R, config: { align: 'cm', maxw: 2.8 }, nodes: [
            { n: G.UIT.T, config: { text: localize('ph_blind_score_at_least'), scale: 0.3, colour: G.C.WHITE, shadow: true } },
          ] },
          { n: G.UIT.R, config: { align: 'cm', minh: 0.6 }, nodes: [
            { n: G.UIT.O, config: { w: 0.5, h: 0.5, colour: G.C.BLUE, object: stake_sprite, hover: true, can_collide: false } },
            { n: G.UIT.B, config: { h: 0.1, w: 0.1 } },
            { n: G.UIT.T, config: { ref_table: G.GAME.blind, ref_value: 'chip_text', scale: 0.001, colour: G.C.RED, shadow: true, id: 'HUD_blind_count', func: 'blind_chip_UI_scale' } },
          ] },
          { n: G.UIT.R, config: { align: 'cm', minh: 0.45, maxw: 2.8, func: 'HUD_blind_reward' }, nodes: [
            { n: G.UIT.T, config: { text: localize('ph_blind_reward'), scale: 0.3, colour: G.C.WHITE } },
            { n: G.UIT.O, config: { object: new DynaText({ string: [{ ref_table: G.GAME.current_round, ref_value: 'dollars_to_be_earned' }], colours: [G.C.MONEY], shadow: true, rotate: true, bump: true, silent: true, scale: 0.45 }), id: 'dollars_to_be_earned' } },
          ] },
        ] },
      ] },
    ] },
  ] };
}

export function create_UIBox_HUD() {
  const scale = 0.4;
  const stake_sprite = get_stake_sprite(G.GAME.stake || 1, 0.5);
  const font = G.LANGUAGES['en-us'].font;
  const spacing = 0.13;
  const temp_col = G.C.DYN_UI.BOSS_MAIN;
  const temp_col2 = G.C.DYN_UI.BOSS_DARK;
  const contents: any = {};
  contents.round = [
    { n: G.UIT.R, config: { align: 'cm' }, nodes: [
      { n: G.UIT.C, config: { id: 'hud_hands', align: 'cm', padding: 0.05, minw: 1.45, colour: temp_col, emboss: 0.05, r: 0.1 }, nodes: [
        { n: G.UIT.R, config: { align: 'cm', minh: 0.33, maxw: 1.35 }, nodes: [
          { n: G.UIT.T, config: { text: localize('k_hud_hands'), scale: 0.85 * scale, colour: G.C.UI.TEXT_LIGHT, shadow: true } },
        ] },
        { n: G.UIT.R, config: { align: 'cm', r: 0.1, minw: 1.2, colour: temp_col2 }, nodes: [
          { n: G.UIT.O, config: { object: new DynaText({ string: [{ ref_table: G.GAME.current_round, ref_value: 'hands_left' }], font, colours: [G.C.BLUE], shadow: true, rotate: true, scale: 2 * scale }), id: 'hand_UI_count' } },
        ] },
      ] },
      { n: G.UIT.C, config: { minw: spacing }, nodes: [] },
      { n: G.UIT.C, config: { align: 'cm', padding: 0.05, minw: 1.45, colour: temp_col, emboss: 0.05, r: 0.1 }, nodes: [
        { n: G.UIT.R, config: { align: 'cm', minh: 0.33, maxw: 1.35 }, nodes: [
          { n: G.UIT.T, config: { text: localize('k_hud_discards'), scale: 0.85 * scale, colour: G.C.UI.TEXT_LIGHT, shadow: true } },
        ] },
        { n: G.UIT.R, config: { align: 'cm' }, nodes: [
          { n: G.UIT.R, config: { align: 'cm', r: 0.1, minw: 1.2, colour: temp_col2 }, nodes: [
            { n: G.UIT.O, config: { object: new DynaText({ string: [{ ref_table: G.GAME.current_round, ref_value: 'discards_left' }], font, colours: [G.C.RED], shadow: true, rotate: true, scale: 2 * scale }), id: 'discard_UI_count' } },
          ] },
        ] },
      ] },
    ] },
    { n: G.UIT.R, config: { minh: spacing }, nodes: [] },
    { n: G.UIT.R, config: { align: 'cm' }, nodes: [
      { n: G.UIT.C, config: { align: 'cm', padding: 0.05, minw: 1.45 * 2 + spacing, minh: 1.15, colour: temp_col, emboss: 0.05, r: 0.1 }, nodes: [
        { n: G.UIT.R, config: { align: 'cm' }, nodes: [
          { n: G.UIT.C, config: { align: 'cm', r: 0.1, minw: 1.28 * 2 + spacing, minh: 1, colour: temp_col2 }, nodes: [
            { n: G.UIT.O, config: { object: new DynaText({ string: [{ ref_table: G.GAME, ref_value: 'dollars', prefix: localize('$') }], maxw: 1.35, colours: [G.C.MONEY], font, shadow: true, spacing: 2, bump: true, scale: 2.2 * scale }), id: 'dollar_text_UI' } },
          ] },
        ] },
      ] },
    ] },
    { n: G.UIT.R, config: { minh: spacing }, nodes: [] },
    { n: G.UIT.R, config: { align: 'cm' }, nodes: [
      { n: G.UIT.C, config: { id: 'hud_ante', align: 'cm', padding: 0.05, minw: 1.45, minh: 1, colour: temp_col, emboss: 0.05, r: 0.1 }, nodes: [
        { n: G.UIT.R, config: { align: 'cm', minh: 0.33, maxw: 1.35 }, nodes: [
          { n: G.UIT.T, config: { text: localize('k_ante'), scale: 0.85 * scale, colour: G.C.UI.TEXT_LIGHT, shadow: true } },
        ] },
        { n: G.UIT.R, config: { align: 'cm', r: 0.1, minw: 1.2, colour: temp_col2 }, nodes: [
          { n: G.UIT.O, config: { object: new DynaText({ string: [{ ref_table: G.GAME.round_resets, ref_value: 'ante' }], colours: [G.C.IMPORTANT], shadow: true, font, scale: 2 * scale }), id: 'ante_UI_count' } },
          { n: G.UIT.T, config: { text: ' ', scale: 0.3 * scale } },
          { n: G.UIT.T, config: { text: '/ ', scale: 0.7 * scale, colour: G.C.WHITE, shadow: true } },
          { n: G.UIT.T, config: { ref_table: G.GAME, ref_value: 'win_ante', scale, colour: G.C.WHITE, shadow: true } },
        ] },
      ] },
      { n: G.UIT.C, config: { minw: spacing }, nodes: [] },
      { n: G.UIT.C, config: { align: 'cm', padding: 0.05, minw: 1.45, minh: 1, colour: temp_col, emboss: 0.05, r: 0.1 }, nodes: [
        { n: G.UIT.R, config: { align: 'cm', maxw: 1.35 }, nodes: [
          { n: G.UIT.T, config: { text: localize('k_round'), minh: 0.33, scale: 0.85 * scale, colour: G.C.UI.TEXT_LIGHT, shadow: true } },
        ] },
        { n: G.UIT.R, config: { align: 'cm', r: 0.1, minw: 1.2, colour: temp_col2, id: 'row_round_text' }, nodes: [
          { n: G.UIT.O, config: { object: new DynaText({ string: [{ ref_table: G.GAME, ref_value: 'round' }], colours: [G.C.IMPORTANT], shadow: true, scale: 2 * scale }), id: 'round_UI_count' } },
        ] },
      ] },
    ] },
  ];

  const ch = G.GAME.current_round.current_hand;
  contents.hand = { n: G.UIT.R, config: { align: 'cm', id: 'hand_text_area', colour: darken(G.C.BLACK, 0.1), r: 0.1, emboss: 0.05, padding: 0.03 }, nodes: [
    { n: G.UIT.C, config: { align: 'cm' }, nodes: [
      { n: G.UIT.R, config: { align: 'cm', minh: 1.1 }, nodes: [
        { n: G.UIT.O, config: { id: 'hand_name', func: 'hand_text_UI_set', object: new DynaText({ string: [{ ref_table: ch, ref_value: 'handname_text' }], colours: [G.C.UI.TEXT_LIGHT], shadow: true, float: true, scale: scale * 1.4 }) } },
        { n: G.UIT.O, config: { id: 'hand_chip_total', func: 'hand_chip_total_UI_set', object: new DynaText({ string: [{ ref_table: ch, ref_value: 'chip_total_text' }], colours: [G.C.UI.TEXT_LIGHT], shadow: true, float: true, scale: scale * 1.4 }) } },
        { n: G.UIT.T, config: { ref_table: ch, ref_value: 'hand_level', scale, colour: G.C.UI.TEXT_LIGHT, id: 'hand_level', shadow: true } },
      ] },
      { n: G.UIT.R, config: { align: 'cm', minh: 1, padding: 0.1 }, nodes: [
        { n: G.UIT.C, config: { align: 'cr', minw: 2, minh: 1, r: 0.1, colour: G.C.UI_CHIPS, id: 'hand_chip_area', emboss: 0.05 }, nodes: [
          { n: G.UIT.O, config: { func: 'flame_handler', no_role: true, id: 'flame_chips', object: new Moveable(0, 0, 0, 0), w: 0, h: 0 } },
          { n: G.UIT.O, config: { id: 'hand_chips', func: 'hand_chip_UI_set', object: new DynaText({ string: [{ ref_table: ch, ref_value: 'chip_text' }], colours: [G.C.UI.TEXT_LIGHT], font, shadow: true, float: true, scale: scale * 2.3 }) } },
          { n: G.UIT.B, config: { w: 0.1, h: 0.1 } },
        ] },
        { n: G.UIT.C, config: { align: 'cm' }, nodes: [
          { n: G.UIT.T, config: { text: 'X', lang: G.LANGUAGES['en-us'], scale: scale * 2, colour: G.C.UI_MULT, shadow: true } },
        ] },
        { n: G.UIT.C, config: { align: 'cl', minw: 2, minh: 1, r: 0.1, colour: G.C.UI_MULT, id: 'hand_mult_area', emboss: 0.05 }, nodes: [
          { n: G.UIT.O, config: { func: 'flame_handler', no_role: true, id: 'flame_mult', object: new Moveable(0, 0, 0, 0), w: 0, h: 0 } },
          { n: G.UIT.B, config: { w: 0.1, h: 0.1 } },
          { n: G.UIT.O, config: { id: 'hand_mult', func: 'hand_mult_UI_set', object: new DynaText({ string: [{ ref_table: ch, ref_value: 'mult_text' }], colours: [G.C.UI.TEXT_LIGHT], font, shadow: true, float: true, scale: scale * 2.3 }) } },
        ] },
      ] },
    ] },
  ] };

  contents.dollars_chips = { n: G.UIT.R, config: { align: 'cm', r: 0.1, padding: 0, colour: G.C.DYN_UI.BOSS_MAIN, emboss: 0.05, id: 'row_dollars_chips' }, nodes: [
    { n: G.UIT.C, config: { align: 'cm', padding: 0.1 }, nodes: [
      { n: G.UIT.C, config: { align: 'cm', minw: 1.3 }, nodes: [
        { n: G.UIT.R, config: { align: 'cm', padding: 0, maxw: 1.3 }, nodes: [
          { n: G.UIT.T, config: { text: localize('k_round'), scale: 0.42, colour: G.C.UI.TEXT_LIGHT, shadow: true } },
        ] },
        { n: G.UIT.R, config: { align: 'cm', padding: 0, maxw: 1.3 }, nodes: [
          { n: G.UIT.T, config: { text: localize('k_lower_score'), scale: 0.42, colour: G.C.UI.TEXT_LIGHT, shadow: true } },
        ] },
      ] },
      { n: G.UIT.C, config: { align: 'cm', minw: 3.3, minh: 0.7, r: 0.1, colour: G.C.DYN_UI.BOSS_DARK }, nodes: [
        { n: G.UIT.O, config: { w: 0.5, h: 0.5, object: stake_sprite, hover: true, can_collide: false } },
        { n: G.UIT.B, config: { w: 0.1, h: 0.1 } },
        { n: G.UIT.T, config: { ref_table: G.GAME, ref_value: 'chips_text', lang: G.LANGUAGES['en-us'], scale: 0.85, colour: G.C.WHITE, id: 'chip_UI_count', func: 'chip_UI_set', shadow: true } },
      ] },
    ] },
  ] };

  contents.buttons = [
    { n: G.UIT.C, config: { align: 'cm', r: 0.1, colour: G.C.CLEAR, shadow: true, id: 'button_area', padding: 0.2 }, nodes: [
      { n: G.UIT.R, config: { id: 'run_info_button', align: 'cm', minh: 1.75, minw: 1.5, padding: 0.05, r: 0.1, hover: true, colour: G.C.RED, button: 'run_info', shadow: true }, nodes: [
        { n: G.UIT.R, config: { align: 'cm', padding: 0, maxw: 1.4 }, nodes: [
          { n: G.UIT.T, config: { text: localize('b_run_info_1'), scale: 1.2 * scale, colour: G.C.UI.TEXT_LIGHT, shadow: true } },
        ] },
        { n: G.UIT.R, config: { align: 'cm', padding: 0, maxw: 1.4 }, nodes: [
          { n: G.UIT.T, config: { text: localize('b_run_info_2'), scale: 1 * scale, colour: G.C.UI.TEXT_LIGHT, shadow: true, focus_args: { button: G.F_GUIDE ? 'guide' : 'back', orientation: 'bm' }, func: 'set_button_pip' } },
        ] },
      ] },
      { n: G.UIT.R, config: { align: 'cm', minh: 1.75, minw: 1.5, padding: 0.05, r: 0.1, hover: true, colour: G.C.ORANGE, button: 'options', shadow: true }, nodes: [
        { n: G.UIT.C, config: { align: 'cm', maxw: 1.4, focus_args: { button: 'start', orientation: 'bm' }, func: 'set_button_pip' }, nodes: [
          { n: G.UIT.T, config: { text: localize('b_options'), scale, colour: G.C.UI.TEXT_LIGHT, shadow: true } },
        ] },
      ] },
    ] },
  ];

  return { n: G.UIT.ROOT, config: { align: 'cm', padding: 0.03, colour: G.C.UI.TRANSPARENT_DARK }, nodes: [
    { n: G.UIT.R, config: { align: 'cm', padding: 0.05, colour: G.C.DYN_UI.MAIN, r: 0.1 }, nodes: [
      { n: G.UIT.R, config: { align: 'cm', colour: G.C.DYN_UI.BOSS_DARK, r: 0.1, minh: 30, padding: 0.08 }, nodes: [
        { n: G.UIT.R, config: { align: 'cm', minh: 0.3 }, nodes: [] },
        { n: G.UIT.R, config: { align: 'cm', id: 'row_blind', minw: 1, minh: 3.75 }, nodes: [] },
        contents.dollars_chips,
        contents.hand,
        { n: G.UIT.R, config: { align: 'cm', id: 'row_round' }, nodes: [
          { n: G.UIT.C, config: { align: 'cm' }, nodes: contents.buttons },
          { n: G.UIT.C, config: { align: 'cm' }, nodes: contents.round },
        ] },
      ] },
    ] },
  ] };
}
