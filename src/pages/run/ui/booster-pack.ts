// The opened booster pack: create_UIBox_arcana_pack and its four siblings
// (UI_definitions.lua). They differ by title and by the cards' spacing.
import { G, DynaText } from '@/shared/lib/engine';
import { localize } from '@/shared/lib/localization';
import { UIBox_dyn_container } from '@/shared/ui';
import { CardArea } from '@/entities/card';

export type PackKind = 'tarot' | 'planet' | 'spectral' | 'standard' | 'buffoon';

const TITLE: Record<PackKind, string> = {
  tarot: 'k_arcana_pack', planet: 'k_celestial_pack', spectral: 'k_spectral_pack', standard: 'k_standard_pack', buffoon: 'k_buffoon_pack',
};

function pack_width(kind: PackKind, size: number) {
  if (kind === 'tarot' || kind === 'spectral') return size * G.CARD_W;
  if (kind === 'planet') return size * G.CARD_W * 1.1 + 0.5;
  return size * G.CARD_W * 1.1;
}

export function create_UIBox_pack(kind: PackKind) {
  const _size = G.GAME.pack_size;
  G.pack_cards = new CardArea(G.ROOM.T.x + 9 + G.hand.T.x, G.hand.T.y, pack_width(kind, _size), 1.05 * G.CARD_H,
    { card_limit: _size, type: 'consumeable', highlight_limit: 1 });
  return { n: G.UIT.ROOT, config: { align: 'tm', r: 0.15, colour: G.C.CLEAR, padding: 0.15 }, nodes: [
    { n: G.UIT.R, config: { align: 'cl', colour: G.C.CLEAR, r: 0.15, padding: 0.1, minh: 2, shadow: true }, nodes: [
      { n: G.UIT.R, config: { align: 'cm' }, nodes: [
        { n: G.UIT.C, config: { align: 'cm', padding: 0.1 }, nodes: [
          { n: G.UIT.C, config: { align: 'cm', r: 0.2, colour: G.C.CLEAR, shadow: true }, nodes: [
            { n: G.UIT.O, config: { object: G.pack_cards } },
          ] },
        ] },
      ] },
      { n: G.UIT.R, config: { align: 'cm' }, nodes: [] },
      { n: G.UIT.R, config: { align: 'tm' }, nodes: [
        { n: G.UIT.C, config: { align: 'tm', padding: 0.05, minw: 2.4 }, nodes: [] },
        { n: G.UIT.C, config: { align: 'tm', padding: 0.05 }, nodes: [
          UIBox_dyn_container([
            { n: G.UIT.C, config: { align: 'cm', padding: 0.05, minw: 4 }, nodes: [
              { n: G.UIT.R, config: { align: 'bm', padding: 0.05 }, nodes: [
                { n: G.UIT.O, config: { object: new DynaText({ string: localize(TITLE[kind]), colours: [G.C.WHITE], shadow: true, rotate: true, bump: true, spacing: 2, scale: 0.7, maxw: 4, pop_in: 0.5 }) } },
              ] },
              { n: G.UIT.R, config: { align: 'bm', padding: 0.05 }, nodes: [
                { n: G.UIT.O, config: { object: new DynaText({ string: [localize('k_choose') + ' '], colours: [G.C.WHITE], shadow: true, rotate: true, bump: true, spacing: 2, scale: 0.5, pop_in: 0.7 }) } },
                { n: G.UIT.O, config: { object: new DynaText({ string: [{ ref_table: G.GAME, ref_value: 'pack_choices' }], colours: [G.C.WHITE], shadow: true, rotate: true, bump: true, spacing: 2, scale: 0.5, pop_in: 0.7 }) } },
              ] },
            ] },
          ]),
        ] },
        { n: G.UIT.C, config: { align: 'tm', padding: 0.05, minw: 2.4 }, nodes: [
          { n: G.UIT.R, config: { minh: 0.2 }, nodes: [] },
          { n: G.UIT.R, config: { align: 'tm', padding: 0.2, minh: 1.2, minw: 1.8, r: 0.15, colour: G.C.GREY, one_press: true, button: 'skip_booster', hover: true, shadow: true, func: 'can_skip_booster' }, nodes: [
            { n: G.UIT.T, config: { text: localize('b_skip'), scale: 0.5, colour: G.C.WHITE, shadow: true, focus_args: { button: 'y', orientation: 'bm' }, func: 'set_button_pip' } },
          ] },
        ] },
      ] },
    ] },
  ] };
}

/** the pack kind of a booster center ('Arcana Pack' -> tarot...) */
export function pack_kind(center: any): PackKind {
  const n: string = center?.name ?? '';
  if (n.includes('Arcana')) return 'tarot';
  if (n.includes('Celestial')) return 'planet';
  if (n.includes('Spectral')) return 'spectral';
  if (n.includes('Standard')) return 'standard';
  return 'buffoon';
}
