// localize / loc_parse_string / init_localization / loc_colour
// (misc_functions.lua): the game's text, with its {C:mult}...{} colour codes
// and #1# variables, turned into strings or UI nodes.
import { G, DynaText, tostring } from '@/shared/lib/engine';
import { ipairs } from '@/shared/lib/lua';

export interface LocPart { strings: (string | [string])[]; control: Record<string, string> }
export type LocLine = LocPart[];

export function loc_colour(c?: string | null, def?: number[]): number[] {
  G.ARGS.LOC_COLOURS = G.ARGS.LOC_COLOURS ?? {
    red: G.C.RED, mult: G.C.MULT, blue: G.C.BLUE, chips: G.C.CHIPS, green: G.C.GREEN, money: G.C.MONEY,
    gold: G.C.GOLD, attention: G.C.FILTER, purple: G.C.PURPLE, white: G.C.WHITE, inactive: G.C.UI.TEXT_INACTIVE,
    spades: G.C.SUITS.Spades, hearts: G.C.SUITS.Hearts, clubs: G.C.SUITS.Clubs, diamonds: G.C.SUITS.Diamonds,
    tarot: G.C.SECONDARY_SET.Tarot, planet: G.C.SECONDARY_SET.Planet, spectral: G.C.SECONDARY_SET.Spectral,
    edition: G.C.EDITION, dark_edition: G.C.DARK_EDITION, legendary: G.C.RARITY[4], enhanced: G.C.SECONDARY_SET.Enhanced,
  };
  return (c ? G.ARGS.LOC_COLOURS[c] : undefined) ?? def ?? G.C.UI.TEXT_DARK;
}

/** null for an empty line (the game's parser returns nil, and the line is dropped) */
export function loc_parse_string(line: string): LocLine | null {
  if (!line) return null;
  const parsed: LocLine = [];
  let control: Record<string, string> = {};
  let _c = false, _c_name: string | null = null, _c_val: string | null = null, _c_gather = false;
  let _s_gather = false, _s_ref: string | null = null;
  let str_parts: any[] = [], str_it = 0;
  const chars = Array.from(line);
  for (let i = 0; i < chars.length; i++) {
    const ch = chars[i];
    if (ch === '{') {
      if (str_parts[0] !== undefined) parsed.push({ strings: str_parts, control: control ?? {} });
      str_parts = []; str_it = 0;
      control = {}; _c_name = null; _c_val = null; _c_gather = false;
      _s_gather = false; _s_ref = null;
      _c = true;
    } else if (_c && !(ch === ':' || ch === '}') && !_c_gather) {
      _c_name = (_c_name ?? '') + ch;
    } else if (_c && ch === ':') {
      _c_gather = true;
    } else if (_c && !(ch === ',' || ch === '}') && _c_gather) {
      _c_val = (_c_val ?? '') + ch;
    } else if (_c && (ch === ',' || ch === '}')) {
      _c_gather = false;
      if (_c_name) control[_c_name] = _c_val as string;
      _c_name = null; _c_val = null;
      if (ch === '}') _c = false;
    } else if (!_c && ch !== '#' && !_s_gather) {
      str_parts[str_it] = (str_parts[str_it] ?? '') + (control.X ? ch.replace(/\s+/g, '') : ch);
    } else if (!_c && ch === '#' && !_s_gather) {
      _s_gather = true;
      if (str_parts[str_it] !== undefined) str_it++;
    } else if (!_c && ch === '#' && _s_gather) {
      _s_gather = false;
      if (_s_ref) { str_parts[str_it] = [_s_ref]; str_it++; _s_ref = null; }
    } else if (!_c && _s_gather) {
      _s_ref = (_s_ref ?? '') + ch;
    }
    if (i === chars.length - 1) {
      if (str_parts[0] !== undefined) parsed.push({ strings: str_parts.filter((p) => p !== undefined), control: control ?? {} });
      return parsed;
    }
  }
  return parsed;
}

export function init_localization() {
  const L = G.localization;
  const misc = L.misc;
  misc.v_dictionary_parsed = {};
  for (const k of Object.keys(misc.v_dictionary)) {
    const v = misc.v_dictionary[k];
    if (typeof v === 'object') {
      const p: any = { multi_line: true, lines: ipairs(v).map((vv: string) => loc_parse_string(vv)).filter(Boolean) };
      misc.v_dictionary_parsed[k] = p;
    } else {
      const p = loc_parse_string(v);
      if (p) misc.v_dictionary_parsed[k] = p;
    }
  }
  misc.v_text_parsed = {};
  const parseAll = (lines: any) => ipairs(lines).map((vv: string) => loc_parse_string(vv)).filter(Boolean);
  for (const k of Object.keys(misc.v_text)) misc.v_text_parsed[k] = parseAll(misc.v_text[k]);
  L.tutorial_parsed = {};
  for (const k of Object.keys(misc.tutorial ?? {})) L.tutorial_parsed[k] = parseAll(misc.tutorial[k]);
  L.quips_parsed = {};
  for (const k of Object.keys(misc.quips ?? {})) L.quips_parsed[k] = parseAll(misc.quips[k]);
  for (const set of Object.values<any>(L.descriptions)) {
    for (const center of Object.values<any>(set)) {
      center.text_parsed = [];
      if (!center.text) continue;
      center.text_parsed = parseAll(center.text);
      center.name_parsed = parseAll(typeof center.name === 'object' ? center.name : [center.name]);
      if (center.unlock) center.unlock_parsed = parseAll(center.unlock);
    }
  }
}

function sub(part: string | [string], vars: any[] | undefined, err = true): string {
  if (typeof part === 'string') return part;
  const v = vars ? vars[Number(part[0]) - 1] : undefined;
  if (v === undefined || v === null) return err ? 'ERROR' : '';
  return tostring(v);
}

/**
 * localize(key[, misc_cat]) for a dictionary string, or localize{type = ...}
 * for descriptions, names and variable strings ('vars' are 1-based in the
 * text: #1# is vars[0]).
 */
export function localize(args: any, misc_cat?: string): any {
  const L = G.localization;
  if (args !== null && args !== undefined && typeof args !== 'object') {
    if (misc_cat && L.misc[misc_cat]) return L.misc[misc_cat][args] ?? 'ERROR';
    return L.misc.dictionary[args] ?? 'ERROR';
  }
  let loc_target: any = null;
  let ret_string: string | null = null;
  if (args.type === 'other') {
    loc_target = L.descriptions.Other[args.key];
  } else if (args.type === 'descriptions' || args.type === 'unlocks') {
    loc_target = L.descriptions[args.set]?.[args.key];
  } else if (args.type === 'tutorial') {
    loc_target = L.tutorial_parsed[args.key];
  } else if (args.type === 'quips') {
    loc_target = L.quips_parsed[args.key];
  } else if (args.type === 'raw_descriptions') {
    loc_target = L.descriptions[args.set]?.[args.key];
    const multi: string[] = [];
    if (loc_target) {
      for (const lines of loc_target.text_parsed as LocLine[]) {
        let final = '';
        for (const part of lines) for (const s of part.strings) final += sub(s, args.vars);
        multi.push(final);
      }
    }
    return multi;
  } else if (args.type === 'text') {
    loc_target = L.misc.v_text_parsed[args.key];
  } else if (args.type === 'variable') {
    loc_target = L.misc.v_dictionary_parsed[args.key];
    if (!loc_target) return 'ERROR';
    if (loc_target.multi_line) {
      return loc_target.lines.map((line: LocLine) => line[0].strings.map((s) => sub(s, args.vars, false)).join(''));
    }
    ret_string = loc_target[0].strings.map((s: any) => sub(s, args.vars, false)).join('');
  } else if (args.type === 'name_text') {
    try {
      ret_string = L.descriptions[args.set ?? args.node.config.center.set][args.key ?? args.node.config.center.key].name;
      if (ret_string === undefined) ret_string = 'ERROR';
    } catch { ret_string = 'ERROR'; }
  } else if (args.type === 'name') {
    loc_target = L.descriptions[args.set ?? args.node.config.center.set]?.[args.key ?? args.node.config.center.key];
  }
  if (ret_string !== null) return ret_string;

  if (loc_target) {
    const groups: LocLine[] = args.type === 'unlocks' ? loc_target.unlock_parsed
      : args.type === 'name' ? loc_target.name_parsed
        : (args.type === 'text' || args.type === 'tutorial' || args.type === 'quips') ? loc_target
          : loc_target.text_parsed;
    for (const lines of groups ?? []) {
      const final_line: any[] = [];
      for (const part of lines) {
        const assembled = part.strings.map((s) => sub(s, args.vars)).join('');
        let desc_scale = G.LANG.font.DESCSCALE;
        if (G.F_MOBILE_UI) desc_scale *= 1.5;
        const c = part.control;
        if (args.type === 'name') {
          final_line.push({
            n: G.UIT.O, config: {
              object: new DynaText({
                string: [assembled],
                colours: [(c.V && args.vars.colours[Number(c.V) - 1]) || (c.C && loc_colour(c.C)) || G.C.UI.TEXT_LIGHT],
                bump: true, silent: true, pop_in: 0, pop_in_rate: 4, maxw: 5, shadow: true, y_offset: -0.6,
                spacing: Math.max(0, 0.32 * (17 - new TextEncoder().encode(assembled).length)),
                scale: (0.55 - 0.004 * new TextEncoder().encode(assembled).length) * (c.s ? Number(c.s) : 1),
              }),
            },
          });
        } else if (c.E) {
          let _float, _silent = true, _pop_in, _bump, _spacing;
          if (c.E === '1') { _float = true; _silent = true; _pop_in = 0; }
          else if (c.E === '2') { _bump = true; _spacing = 1; }
          final_line.push({
            n: G.UIT.O, config: {
              object: new DynaText({
                string: [assembled],
                colours: [c.V ? args.vars.colours[Number(c.V) - 1] : loc_colour(c.C ?? null)],
                float: _float, silent: _silent, pop_in: _pop_in, bump: _bump, spacing: _spacing,
                scale: 0.32 * (c.s ? Number(c.s) : 1) * desc_scale,
              }),
            },
          });
        } else if (c.X) {
          final_line.push({
            n: G.UIT.C, config: { align: 'm', colour: loc_colour(c.X), r: 0.05, padding: 0.03, res: 0.15 }, nodes: [
              { n: G.UIT.T, config: { text: assembled, colour: loc_colour(c.C ?? null), scale: 0.32 * (c.s ? Number(c.s) : 1) * desc_scale } },
            ],
          });
        } else {
          final_line.push({
            n: G.UIT.T, config: {
              detailed_tooltip: c.T ? (G.P_CENTERS[c.T] ?? G.P_TAGS[c.T]) : null,
              text: assembled,
              shadow: args.shadow,
              colour: c.V ? args.vars.colours[Number(c.V) - 1] : loc_colour(c.C ?? null, args.default_col),
              scale: 0.32 * (c.s ? Number(c.s) : 1) * desc_scale,
            },
          });
        }
      }
      if (args.type === 'name' || args.type === 'text') return final_line;
      args.nodes.push(final_line);
    }
  }
  return undefined;
}
