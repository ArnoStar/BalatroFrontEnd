// Coop in the run, drawn with the game's own UI: the board right of the blind
// select (whose turn it is, both players' jokers, decks and numbers, the shop's
// leaving, emotes), a name tag on the other player's jokers (they count for
// both, but only their owner sells and moves them), both players' decks in the
// deck view, and the match's end on the game over screen (each player's
// numbers, a rematch).
import { G, UIBox, play_sound, number_format } from '@/shared/lib/engine';
import { UIBox_button, attention_text, create_UIBox_generic_options } from '@/shared/ui';
import { localize } from '@/shared/lib/localization';
import { matches, type CoopDeckView, type CoopDecksView, type CoopSeatView, type MatchView, type Score } from '@/shared/api';
import { run, deck_card } from '@/entities/run';
import { mp, on_match, refresh } from '../model/match';
import { in_coop_run, my_seat, my_turn } from '../model/coop';
import { emote_button, close_emotes } from './emotes';
import { rematch_parts } from './board';
import { tr } from './text';

const W = 2.8;
const ui = { turn: '', you: '', you_info: '', you_nums: '', them: '', them_info: '', them_nums: '', status_1: '', status_2: '' };

const fmt = (x: Score | null | undefined) => (typeof x === 'number' ? number_format(x) : String(x ?? 0));

function numbers(s: CoopSeatView | undefined): string {
  return tr('coop_numbers', { hands: s?.hands ?? 0, chips: fmt(s?.chips) });
}

let board: any = null;
let last_turn: number | null = null;
const tags = new Map<any, any>();

function partner(m: MatchView): string {
  return m.players.find((p) => !p.you)?.name ?? tr('partner');
}

function wrap(text: string, n: number): string[] {
  const out: string[] = [];
  let line = '';
  for (const word of text.split(' ')) {
    if (line && (line + ' ' + word).length > n) { out.push(line); line = word; } else line = line ? line + ' ' + word : word;
  }
  if (line) out.push(line);
  return out;
}

function text_row(key: keyof typeof ui, scale: number, colour: any) {
  return { n: G.UIT.R, config: { align: 'cm', minh: scale * 0.85, maxw: W - 0.2 }, nodes: [
    { n: G.UIT.T, config: { ref_table: ui, ref_value: key, scale, colour, shadow: true } },
  ] };
}

function definition() {
  return { n: G.UIT.ROOT, config: { align: 'cm', colour: G.C.CLEAR }, nodes: [
    { n: G.UIT.R, config: { align: 'cm', r: 0.1, padding: 0.08, colour: G.C.DYN_UI.MAIN, emboss: 0.05, minw: W }, nodes: [
      { n: G.UIT.R, config: { align: 'cm', minw: W - 0.15 }, nodes: [
        { n: G.UIT.T, config: { text: tr('coop'), scale: 0.4, colour: G.C.UI.TEXT_LIGHT, shadow: true } },
      ] },
      { n: G.UIT.R, config: { align: 'cm', r: 0.1, padding: 0.06, colour: G.C.BLACK, emboss: 0.05, minw: W - 0.15 }, nodes: [
        text_row('turn', 0.36, G.C.GOLD),
      ] },
      { n: G.UIT.R, config: { align: 'cm', r: 0.1, padding: 0.06, colour: G.C.DYN_UI.DARK, minw: W - 0.15 }, nodes: [
        { n: G.UIT.C, config: { align: 'cm' }, nodes: [
          text_row('you', 0.3, G.C.BLUE),
          text_row('you_info', 0.25, G.C.UI.TEXT_LIGHT),
          text_row('you_nums', 0.22, G.C.UI.TEXT_INACTIVE),
          text_row('them', 0.3, G.C.GREEN),
          text_row('them_info', 0.25, G.C.UI.TEXT_LIGHT),
          text_row('them_nums', 0.22, G.C.UI.TEXT_INACTIVE),
        ] },
      ] },
      { n: G.UIT.R, config: { align: 'cm', padding: 0.04, minw: W - 0.15, minh: 0.45 }, nodes: [
        { n: G.UIT.C, config: { align: 'cm' }, nodes: [
          text_row('status_1', 0.25, G.C.UI.TEXT_LIGHT),
          text_row('status_2', 0.25, G.C.UI.TEXT_LIGHT),
        ] },
      ] },
      { n: G.UIT.R, config: { align: 'cm', padding: 0.02 }, nodes: [
        emote_button(1.2),
        { n: G.UIT.C, config: { minw: 0.08 }, nodes: [] },
        UIBox_button({ button: 'coop_leave_ask', label: [tr('leave')], minw: 1.2, minh: 0.36, scale: 0.26, colour: G.C.UI.BACKGROUND_INACTIVE, col: true }),
      ] },
    ] },
  ] };
}

function update(m: MatchView) {
  const v = run.view?.coop;
  if (!v) return;
  const seat = m.seat; // (the view of a replayed step is the other player's)
  const name = partner(m);
  const mine_jokers = (run.view?.jokers ?? []).filter((j) => j.owner === seat).length;
  const theirs_jokers = (run.view?.jokers ?? []).filter((j) => j.owner === 1 - seat).length;
  ui.turn = my_turn() ? tr('your_turn') : tr('their_turn', { name });
  ui.you = m.players[m.seat]?.name ?? tr('you');
  ui.them = name;
  const deck = (s: number) => v.seats[s]?.deck ?? 0;
  ui.you_info = `${tr('jokers')} ${mine_jokers}/${v.joker_slots[seat] ?? 5}  ${tr('deck')} ${deck(seat)}`;
  ui.them_info = `${tr('jokers')} ${theirs_jokers}/${v.joker_slots[1 - seat] ?? 5}  ${tr('deck')} ${deck(1 - seat)}`;
  ui.you_nums = numbers(v.seats[seat]);
  ui.them_nums = numbers(v.seats[1 - seat]);
  let status = '';
  if (run.view?.phase === 'shop') {
    if (v.shop_votes.includes(seat) && !v.shop_votes.includes(1 - seat)) status = tr('wait_shop', { name });
    else if (v.shop_votes.includes(1 - seat)) status = tr('they_left_shop', { name });
  } else if (v.pack_seat !== null && v.pack_seat !== seat && run.view?.phase === 'pack') {
    status = tr('their_pack', { name });
  } else if (!my_turn() && run.view?.phase === 'playing') {
    status = tr('watching', { name });
  }
  [ui.status_1 = '', ui.status_2 = ''] = wrap(status, 22);
  if (last_turn !== null && last_turn !== v.turn && board && run.view?.phase === 'playing') {
    attention_text({ text: ui.turn, scale: 0.9, hold: 1.4, major: G.play, align: 'cm', offset: { x: 0, y: -1.5 }, colour: G.C.WHITE });
    play_sound('timpani', 1, 0.5);
  }
  last_turn = v.turn;
}

/** a name tag under each of the other player's jokers */
function update_tags(m: MatchView) {
  const seat = m.seat;
  const name = partner(m);
  const theirs = new Set<any>();
  for (const c of G.jokers?.cards ?? []) {
    const owner = run.view?.jokers.find((j) => j.id === c.api_id)?.owner;
    if (owner === undefined || owner === null || owner === seat) continue;
    theirs.add(c);
    if (!tags.has(c)) {
      tags.set(c, new UIBox({
        definition: { n: G.UIT.ROOT, config: { align: 'cm', colour: G.C.CLEAR }, nodes: [
          { n: G.UIT.R, config: { align: 'cm', r: 0.08, padding: 0.04, colour: G.C.GREEN }, nodes: [
            { n: G.UIT.T, config: { text: name, scale: 0.24, colour: G.C.UI.TEXT_LIGHT, shadow: true } },
          ] },
        ] },
        config: { major: c, align: 'bmi', offset: { x: 0, y: 0.05 }, bond: 'Strong' },
      }));
    }
  }
  for (const [c, tag] of [...tags]) {
    if (!theirs.has(c) || c.REMOVED) {
      tag.remove();
      tags.delete(c);
    }
  }
}

let ended = '';

/** the other player left: the run can't go on in turns */
function show_end(m: MatchView) {
  if (ended === m.id || m.status !== 'finished' || m.result?.reason !== 'left') return;
  ended = m.id;
  G.SETTINGS.paused = true;
  G.FUNCS.overlay_menu({ definition: create_UIBox_generic_options({ no_back: true, contents: [
    { n: G.UIT.R, config: { align: 'cm', padding: 0.15 }, nodes: [
      { n: G.UIT.T, config: { text: tr('partner_left', { name: partner(m) }), scale: 0.6, colour: G.C.UI.TEXT_LIGHT, shadow: true } },
    ] },
    { n: G.UIT.R, config: { align: 'cm', padding: 0.1 }, nodes: [
      UIBox_button({ button: 'pvp_to_menu', label: [tr('main_menu')], minw: 3, colour: G.C.ORANGE }),
    ] },
  ] }) });
}

function remove_all() {
  board?.remove();
  board = null;
  for (const tag of tags.values()) tag.remove();
  tags.clear();
  last_turn = null;
}

function render(m: MatchView | null = mp.match) {
  if (!in_coop_run(m) || !run.view?.coop || !G.consumeables || !G.jokers) {
    if (board || tags.size) remove_all();
    return;
  }
  update(m);
  update_tags(m);
  show_end(m);
  if (!board || board.REMOVED) {
    board = new UIBox({ definition: definition(), config: { major: G.ROOM_ATTACH, align: 'cri', offset: { x: -0.05, y: -0.7 }, bond: 'Weak' } });
  }
}

// ------------------------------------------------------------------ leaving
function leave_definition() {
  return create_UIBox_generic_options({ back_func: 'exit_overlay_menu', contents: [
    { n: G.UIT.R, config: { align: 'cm', padding: 0.1 }, nodes: [{ n: G.UIT.T, config: { text: tr('coop_leave_ask'), scale: 0.45, colour: G.C.UI.TEXT_LIGHT, shadow: true } }] },
    { n: G.UIT.R, config: { align: 'cm', padding: 0.1 }, nodes: [
      UIBox_button({ button: 'exit_overlay_menu', label: [tr('stay')], minw: 3, colour: G.C.GREY, col: true }),
      { n: G.UIT.C, config: { minw: 0.3 }, nodes: [] },
      UIBox_button({ button: 'coop_leave', label: [tr('leave')], minw: 3, colour: G.C.RED, col: true }),
    ] },
  ] });
}

// ------------------------------------------------------------------ the decks
let decks: CoopDecksView | null = null;

/** a player's deck for the deck view: their cards, those still to draw marked */
function seat_cards(d: CoopDeckView) {
  const sig = (c: { card_key: string; key: string; edition: string | null; seal: string | null }) => `${c.card_key}|${c.key}|${c.edition}|${c.seal}`;
  const left = new Map<string, number>();
  for (const c of d.remaining) left.set(sig(c), (left.get(sig(c)) ?? 0) + 1);
  return d.full_deck.map((c) => {
    const n = left.get(sig(c)) ?? 0;
    if (n) left.set(sig(c), n - 1);
    return deck_card(c.card_key, c.key, c.edition, c.seal, n > 0);
  });
}

// ------------------------------------------------------------------ the end
/** the game over screen of a coop run: each player's numbers, and a rematch */
function game_over_rows(): any[] {
  const m = mp.match;
  const v = run.view?.coop;
  if (!m || m.mode !== 'coop' || !v || run.id !== m.run_id) return [];
  const line = (seat: number) => {
    const s = v.seats[seat];
    const best = s?.best_hand_name ? `, ${tr('best_of', { hand: localize(s.best_hand_name, 'poker_hands') })} ${fmt(s.best_hand)}` : '';
    return { n: G.UIT.R, config: { align: 'cm', padding: 0.02 }, nodes: [
      { n: G.UIT.T, config: { text: `${m.players[seat]?.name ?? '?'}: ${numbers(s)}${best}`, scale: 0.32, colour: seat === m.seat ? G.C.BLUE : G.C.GREEN, shadow: true } },
    ] };
  };
  const rematch = rematch_parts(m);
  return [{ n: G.UIT.R, config: { align: 'cm', padding: 0.05, colour: G.C.BLACK, r: 0.1, emboss: 0.05 }, nodes: [{ n: G.UIT.C, config: { align: 'cm', padding: 0.06 }, nodes: [
    { n: G.UIT.R, config: { align: 'cm' }, nodes: [{ n: G.UIT.T, config: { text: tr('coop_together', { ante: run.view?.ante ?? 0, round: run.view?.round ?? 0 }), scale: 0.36, colour: G.C.FILTER, shadow: true } }] },
    line(0), line(1),
    { n: G.UIT.R, config: { align: 'cm', padding: 0.05 }, nodes: [rematch.button, { n: G.UIT.C, config: { minw: 0.2 }, nodes: [] }, emote_button(2, 0.5, 0.75)] },
  ] }] }];
}

export function start_coop_board() {
  on_match((m) => render(m));
  setInterval(() => render(), 400);
  G.FUNCS.coop_leave_ask = () => {
    G.SETTINGS.paused = true;
    G.FUNCS.overlay_menu({ definition: leave_definition() });
  };
  G.FUNCS.coop_leave = () => {
    close_emotes();
    if (G.OVERLAY_MENU) G.FUNCS.exit_overlay_menu();
    const m = mp.match;
    if (!m || m.status !== 'playing') return;
    void matches.leave(m.id).then(() => refresh(), () => refresh()).then(() => G.FUNCS.go_to_menu());
  };
  // the deck view: the player's own deck (whoever's turn it is), and a tab with the other player's
  const deck_info = G.FUNCS.deck_info;
  G.FUNCS.deck_info = (...args: any[]) => {
    if (my_seat() === null || !run.id) return deck_info(...args);
    void matches.coop_decks(run.id).then((d) => { decks = d; }, () => { decks = null; }).then(() => deck_info(...args));
  };
  G.UIDEF.deck_cards = () => {
    const seat = my_seat();
    const d = seat === null ? null : decks?.seats[seat];
    return d ? seat_cards(d) : null;
  };
  const pvp_tabs = G.UIDEF.extra_deck_tabs;
  G.UIDEF.extra_deck_tabs = () => {
    const seat = my_seat();
    const m = mp.match;
    const theirs = seat === null ? null : decks?.seats[1 - seat];
    if (!theirs || !m) return pvp_tabs?.() ?? [];
    return [{ label: tr('their_deck', { name: partner(m) }), tab_definition_function: () => G.UIDEF.view_deck(false, seat_cards(theirs)) }];
  };
  G.UIDEF.game_over_extra = game_over_rows;
}
