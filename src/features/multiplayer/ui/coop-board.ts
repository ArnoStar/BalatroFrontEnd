// Coop in the run, drawn with the game's own UI: the board right of the blind
// select (whose turn it is, both players' jokers and numbers, the shop's
// leaving, emotes), the joker row split in the players' halves side by side
// (each with its owner's name and slots: all count, but only their owner sells
// and moves them), both players' decks in the deck view (mode_rules 1: a deck
// each), and the match's end on the game over screen (each player's numbers, a
// rematch).
import { G, UIBox, Event, play_sound, number_format } from '@/shared/lib/engine';
import { UIBox_button, attention_text, create_UIBox_generic_options } from '@/shared/ui';
import { localize } from '@/shared/lib/localization';
import { matches, type CoopDeckView, type CoopDecksView, type CoopSeatView, type MatchView, type Score } from '@/shared/api';
import { run, deck_card, timeline_playing } from '@/entities/run';
import type { CardGroups } from '@/entities/card';
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
let last_phase: string | null = null;
let shown_turn: number | null = null;

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
  // (the turn passes on screen with the play's `turn` event, once its hand is scored)
  if (shown_turn === null || !timeline_playing()) shown_turn = v.turn;
  ui.turn = shown_turn === seat ? tr('your_turn') : tr('their_turn', { name });
  ui.you = m.players[m.seat]?.name ?? tr('you');
  ui.them = name;
  // (one deck for both: the deck pile has its count)
  const deck = (s: number) => (v.shared_deck ? '' : `  ${tr('deck')} ${v.seats[s]?.deck ?? 0}`);
  ui.you_info = `${tr('jokers')} ${mine_jokers}/${v.joker_slots[seat] ?? 5}${deck(seat)}`;
  ui.them_info = `${tr('jokers')} ${theirs_jokers}/${v.joker_slots[1 - seat] ?? 5}${deck(1 - seat)}`;
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
  // a round starts: whose turn it is (later turns are the play's own `turn` event: announce_turn)
  const phase = run.view?.phase ?? null;
  if (board && phase === 'playing' && last_phase !== null && last_phase !== 'playing' && last_phase !== 'pack') announce_turn(v.turn);
  last_phase = phase;
}

/**
 * The turn passes: the game's big announcement (the letters pop in over a
 * burst of the player's colour, as a planet's level up). On this player's
 * turn the room shakes a little and the hand ripples, card by card.
 */
function announce_turn(seat: number) {
  const m = mp.match;
  if (!m || !board) return;
  const mine = seat === m.seat;
  const name = partner(m);
  shown_turn = seat;
  if (mine) {
    attention_text({ text: tr('your_turn_big'), scale: 1.3, hold: 1.5, major: G.play, align: 'cm', offset: { x: 0, y: -1.3 },
      backdrop_colour: G.C.BLUE, backdrop_scale: 1.4, noisy: true, rotate: 1 });
    play_sound('timpani', 1.1, 0.7);
    play_sound('whoosh2', 1.3, 0.4);
    G.ROOM.jiggle = (G.ROOM.jiggle ?? 0) + 2;
    (G.hand?.cards ?? []).forEach((c: any, i: number) => {
      G.E_MANAGER.add_event(new Event({ trigger: 'after', delay: 0.05 * (i + 1), blockable: false, blocking: false, func: () => {
        c.juice_up(0.25, 0.2);
        if (i % 2 === 0) play_sound('paper1', 0.9 + 0.05 * i, 0.3);
        return true;
      } }));
    });
  } else {
    attention_text({ text: tr('their_turn', { name }), scale: 0.8, hold: 1.2, major: G.play, align: 'cm', offset: { x: 0, y: -1.3 },
      backdrop_colour: G.C.GREEN, backdrop_scale: 1 });
    play_sound('whoosh', 0.9, 0.4);
  }
}

/** the button the other player waits on: it wiggles now and then */
let waiting_since = 0;
function nudge_waiting() {
  const m = mp.match;
  const v = run.view?.coop;
  const seat = my_seat();
  if (!board || !m || m.status !== 'playing' || !v || seat === null || run.busy || G.screenwipe || G.OVERLAY_MENU) {
    waiting_since = 0;
    return;
  }
  let id: string | null = null;
  const phase = run.view?.phase;
  if (phase === 'shop' && v.shop_votes.includes(1 - seat) && !v.shop_votes.includes(seat)) id = 'next_round_button';
  else if (phase === 'blind_select' && my_turn()) id = 'select_blind';
  else if (phase === 'playing' && my_turn() && G.STATE === G.STATES.SELECTING_HAND) id = 'play_button';
  if (!id) { waiting_since = 0; return; }
  const now = G.TIMERS.REAL;
  if (!waiting_since) waiting_since = now;
  if (now - waiting_since < 3) return; // (a moment to think first)
  const node = find_ui((n) => (id === 'select_blind' ? n.config?.button === 'select_blind' : n.config?.id === id));
  node?.juice_up(0.12, 0.04);
}

/** the first visible UI element that `test` takes */
function find_ui(test: (n: any) => boolean): any {
  const find = (n: any): any => {
    if (!n || n.states?.visible === false) return null;
    if (test(n)) return n;
    for (const c of Object.values(n.children ?? {})) {
      const r = find(c);
      if (r) return r;
    }
    return null;
  };
  for (const box of [G.blind_select, G.shop, G.buttons, ...(G.I?.UIBOX ?? [])]) {
    const n = box?.UIRoot && find(box.UIRoot);
    if (n) return n;
  }
  return null;
}

/** the joker row in the players' halves: seat 0's on the left (the jokers count from left to right) */
const halves: CardGroups = {
  of: (card: any) => run.view?.jokers.find((j) => j.id === card.api_id)?.owner,
  info: () => {
    const m = mp.match;
    const v = run.view?.coop;
    return [0, 1].map((seat) => ({
      label: m?.players[seat]?.name ?? '',
      colour: seat === m?.seat ? G.C.BLUE : G.C.GREEN,
      limit: v?.joker_slots[seat] ?? 5,
    }));
  },
};

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
  last_phase = null;
  shown_turn = null;
}

function render(m: MatchView | null = mp.match) {
  if (!in_coop_run(m) || !run.view?.coop || !G.consumeables || !G.jokers) {
    if (board) remove_all();
    if (G.jokers?.config?.groups === halves) G.jokers.set_groups(null);
    return;
  }
  update(m);
  G.jokers.set_groups(halves);
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
  setInterval(nudge_waiting, 1400);
  // (the timeline's `turn` event: the turn passes after a hand)
  G.FUNCS.coop_turn = (seat: number) => { if (in_coop_run()) announce_turn(seat); };
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
  // the deck view: one deck for both, or (mode_rules 1) the player's own deck, whoever's turn it is, and a tab
  // with the other player's
  const deck_info = G.FUNCS.deck_info;
  G.FUNCS.deck_info = (...args: any[]) => {
    if (my_seat() === null || !run.id || run.view?.coop?.shared_deck) {
      decks = null;
      return deck_info(...args);
    }
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
