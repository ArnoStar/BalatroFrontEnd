// create_UIBox_buttons (UI_definitions.lua): Play Hand, Sort Hand, Discard.
import { G, mix_colours } from '@/shared/lib/engine';
import { localize } from '@/shared/lib/localization';

export function create_UIBox_buttons() {
  const text_scale = 0.45;
  const button_height = 1.3;
  const play_button = { n: G.UIT.C, config: { id: 'play_button', align: 'tm', minw: 2.5, padding: 0.3, r: 0.1, hover: true, colour: G.C.BLUE, button: 'play_cards_from_highlighted', one_press: true, shadow: true, func: 'can_play' }, nodes: [
    { n: G.UIT.R, config: { align: 'bcm', padding: 0 }, nodes: [
      { n: G.UIT.T, config: { text: localize('b_play_hand'), scale: text_scale, colour: G.C.UI.TEXT_LIGHT, focus_args: { button: 'x', orientation: 'bm' }, func: 'set_button_pip' } },
    ] },
  ] };
  const discard_button = { n: G.UIT.C, config: { id: 'discard_button', align: 'tm', padding: 0.3, r: 0.1, minw: 2.5, minh: button_height, hover: true, colour: G.C.RED, button: 'discard_cards_from_highlighted', one_press: true, shadow: true, func: 'can_discard' }, nodes: [
    { n: G.UIT.R, config: { align: 'cm', padding: 0 }, nodes: [
      { n: G.UIT.T, config: { text: localize('b_discard'), scale: text_scale, colour: G.C.UI.TEXT_LIGHT, focus_args: { button: 'y', orientation: 'bm' }, func: 'set_button_pip' } },
    ] },
  ] };
  return { n: G.UIT.ROOT, config: { align: 'cm', minw: 1, minh: 0.3, padding: 0.15, r: 0.1, colour: G.C.CLEAR }, nodes: [
    G.SETTINGS.play_button_pos === 1 ? discard_button : play_button,
    { n: G.UIT.C, config: { align: 'cm', padding: 0.1, r: 0.1, colour: G.C.UI.TRANSPARENT_DARK, outline: 1.5, outline_colour: mix_colours(G.C.WHITE, G.C.JOKER_GREY, 0.7), line_emboss: 1 }, nodes: [
      { n: G.UIT.R, config: { align: 'cm', padding: 0 }, nodes: [
        { n: G.UIT.R, config: { align: 'cm', padding: 0 }, nodes: [
          { n: G.UIT.T, config: { text: localize('b_sort_hand'), scale: text_scale * 0.8, colour: G.C.UI.TEXT_LIGHT } },
        ] },
        { n: G.UIT.R, config: { align: 'cm', padding: 0.1 }, nodes: [
          { n: G.UIT.C, config: { align: 'cm', minh: 0.7, minw: 0.9, padding: 0.1, r: 0.1, hover: true, colour: G.C.ORANGE, button: 'sort_hand_value', shadow: true }, nodes: [
            { n: G.UIT.T, config: { text: localize('k_rank'), scale: text_scale * 0.7, colour: G.C.UI.TEXT_LIGHT } },
          ] },
          { n: G.UIT.C, config: { align: 'cm', minh: 0.7, minw: 0.9, padding: 0.1, r: 0.1, hover: true, colour: G.C.ORANGE, button: 'sort_hand_suit', shadow: true }, nodes: [
            { n: G.UIT.T, config: { text: localize('k_suit'), scale: text_scale * 0.7, colour: G.C.UI.TEXT_LIGHT } },
          ] },
        ] },
      ] },
    ] },
    G.SETTINGS.play_button_pos === 1 ? play_button : discard_button,
  ] };
}
