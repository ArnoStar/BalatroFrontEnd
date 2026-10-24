// Run Info and the deck (UI_definitions.lua: G.UIDEF.run_info,
// create_UIBox_current_hands, create_UIBox_current_hand_row,
// create_UIBox_hand_tip, current_blinds, current_stake, used_vouchers,
// deck_info, view_deck, deck_preview, tally_sprite). The deck's cards are the
// API's: what is left in the deck, and the cards seen in the hand, the play
// area and the discard pile.
import { G, Sprite, UIBox, DynaText, ease_value, play_sound, mix_colours, darken } from '@/shared/lib/engine';
import { localize } from '@/shared/lib/localization';
import { create_UIBox_generic_options, create_tabs } from '@/shared/ui';
import { get_stake_sprite, get_stake_col } from '@/shared/ui/stake';
import { Card, CardArea } from '@/entities/card';
import { run, full_deck, type DeckCard } from '@/entities/run';

/** the run's playing cards (G.playing_cards), freshly from the view */
function playing_cards(): DeckCard[] {
  return run.view ? full_deck(run.view) : [];
}

function tally_sprite(pos: { x: number; y: number }, value: any, tooltip: string[]) {
  let text_colour = G.C.BLACK;
  if (Array.isArray(value) && value[0].string === value[1].string) {
    text_colour = value[0].colour ?? G.C.WHITE;
    value = value[0].string;
  }
  const t_s = new Sprite(0, 0, 0.5, 0.5, G.ASSET_ATLAS['ui_' + (G.SETTINGS.colourblind_option ? 2 : 1)], { x: pos.x ?? 0, y: pos.y ?? 0 });
  t_s.states.drag.can = false;
  t_s.states.hover.can = false;
  t_s.states.collide.can = false;
  return { n: G.UIT.C, config: { align: 'cm', padding: 0.07, force_focus: true, focus_args: { type: 'tally_sprite' }, tooltip: { text: tooltip } }, nodes: [
    { n: G.UIT.R, config: { align: 'cm', r: 0.1, padding: 0.04, emboss: 0.05, colour: G.C.JOKER_GREY }, nodes: [
      { n: G.UIT.O, config: { w: 0.5, h: 0.5, can_collide: false, object: t_s, tooltip: { text: tooltip } } },
    ] },
    { n: G.UIT.R, config: { align: 'cm' }, nodes: [
      Array.isArray(value)
        ? { n: G.UIT.O, config: { object: new DynaText({ string: value, colours: [G.C.RED], scale: 0.4, silent: true, shadow: true, pop_in_rate: 10, pop_delay: 4 }) } }
        : { n: G.UIT.T, config: { text: value ?? 'NIL', colour: text_colour, scale: 0.4, shadow: true } },
    ] },
  ] };
}

export function view_deck(unplayed_only?: boolean) {
  const deck_tables: any[] = [];
  G.VIEWING_DECK = true;
  const all = playing_cards();
  const SUITS: Record<string, DeckCard[]> = { Spades: [], Hearts: [], Clubs: [], Diamonds: [] };
  const suit_map = ['Spades', 'Hearts', 'Clubs', 'Diamonds'];
  for (const v of all) SUITS[v.base.suit]?.push(v);
  for (const s of suit_map) {
    if (!SUITS[s][0]) continue;
    const area = new CardArea(G.ROOM.T.x + 0.2 * G.ROOM.T.w / 2, G.ROOM.T.h, 6.5 * G.CARD_W, 0.6 * G.CARD_H,
      { card_limit: SUITS[s].length, type: 'title', view_deck: true, highlight_limit: 0, card_w: G.CARD_W * 0.7, draw_layers: ['card'] });
    deck_tables.push({ n: G.UIT.R, config: { align: 'cm', padding: 0 }, nodes: [{ n: G.UIT.O, config: { object: area } }] });
    for (const v of SUITS[s]) {
      const greyed = unplayed_only && !(v.in_deck || v.ability.wheel_flipped);
      const copy: any = new Card(area.T.x + area.T.w / 2, area.T.y, G.CARD_W * 0.7, G.CARD_H * 0.7, G.P_CARDS[v.card_key], G.P_CENTERS[v.center_key] ?? G.P_CENTERS.c_base, { playing_card: 1 });
      if (v.edition) copy.set_edition({ [v.edition]: true }, true, true);
      if (v.seal) copy.set_seal(v.seal, true);
      copy.debuff = v.debuff;
      copy.greyed = greyed;
      copy.hard_set_T();
      area.emplace(copy);
    }
  }
  let flip_col = G.C.WHITE;
  const suit_tallies: Record<string, number> = { Spades: 0, Hearts: 0, Clubs: 0, Diamonds: 0 };
  const mod_suit_tallies: Record<string, number> = { Spades: 0, Hearts: 0, Clubs: 0, Diamonds: 0 };
  const rank_tallies = new Array(13).fill(0);
  const mod_rank_tallies = new Array(13).fill(0);
  const rank_name_mapping = [2, 3, 4, 5, 6, 7, 8, 9, 10, 'J', 'Q', 'K', 'A'];
  let face_tally = 0, mod_face_tally = 0, num_tally = 0, mod_num_tally = 0, ace_tally = 0, mod_ace_tally = 0, wheel_flipped = 0;
  for (const v of all) {
    if (v.ability.name === 'Stone Card' || (unplayed_only && !(v.in_deck || v.ability.wheel_flipped))) continue;
    if (v.ability.wheel_flipped && unplayed_only) wheel_flipped++;
    suit_tallies[v.base.suit] = (suit_tallies[v.base.suit] ?? 0) + 1;
    for (const s of suit_map) mod_suit_tallies[s] += v.is_suit(s) ? 1 : 0;
    const id = v.get_id();
    face_tally += (id === 11 || id === 12 || id === 13) ? 1 : 0;
    mod_face_tally += v.is_face() ? 1 : 0;
    if (id > 1 && id < 11) { num_tally++; if (!v.debuff) mod_num_tally++; }
    if (id === 14) { ace_tally++; if (!v.debuff) mod_ace_tally++; }
    rank_tallies[id - 2]++;
    if (!v.debuff) mod_rank_tallies[id - 2]++;
  }
  const modded = face_tally !== mod_face_tally || suit_map.some((s) => mod_suit_tallies[s] !== suit_tallies[s]);
  if (wheel_flipped > 0) flip_col = mix_colours(G.C.FILTER, G.C.WHITE, 0.7);
  const rank_cols: any[] = [];
  for (let i = 12; i >= 0; i--) {
    const mod_delta = mod_rank_tallies[i] !== rank_tallies[i];
    rank_cols.push({ n: G.UIT.R, config: { align: 'cm', padding: 0.07 }, nodes: [
      { n: G.UIT.C, config: { align: 'cm', r: 0.1, padding: 0.04, emboss: 0.04, minw: 0.5, colour: G.C.L_BLACK }, nodes: [
        { n: G.UIT.T, config: { text: String(rank_name_mapping[i]), colour: G.C.JOKER_GREY, scale: 0.35, shadow: true } },
      ] },
      { n: G.UIT.C, config: { align: 'cr', minw: 0.4 }, nodes: [
        mod_delta
          ? { n: G.UIT.O, config: { object: new DynaText({ string: [{ string: '' + rank_tallies[i], colour: flip_col }, { string: '' + mod_rank_tallies[i], colour: G.C.BLUE }], colours: [G.C.RED], scale: 0.4, y_offset: -2, silent: true, shadow: true, pop_in_rate: 10, pop_delay: 4 }) } }
          : { n: G.UIT.T, config: { text: String(rank_tallies[i]), colour: flip_col, scale: 0.45, shadow: true } },
      ] },
    ] });
  }
  const pair = (a: number, b: number) => [{ string: '' + a, colour: flip_col }, { string: '' + b, colour: G.C.BLUE }];
  const back = G.GAME.selected_back;
  return { n: G.UIT.ROOT, config: { align: 'cm', colour: G.C.CLEAR }, nodes: [
    { n: G.UIT.R, config: { align: 'cm', padding: 0.05 }, nodes: [] },
    { n: G.UIT.R, config: { align: 'cm' }, nodes: [
      { n: G.UIT.C, config: { align: 'cm', minw: 1.5, minh: 2, r: 0.1, colour: G.C.BLACK, emboss: 0.05 }, nodes: [
        { n: G.UIT.C, config: { align: 'cm', padding: 0.1 }, nodes: [
          { n: G.UIT.R, config: { align: 'cm', r: 0.1, colour: G.C.L_BLACK, emboss: 0.05, padding: 0.15 }, nodes: [
            { n: G.UIT.R, config: { align: 'cm' }, nodes: [
              { n: G.UIT.O, config: { object: new DynaText({ string: back.loc_name, colours: [G.C.WHITE], bump: true, rotate: true, shadow: true, scale: 0.6 - new TextEncoder().encode(back.loc_name).length * 0.01 }) } },
            ] },
            { n: G.UIT.R, config: { align: 'cm', r: 0.1, padding: 0.1, minw: 2.5, minh: 1.3, colour: G.C.WHITE, emboss: 0.05 }, nodes: [
              { n: G.UIT.O, config: { object: new UIBox({ definition: back.generate_UI(null, 0.7, 0.5, G.GAME.challenge), config: { offset: { x: 0, y: 0 } } }) } },
            ] },
          ] },
          { n: G.UIT.R, config: { align: 'cm', r: 0.1, outline_colour: G.C.L_BLACK, line_emboss: 0.05, outline: 1.5 }, nodes: [
            { n: G.UIT.R, config: { align: 'cm', minh: 0.05, padding: 0.07 }, nodes: [
              { n: G.UIT.O, config: { object: new DynaText({ string: [{ string: localize('k_base_cards'), colour: G.C.RED }, modded ? { string: localize('k_effective'), colour: G.C.BLUE } : null].filter((x) => x), colours: [G.C.RED], silent: true, scale: 0.4, pop_in_rate: 10, pop_delay: 4 }) } },
            ] },
            { n: G.UIT.R, config: { align: 'cm', minh: 0.05, padding: 0.1 }, nodes: [
              tally_sprite({ x: 1, y: 0 }, pair(ace_tally, mod_ace_tally), [localize('k_aces')]),
              tally_sprite({ x: 2, y: 0 }, pair(face_tally, mod_face_tally), [localize('k_face_cards')]),
              tally_sprite({ x: 3, y: 0 }, pair(num_tally, mod_num_tally), [localize('k_numbered_cards')]),
            ] },
            { n: G.UIT.R, config: { align: 'cm', minh: 0.05, padding: 0.1 }, nodes: [
              tally_sprite({ x: 3, y: 1 }, pair(suit_tallies.Spades, mod_suit_tallies.Spades), [localize('Spades', 'suits_plural')]),
              tally_sprite({ x: 0, y: 1 }, pair(suit_tallies.Hearts, mod_suit_tallies.Hearts), [localize('Hearts', 'suits_plural')]),
            ] },
            { n: G.UIT.R, config: { align: 'cm', minh: 0.05, padding: 0.1 }, nodes: [
              tally_sprite({ x: 2, y: 1 }, pair(suit_tallies.Clubs, mod_suit_tallies.Clubs), [localize('Clubs', 'suits_plural')]),
              tally_sprite({ x: 1, y: 1 }, pair(suit_tallies.Diamonds, mod_suit_tallies.Diamonds), [localize('Diamonds', 'suits_plural')]),
            ] },
          ] },
        ] },
        { n: G.UIT.C, config: { align: 'cm' }, nodes: rank_cols },
        { n: G.UIT.B, config: { w: 0.1, h: 0.1 } },
      ] },
      { n: G.UIT.B, config: { w: 0.2, h: 0.1 } },
      { n: G.UIT.C, config: { align: 'cm', padding: 0.1, r: 0.1, colour: G.C.BLACK, emboss: 0.05 }, nodes: deck_tables },
    ] },
    { n: G.UIT.R, config: { align: 'cm', minh: 0.8, padding: 0.05 }, nodes: [
      modded ? { n: G.UIT.R, config: { align: 'cm' }, nodes: [
        { n: G.UIT.C, config: { padding: 0.3, r: 0.1, colour: mix_colours(G.C.BLUE, G.C.WHITE, 0.7) }, nodes: [] },
        { n: G.UIT.T, config: { text: ' ' + localize('ph_deck_preview_effective'), colour: G.C.WHITE, scale: 0.3 } },
      ] } : null,
      wheel_flipped > 0 ? { n: G.UIT.R, config: { align: 'cm' }, nodes: [
        { n: G.UIT.C, config: { padding: 0.3, r: 0.1, colour: flip_col }, nodes: [] },
        { n: G.UIT.T, config: { text: ' ' + (wheel_flipped > 1
          ? localize({ type: 'variable', key: 'deck_preview_wheel_plural', vars: [wheel_flipped] })
          : localize({ type: 'variable', key: 'deck_preview_wheel_singular', vars: [wheel_flipped] })), colour: G.C.WHITE, scale: 0.3 } },
      ] } : null,
    ] },
  ] };
}

export function deck_preview() {
  const _minh = 0.35, _minw = 0.5;
  const suit_labels: any[] = [];
  const suit_counts: Record<string, number> = { Spades: 0, Hearts: 0, Clubs: 0, Diamonds: 0 };
  const mod_suit_counts: Record<string, number> = { Spades: 0, Hearts: 0, Clubs: 0, Diamonds: 0 };
  let mod_suit_diff = false;
  let wheel_flipped = 0;
  const rank_counts: Record<number, number> = {};
  const deck_tables: any[] = [];
  const SUITS: Record<string, number[]> = { Spades: new Array(15).fill(0), Hearts: new Array(15).fill(0), Clubs: new Array(15).fill(0), Diamonds: new Array(15).fill(0) };
  const suit_map = ['Spades', 'Hearts', 'Clubs', 'Diamonds'];
  let stones: number | null = null;
  const rank_name_mapping = ['A', 'K', 'Q', 'J', '10', 9, 8, 7, 6, 5, 4, 3, 2];
  for (const v of playing_cards()) {
    if (v.ability.effect === 'Stone Card') stones = stones ?? 0;
    if (v.in_deck || v.ability.wheel_flipped) {
      if (v.ability.wheel_flipped) wheel_flipped++;
      if (v.ability.effect === 'Stone Card') {
        stones = (stones ?? 0) + 1;
      } else {
        for (const kk of suit_map) {
          if (v.base.suit === kk) suit_counts[kk]++;
          if (v.is_suit(kk)) mod_suit_counts[kk]++;
        }
        SUITS[v.base.suit][v.base.id]++;
        rank_counts[v.base.id] = (rank_counts[v.base.id] ?? 0) + 1;
      }
    }
  }
  const wheel_flipped_text = wheel_flipped > 0;
  const flip_col = wheel_flipped_text ? mix_colours(G.C.FILTER, G.C.WHITE, 0.7) : G.C.WHITE;
  suit_labels.push({ n: G.UIT.R, config: { align: 'cm', r: 0.1, padding: 0.04, minw: _minw, minh: 2 * _minh + 0.25 }, nodes: [
    stones !== null ? { n: G.UIT.T, config: { text: localize('ph_deck_preview_stones') + ': ', colour: G.C.WHITE, scale: 0.25, shadow: true } } : null,
    stones !== null ? { n: G.UIT.T, config: { text: '' + stones, colour: stones > 0 ? G.C.WHITE : G.C.UI.TRANSPARENT_LIGHT, scale: 0.4, shadow: true } } : null,
  ] });
  let _row: any[] = [];
  let _bg_col = G.C.JOKER_GREY;
  rank_name_mapping.forEach((v, k) => {
    const _tscale = 0.3;
    let rank_col = v === 'A' ? _bg_col : (v === 'K' || v === 'Q' || v === 'J') ? G.C.WHITE : _bg_col;
    rank_col = mix_colours(rank_col, _bg_col, 0.8);
    _row.push({ n: G.UIT.C, config: { align: 'cm' }, nodes: [
      { n: G.UIT.C, config: { align: 'cm', r: 0.1, minw: _minw, minh: _minh, colour: rank_col, emboss: 0.04, padding: 0.03 }, nodes: [
        { n: G.UIT.R, config: { align: 'cm' }, nodes: [{ n: G.UIT.T, config: { text: '' + v, colour: G.C.BLACK, scale: 1.6 * _tscale } }] },
        { n: G.UIT.R, config: { align: 'cm', minw: _minw + 0.04, minh: _minh, colour: G.C.L_BLACK, r: 0.1 }, nodes: [
          { n: G.UIT.T, config: { text: '' + (rank_counts[15 - (k + 1)] ?? 0), colour: flip_col, scale: _tscale, shadow: true } },
        ] },
      ] },
    ] });
  });
  deck_tables.push({ n: G.UIT.R, config: { align: 'cm', padding: 0.04 }, nodes: _row });
  for (const s of suit_map) {
    _row = [];
    _bg_col = mix_colours(G.C.SUITS[s], G.C.L_BLACK, 0.7);
    for (let i = 14; i >= 2; i--) {
      const n = SUITS[s][i];
      _row.push({ n: G.UIT.C, config: { align: 'cm', padding: 0.05, minw: _minw + 0.098, minh: _minh }, nodes: [
        { n: G.UIT.T, config: { text: '' + n, colour: n > 0 ? flip_col : G.C.UI.TRANSPARENT_LIGHT, scale: n > 0 ? 0.3 : 0.25, shadow: true, lang: G.LANGUAGES['en-us'] } },
      ] });
    }
    deck_tables.push({ n: G.UIT.R, config: { align: 'cm', r: 0.1, padding: 0.04, minh: 0.4, colour: _bg_col }, nodes: _row });
  }
  for (const v of suit_map) {
    const _x = v === 'Spades' ? 3 : v === 'Hearts' ? 0 : v === 'Clubs' ? 2 : 1;
    const t_s = new Sprite(0, 0, 0.3, 0.3, G.ASSET_ATLAS['ui_' + (G.SETTINGS.colourblind_option ? 2 : 1)], { x: _x, y: 1 });
    t_s.states.drag.can = false;
    t_s.states.hover.can = false;
    t_s.states.collide.can = false;
    if (mod_suit_counts[v] !== suit_counts[v]) mod_suit_diff = true;
    suit_labels.push({ n: G.UIT.R, config: { align: 'cm', r: 0.1, padding: 0.03, colour: G.C.JOKER_GREY }, nodes: [
      { n: G.UIT.C, config: { align: 'cm', minw: _minw, minh: _minh }, nodes: [{ n: G.UIT.O, config: { can_collide: false, object: t_s } }] },
      { n: G.UIT.C, config: { align: 'cm', minw: _minw * 2.4, minh: _minh, colour: G.C.L_BLACK, r: 0.1 }, nodes: [
        { n: G.UIT.T, config: { text: '' + suit_counts[v], colour: flip_col, scale: 0.3, shadow: true, lang: G.LANGUAGES['en-us'] } },
        mod_suit_counts[v] !== suit_counts[v] ? { n: G.UIT.T, config: { text: ' (' + mod_suit_counts[v] + ')', colour: mix_colours(G.C.BLUE, G.C.WHITE, 0.7), scale: 0.28, shadow: true, lang: G.LANGUAGES['en-us'] } } : null,
      ] },
    ] });
  }
  return { n: G.UIT.ROOT, config: { align: 'cm', colour: G.C.JOKER_GREY, r: 0.1, emboss: 0.05, padding: 0.07 }, nodes: [
    { n: G.UIT.R, config: { align: 'cm', r: 0.1, emboss: 0.05, colour: G.C.BLACK, padding: 0.1 }, nodes: [
      { n: G.UIT.R, config: { align: 'cm' }, nodes: [
        { n: G.UIT.C, config: { align: 'cm', padding: 0.04 }, nodes: suit_labels },
        { n: G.UIT.C, config: { align: 'cm', padding: 0.02 }, nodes: deck_tables },
      ] },
      mod_suit_diff ? { n: G.UIT.R, config: { align: 'cm' }, nodes: [
        { n: G.UIT.C, config: { padding: 0.3, r: 0.1, colour: mix_colours(G.C.BLUE, G.C.WHITE, 0.7) }, nodes: [] },
        { n: G.UIT.T, config: { text: ' ' + localize('ph_deck_preview_effective'), colour: G.C.WHITE, scale: 0.3 } },
      ] } : null,
      wheel_flipped_text ? { n: G.UIT.R, config: { align: 'cm' }, nodes: [
        { n: G.UIT.C, config: { padding: 0.3, r: 0.1, colour: flip_col }, nodes: [] },
        { n: G.UIT.T, config: { text: ' ' + (wheel_flipped > 1
          ? localize({ type: 'variable', key: 'deck_preview_wheel_plural', vars: [wheel_flipped] })
          : localize({ type: 'variable', key: 'deck_preview_wheel_singular', vars: [wheel_flipped] })), colour: G.C.WHITE, scale: 0.3 } },
      ] } : null,
    ] },
  ] };
}

export function create_UIBox_hand_tip(handname: string) {
  const h = G.GAME.hands[handname];
  if (!h.example) return { n: G.UIT.R, config: { align: 'cm' }, nodes: [] };
  const cardarea = new CardArea(2, 2, 3.5 * G.CARD_W, 0.75 * G.CARD_H, { card_limit: 5, type: 'title', highlight_limit: 0 });
  h.example.forEach((v: [string, boolean], k: number) => {
    const card = new Card(0, 0, 0.5 * G.CARD_W, 0.5 * G.CARD_H, G.P_CARDS[v[0]], G.P_CENTERS.c_base);
    if (v[1]) card.juice_up(0.3, 0.2);
    if (k === 0) play_sound('paper1', 0.95 + Math.random() * 0.1, 0.3);
    ease_value(card.T, 'scale', v[1] ? 0.25 : -0.15, null, 'REAL', true, 0.2);
    cardarea.emplace(card);
  });
  return { n: G.UIT.R, config: { align: 'cm', colour: G.C.WHITE, r: 0.1 }, nodes: [
    { n: G.UIT.C, config: { align: 'cm' }, nodes: [{ n: G.UIT.O, config: { object: cardarea } }] },
  ] };
}

export function create_UIBox_current_hand_row(handname: string, simple?: boolean) {
  const h = G.GAME.hands[handname];
  if (!h.visible) return null;
  const tip = { text: localize(handname, 'poker_hand_descriptions'), filler: { func: create_UIBox_hand_tip, args: handname } };
  if (simple) {
    return { n: G.UIT.R, config: { align: 'cm', padding: 0.05, r: 0.1, colour: darken(G.C.JOKER_GREY, 0.1), force_focus: true, emboss: 0.05, hover: true, on_demand_tooltip: tip, focus_args: { snap_to: handname === 'Straight Flush' } }, nodes: [
      { n: G.UIT.C, config: { align: 'cm', padding: 0, minw: 5 }, nodes: [
        { n: G.UIT.T, config: { text: localize(handname, 'poker_hands'), scale: 0.5, colour: G.C.UI.TEXT_LIGHT, shadow: true } },
      ] },
    ] };
  }
  return { n: G.UIT.R, config: { align: 'cm', padding: 0.05, r: 0.1, colour: darken(G.C.JOKER_GREY, 0.1), emboss: 0.05, hover: true, force_focus: true, on_demand_tooltip: tip }, nodes: [
    { n: G.UIT.C, config: { align: 'cl', padding: 0, minw: 5 }, nodes: [
      { n: G.UIT.C, config: { align: 'cm', padding: 0.01, r: 0.1, colour: G.C.HAND_LEVELS[Math.min(7, h.level)], minw: 1.5, outline: 0.8, outline_colour: G.C.WHITE }, nodes: [
        { n: G.UIT.T, config: { text: localize('k_level_prefix') + h.level, scale: 0.5, colour: G.C.UI.TEXT_DARK } },
      ] },
      { n: G.UIT.C, config: { align: 'cm', minw: 4.5, maxw: 4.5 }, nodes: [
        { n: G.UIT.T, config: { text: ' ' + localize(handname, 'poker_hands'), scale: 0.45, colour: G.C.UI.TEXT_LIGHT, shadow: true } },
      ] },
    ] },
    { n: G.UIT.C, config: { align: 'cm', padding: 0.05, colour: G.C.BLACK, r: 0.1 }, nodes: [
      { n: G.UIT.C, config: { align: 'cr', padding: 0.01, r: 0.1, colour: G.C.CHIPS, minw: 1.1 }, nodes: [
        { n: G.UIT.T, config: { text: h.chips, scale: 0.45, colour: G.C.UI.TEXT_LIGHT } },
        { n: G.UIT.B, config: { w: 0.08, h: 0.01 } },
      ] },
      { n: G.UIT.T, config: { text: 'X', scale: 0.45, colour: G.C.MULT } },
      { n: G.UIT.C, config: { align: 'cl', padding: 0.01, r: 0.1, colour: G.C.MULT, minw: 1.1 }, nodes: [
        { n: G.UIT.B, config: { w: 0.08, h: 0.01 } },
        { n: G.UIT.T, config: { text: h.mult, scale: 0.45, colour: G.C.UI.TEXT_LIGHT } },
      ] },
    ] },
    { n: G.UIT.C, config: { align: 'cm' }, nodes: [{ n: G.UIT.T, config: { text: '  #', scale: 0.45, colour: G.C.UI.TEXT_LIGHT, shadow: true } }] },
    { n: G.UIT.C, config: { align: 'cm', padding: 0.05, colour: G.C.L_BLACK, r: 0.1, minw: 0.9 }, nodes: [
      { n: G.UIT.T, config: { text: h.played, scale: 0.45, colour: G.C.FILTER, shadow: true } },
    ] },
  ] };
}

export function create_UIBox_current_hands(simple?: boolean) {
  const names = ['Flush Five', 'Flush House', 'Five of a Kind', 'Straight Flush', 'Four of a Kind', 'Full House', 'Flush', 'Straight',
    'Three of a Kind', 'Two Pair', 'Pair', 'High Card'];
  return { n: G.UIT.ROOT, config: { align: 'cm', minw: 3, padding: 0.1, r: 0.1, colour: G.C.CLEAR }, nodes: [
    { n: G.UIT.R, config: { align: 'cm', padding: 0.04 }, nodes: names.map((h) => create_UIBox_current_hand_row(h, simple)).filter((x) => x) },
  ] };
}

function current_blinds() {
  const st = G.GAME.round_resets.blind_states;
  const col = (type: string) => ({ n: G.UIT.C, config: { align: 'tm', padding: 0.1, outline: 2, r: 0.1, line_emboss: 0.2, outline_colour: G.C.BLACK }, nodes: [
    G.UIDEF.blind_choice(type, true),
  ] });
  return { n: G.UIT.ROOT, config: { align: 'cm', colour: G.C.CLEAR, padding: 0.2 }, nodes: [
    st.Small !== 'Hide' ? col('Small') : null,
    st.Big !== 'Hide' ? col('Big') : null,
    st.Boss !== 'Hide' ? col('Boss') : null,
  ] };
}

function current_stake() {
  const stake = G.GAME.stake;
  let other_col: any = null;
  const desc_rows = (center: any) => {
    const nodes: any[] = [];
    localize({ type: 'descriptions', key: center.key, set: center.set, nodes });
    const full = nodes.map((v) => ({ n: G.UIT.R, config: { align: 'cm' }, nodes: v }));
    full.pop();
    return full;
  };
  if (stake > 2) {
    const rows: any[] = [{ n: G.UIT.R, config: { align: 'cm', padding: 0.05 }, nodes: [
      { n: G.UIT.T, config: { text: localize('k_also_applied'), scale: 0.4, colour: G.C.WHITE } },
    ] }];
    for (let i = stake - 1; i >= 2; i--) {
      rows.push({ n: G.UIT.R, config: { align: 'cm' }, nodes: [
        { n: G.UIT.C, config: { align: 'cm' }, nodes: [{ n: G.UIT.C, config: { align: 'cm', colour: get_stake_col(i), r: 0.1, minh: 0.35, minw: 0.35, emboss: 0.05 }, nodes: [] }, { n: G.UIT.B, config: { w: 0.1, h: 0.1 } }] },
        { n: G.UIT.C, config: { align: 'cm', padding: 0.03, colour: G.C.WHITE, r: 0.1, minh: 0.7, minw: 4.8 }, nodes: desc_rows(G.P_CENTER_POOLS.Stake[i - 1]) },
      ] });
    }
    other_col = { n: G.UIT.R, config: { align: 'cm', padding: 0.05, r: 0.1, colour: G.C.L_BLACK }, nodes: rows };
  }
  const center = G.P_CENTER_POOLS.Stake[stake - 1];
  const current_col = { n: G.UIT.R, config: { align: 'cm' }, nodes: [
    { n: G.UIT.R, config: { align: 'cm', padding: 0.1, minw: 4 }, nodes: [
      { n: G.UIT.O, config: { colour: G.C.BLUE, object: get_stake_sprite(stake, 0.8), hover: true, can_collide: false } },
      { n: G.UIT.T, config: { text: localize({ type: 'name_text', key: center.key, set: 'Stake' }), scale: 0.45, colour: G.C.WHITE } },
    ] },
    { n: G.UIT.R, config: { align: 'cm', padding: 0.05, colour: get_stake_col(stake), r: 0.05 }, nodes: [
      { n: G.UIT.R, config: { align: 'cm', padding: 0.05, colour: G.C.WHITE, r: 0.05 }, nodes: [
        { n: G.UIT.R, config: { align: 'cm', padding: 0.03, minh: 0.7, minw: 3.8 }, nodes: desc_rows(center) },
      ] },
    ] },
  ] };
  return { n: G.UIT.ROOT, config: { align: 'cm', colour: G.C.BLACK, r: 0.1, padding: 0.1 }, nodes: [current_col, other_col] };
}

function used_vouchers() {
  let silent = false;
  const keys_used: any[][] = [];
  G.P_CENTER_POOLS.Voucher.forEach((v: any, k: number) => {
    const key = Math.floor((k + 1 - 0.1) / 2);
    keys_used[key] = keys_used[key] ?? [];
    if (G.GAME.used_vouchers[v.key]) keys_used[key].push(v);
  });
  let area_count = 0;
  for (const v of keys_used) if (v && v.length) area_count++;
  const voucher_areas: any[] = [];
  let voucher_tables: any[] = [];
  const voucher_table_rows: any[] = [];
  for (const v of keys_used) {
    if (!v || !v.length) continue;
    if (voucher_areas.length === 5 || voucher_areas.length === 10) {
      voucher_table_rows.push({ n: G.UIT.R, config: { align: 'cm', padding: 0, no_fill: true }, nodes: voucher_tables });
      voucher_tables = [];
    }
    const area = new CardArea(G.ROOM.T.x + 0.2 * G.ROOM.T.w / 2, G.ROOM.T.h, (v.length === 1 ? 1 : 1.33) * G.CARD_W, (area_count >= 10 ? 0.75 : 1.07) * G.CARD_H,
      { card_limit: 2, type: 'voucher', highlight_limit: 0 });
    voucher_areas.push(area);
    for (const vv of v) {
      const card: any = new Card(area.T.x + area.T.w / 2, area.T.y, G.CARD_W, G.CARD_H, null, G.P_CENTERS[vv.key], { bypass_discovery_center: true, bypass_discovery_ui: true, bypass_lock: true });
      card.ability.order = vv.order;
      card.start_materialize(undefined, silent);
      silent = true;
      area.emplace(card);
    }
    voucher_tables.push({ n: G.UIT.C, config: { align: 'cm', padding: 0, no_fill: true }, nodes: [{ n: G.UIT.O, config: { object: area } }] });
  }
  voucher_table_rows.push({ n: G.UIT.R, config: { align: 'cm', padding: 0, no_fill: true }, nodes: voucher_tables });
  return silent
    ? { n: G.UIT.ROOT, config: { align: 'cm', colour: G.C.CLEAR }, nodes: [
      { n: G.UIT.R, config: { align: 'cm' }, nodes: [{ n: G.UIT.O, config: { object: new DynaText({ string: [localize('ph_vouchers_redeemed')], colours: [G.C.UI.TEXT_LIGHT], bump: true, scale: 0.6 }) } }] },
      { n: G.UIT.R, config: { align: 'cm', minh: 0.5 }, nodes: [] },
      { n: G.UIT.R, config: { align: 'cm', colour: G.C.BLACK, r: 1, padding: 0.15, emboss: 0.05 }, nodes: [{ n: G.UIT.R, config: { align: 'cm' }, nodes: voucher_table_rows }] },
    ] }
    : { n: G.UIT.ROOT, config: { align: 'cm', colour: G.C.CLEAR }, nodes: [
      { n: G.UIT.O, config: { object: new DynaText({ string: [localize('ph_no_vouchers')], colours: [G.C.UI.TEXT_LIGHT], bump: true, scale: 0.6 }) } },
    ] };
}

export function run_info() {
  const tabs = [
    { label: localize('b_poker_hands'), chosen: true, tab_definition_function: create_UIBox_current_hands },
    { label: localize('b_blinds'), tab_definition_function: current_blinds },
    { label: localize('b_vouchers'), tab_definition_function: used_vouchers },
    G.GAME.stake > 1 ? { label: localize('b_stake'), tab_definition_function: current_stake } : null,
  ].filter((x) => x);
  return create_UIBox_generic_options({ contents: [create_tabs({ tabs, tab_h: 8, snap_to_nav: true })] });
}

export function deck_info(_show_remaining?: boolean) {
  const tabs = _show_remaining
    ? [
      { label: localize('b_remaining'), chosen: true, tab_definition_function: view_deck, tab_definition_function_args: true },
      { label: localize('b_full_deck'), tab_definition_function: view_deck },
    ]
    : [{ label: localize('b_full_deck'), chosen: true, tab_definition_function: view_deck }];
  return create_UIBox_generic_options({ contents: [create_tabs({ tabs, tab_h: 8, snap_to_nav: true })] });
}

export function register_run_info_funcs() {
  G.UIDEF.run_info = run_info;
  G.UIDEF.deck_info = deck_info;
  G.UIDEF.view_deck = view_deck;
  G.UIDEF.deck_preview = deck_preview;
  G.UIDEF.current_blinds = current_blinds;
  G.UIDEF.current_stake = current_stake;
  G.UIDEF.used_vouchers = used_vouchers;
  G.FUNCS.run_info = () => {
    G.SETTINGS.paused = true;
    G.FUNCS.overlay_menu({ definition: run_info() });
  };
  G.FUNCS.current_hands = (_e: any, simple?: boolean) => {
    G.SETTINGS.paused = true;
    G.FUNCS.overlay_menu({ definition: create_UIBox_current_hands(simple) });
  };
  G.FUNCS.deck_info = () => {
    G.SETTINGS.paused = true;
    if (G.deck_preview) { G.deck_preview.remove(); G.deck_preview = null; }
    const S = G.STATES;
    G.FUNCS.overlay_menu({ definition: deck_info(G.STATE === S.SELECTING_HAND || G.STATE === S.HAND_PLAYED || G.STATE === S.DRAW_TO_HAND) });
  };
}
