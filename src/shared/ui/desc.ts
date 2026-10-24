// Description layouts (UI_definitions.lua): rows of localized text, info
// tips, names and badges.
import { G, DynaText, lighten } from '@/shared/lib/engine';
import type { Def } from './widgets';

export function desc_from_rows(desc_nodes: any[], empty?: boolean, maxw?: number): Def {
  const t = desc_nodes.map((v) => ({ n: G.UIT.R, config: { align: 'cm', maxw }, nodes: v }));
  return { n: G.UIT.R, config: { align: 'cm', colour: empty ? G.C.CLEAR : G.C.UI.BACKGROUND_WHITE, r: 0.1, padding: 0.04, minw: 2, minh: 0.8, emboss: !empty ? 0.05 : null, filler: true }, nodes: [
    { n: G.UIT.R, config: { align: 'cm', padding: 0.03 }, nodes: t },
  ] };
}

export function info_tip_from_rows(desc_nodes: any[], name: string): Def {
  const t = desc_nodes.map((v) => ({ n: G.UIT.R, config: { align: 'cm' }, nodes: v }));
  return { n: G.UIT.R, config: { align: 'cm', colour: lighten(G.C.GREY, 0.15), r: 0.1 }, nodes: [
    { n: G.UIT.R, config: { align: 'tm', minh: 0.36, padding: 0.03 }, nodes: [{ n: G.UIT.T, config: { text: name, scale: 0.32, colour: G.C.UI.TEXT_LIGHT } }] },
    { n: G.UIT.R, config: { align: 'cm', minw: 1.5, minh: 0.4, r: 0.1, padding: 0.05, colour: G.C.WHITE }, nodes: [{ n: G.UIT.R, config: { align: 'cm', padding: 0.03 }, nodes: t }] },
  ] };
}

export function name_from_rows(name_nodes: any, background_colour?: any): Def {
  if (!name_nodes || typeof name_nodes !== 'object' || (Array.isArray(name_nodes) && name_nodes.length === 0)) return null;
  return { n: G.UIT.R, config: { align: 'cm', padding: 0.05, r: 0.1, colour: background_colour, emboss: background_colour ? 0.05 : null }, nodes: name_nodes };
}

export function get_badge_colour(key: string) {
  G.BADGE_COL = G.BADGE_COL ?? {
    eternal: G.C.ETERNAL, perishable: G.C.PERISHABLE, rental: G.C.RENTAL, foil: G.C.DARK_EDITION, holographic: G.C.DARK_EDITION,
    polychrome: G.C.DARK_EDITION, negative: G.C.DARK_EDITION, gold_seal: G.C.GOLD, red_seal: G.C.RED, blue_seal: G.C.BLUE,
    purple_seal: G.C.PURPLE, pinned_left: G.C.ORANGE,
  };
  return G.BADGE_COL[key] ?? [1, 0, 0, 1];
}

export function create_badge(_string: string, _badge_col?: any, _text_col?: any, scaling = 1): Def {
  return { n: G.UIT.R, config: { align: 'cm' }, nodes: [
    { n: G.UIT.R, config: { align: 'cm', colour: _badge_col ?? G.C.GREEN, r: 0.1, minw: 2, minh: 0.4 * scaling, emboss: 0.05, padding: 0.03 * scaling }, nodes: [
      { n: G.UIT.B, config: { h: 0.1, w: 0.03 } },
      { n: G.UIT.O, config: { object: new DynaText({ string: _string ?? 'ERROR', colours: [_text_col ?? G.C.WHITE], float: true, shadow: true, offset_y: -0.05, silent: true, spacing: 1, scale: 0.33 * scaling }) } },
      { n: G.UIT.B, config: { h: 0.1, w: 0.03 } },
    ] },
  ] };
}

