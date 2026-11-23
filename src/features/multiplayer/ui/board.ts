// PvP in the run, drawn with the game's own UI (UIBox, the HUD's colours):
// - the board under the consumables: both players' hit points, what the match
//   waits for and the timer, where the other player is (their blind, score,
//   hands, money);
// - a button under the joker row that shows the other player's jokers in its
//   place (and back to the player's);
// - the full deck screen's tab with the other player's deck;
// - each blind's cost as the game's big text over the board, and the match's
//   end as an overlay menu: how it went, a rematch, the other player's run;
// - the last seconds of the timer tick when the other player waits for you.
// On the title screen, a match being played shows a button back to it, and a
// match just over the other player's rematch.
import { G, UIBox, DynaText, Event, play_sound } from '@/shared/lib/engine';
import { localize } from '@/shared/lib/localization';
import { UIBox_button, attention_text, create_UIBox_generic_options } from '@/shared/ui';
import { matches, type MatchView, type OpponentView, type PvPBlindResult } from '@/shared/api';
import { run, create_card, deck_card } from '@/entities/run';
import { CardArea } from '@/entities/card';
import { mp, on_match, refresh, seconds_left } from '../model/match';
import { in_match_run, pvp } from '../model/pvp';
import { emote_button, close_emotes } from './emotes';
import { tr } from './text';

/** what the board's texts show (its nodes read them every frame) */
const ui = {
  you: '', you_hp: '', them: '', them_hp: '', timer: '', status_1: '', status_2: '', status_3: '', opp_1: '', opp_2: '', opp_3: '', opp_4: '',
};

let board: any = null;
let toggle: any = null;
let opp_area: any = null;
let showing_theirs = false;
let opp_sig = '';
let seen_rounds: Record<string, number> = {};
let ended_shown = '';
let end_key = '';
let menu_box: any = null;
let menu_key = '';
let last_tick = -1;

function fmt(x: number | string): string {
  if (typeof x === 'string') return x;
  return Math.abs(x) >= 1e11 ? x.toExponential(3) : Math.floor(x).toLocaleString('en-US');
}

function opponent_name(m: MatchView): string {
  return m.players.find((p) => !p.you)?.name ?? tr('opponent');
}

function blind_name(key: string | null | undefined, fallback: string): string {
  if (!key) return fallback;
  const name = localize({ type: 'name_text', key, set: 'Blind' });
  return name && name !== 'ERROR' ? name : fallback;
}

/** a text cut into lines of at most `n` characters */
function wrap(text: string, n: number): string[] {
  const out: string[] = [];
  let line = '';
  for (const word of text.split(' ')) {
    if (line && (line + ' ' + word).length > n) {
      out.push(line);
      line = word;
    } else line = line ? line + ' ' + word : word;
  }
  if (line) out.push(line);
  return out;
}

const W = 2.8; // the board's width: the strip right of the blind select, between the consumables and the deck

function text_row(key: keyof typeof ui, scale: number, colour: any) {
  return { n: G.UIT.R, config: { align: 'cm', minh: scale * 0.85, maxw: W - 0.2 }, nodes: [
    { n: G.UIT.T, config: { ref_table: ui, ref_value: key, scale, colour, shadow: true } },
  ] };
}

function hp_row(name: keyof typeof ui, hp: keyof typeof ui, colour: any) {
  return { n: G.UIT.R, config: { align: 'cm', padding: 0.03 }, nodes: [
    { n: G.UIT.C, config: { align: 'cl', minw: W - 1.35, maxw: W - 1.35, minh: 0.42 }, nodes: [
      { n: G.UIT.T, config: { ref_table: ui, ref_value: name, scale: 0.3, colour: G.C.UI.TEXT_LIGHT, shadow: true } },
    ] },
    { n: G.UIT.C, config: { align: 'cm', minw: 1.05, minh: 0.42, r: 0.1, colour: G.C.BLACK, emboss: 0.05 }, nodes: [
      { n: G.UIT.T, config: { ref_table: ui, ref_value: hp, scale: 0.36, colour, shadow: true } },
    ] },
  ] };
}

function board_definition() {
  return { n: G.UIT.ROOT, config: { align: 'cm', colour: G.C.CLEAR }, nodes: [
    { n: G.UIT.R, config: { align: 'cm', r: 0.1, padding: 0.08, colour: G.C.DYN_UI.MAIN, emboss: 0.05, minw: W }, nodes: [
      { n: G.UIT.R, config: { align: 'cm', minw: W - 0.15 }, nodes: [
        { n: G.UIT.C, config: { align: 'cl', minw: (W - 0.2) / 2 }, nodes: [
          { n: G.UIT.T, config: { text: tr('pvp'), scale: 0.4, colour: G.C.UI.TEXT_LIGHT, shadow: true } },
        ] },
        { n: G.UIT.C, config: { align: 'cr', minw: (W - 0.2) / 2 }, nodes: [
          { n: G.UIT.T, config: { ref_table: ui, ref_value: 'timer', scale: 0.4, colour: G.C.GOLD, shadow: true } },
        ] },
      ] },
      { n: G.UIT.R, config: { align: 'cm', r: 0.1, padding: 0.06, colour: G.C.DYN_UI.DARK, minw: W - 0.15 }, nodes: [
        hp_row('you', 'you_hp', G.C.BLUE),
        hp_row('them', 'them_hp', G.C.RED),
      ] },
      { n: G.UIT.R, config: { align: 'cm', r: 0.1, padding: 0.05, minw: W - 0.15, minh: 0.5 }, nodes: [
        { n: G.UIT.C, config: { align: 'cm' }, nodes: [
          text_row('status_1', 0.25, G.C.UI.TEXT_LIGHT),
          text_row('status_2', 0.25, G.C.UI.TEXT_LIGHT),
          text_row('status_3', 0.25, G.C.UI.TEXT_LIGHT),
        ] },
      ] },
      { n: G.UIT.R, config: { align: 'cm', r: 0.1, padding: 0.06, colour: G.C.BLACK, emboss: 0.05, minw: W - 0.15 }, nodes: [
        { n: G.UIT.C, config: { align: 'cm' }, nodes: [
          text_row('opp_1', 0.26, G.C.GOLD),
          text_row('opp_2', 0.25, G.C.UI.TEXT_LIGHT),
          text_row('opp_3', 0.25, G.C.UI.TEXT_LIGHT),
          text_row('opp_4', 0.25, G.C.UI.TEXT_INACTIVE),
        ] },
      ] },
      { n: G.UIT.R, config: { align: 'cm', padding: 0.02 }, nodes: [
        emote_button(1.2),
        { n: G.UIT.C, config: { minw: 0.08 }, nodes: [] },
        UIBox_button({ button: 'pvp_give_up_ask', label: [tr('give_up')], minw: 1.2, minh: 0.36, scale: 0.26, colour: G.C.UI.BACKGROUND_INACTIVE, col: true }),
      ] },
    ] },
  ] };
}

function give_up_definition() {
  return create_UIBox_generic_options({ back_func: 'exit_overlay_menu', contents: [
    { n: G.UIT.R, config: { align: 'cm', padding: 0.1 }, nodes: [{ n: G.UIT.T, config: { text: tr('give_up_confirm'), scale: 0.45, colour: G.C.UI.TEXT_LIGHT, shadow: true } }] },
    { n: G.UIT.R, config: { align: 'cm', padding: 0.1 }, nodes: [
      UIBox_button({ button: 'pvp_give_up', label: [tr('give_up')], minw: 3, colour: G.C.RED }),
    ] },
  ] });
}

function toggle_definition(m: MatchView) {
  // (while theirs are shown, the button says it goes back: the jokers on screen aren't yours)
  const label = showing_theirs ? tr('your_jokers') : tr('their_jokers', { name: opponent_name(m) });
  return { n: G.UIT.ROOT, config: { align: 'cm', colour: G.C.CLEAR }, nodes: [
    UIBox_button({ button: 'pvp_toggle_jokers', label: [label], minw: showing_theirs ? 3.2 : 2.8, minh: 0.42, scale: 0.3, colour: showing_theirs ? G.C.BLUE : G.C.RED }),
  ] };
}

function show_toggle(m: MatchView) {
  toggle?.remove();
  // (the joker area's own box, its frame and "0/5" row, is drawn after the UI and reaches over the button:
  // it would take its clicks, so it takes none; it is only drawn)
  const area_box = G.jokers.children?.area_uibox;
  if (area_box) area_box.states.collide.can = false;
  toggle = new UIBox({ definition: toggle_definition(m), config: { major: G.jokers, align: 'bm', offset: { x: 0, y: 0.1 }, bond: 'Weak' } });
}

// ------------------------------------------------------------------ the other player's jokers
function opponent_sig(o: OpponentView) {
  return `${o.joker_slots}|` + o.jokers.map((j) => `${j.key}:${j.edition ?? ''}:${JSON.stringify(j.ability ?? {})}`).join(',');
}

function hide_theirs() {
  opp_area?.remove();
  opp_area = null;
  opp_sig = '';
  if (G.jokers) {
    G.jokers.states.visible = true;
    for (const c of G.jokers.cards) c.states.collide.can = true;
  }
}

function show_theirs(o: OpponentView) {
  const sig = opponent_sig(o);
  if (opp_area && sig === opp_sig) return;
  opp_area?.remove();
  const j = G.jokers;
  opp_area = new CardArea(j.T.x, j.T.y, j.T.w, j.T.h, { card_limit: o.joker_slots, type: 'joker', highlight_limit: 0 });
  opp_area.can_highlight = () => false; // (looked at, never sold nor moved)
  for (const cv of o.jokers) {
    const c = create_card(cv, j.T.x, j.T.y, false, false);
    c.states.drag.can = false;
    opp_area.emplace(c);
  }
  opp_area.align_cards();
  opp_sig = sig;
  j.states.visible = false;
  for (const c of j.cards) c.states.collide.can = false;
}

function set_view(theirs: boolean) {
  const m = mp.match;
  if (!m || !in_match_run(m)) return;
  showing_theirs = theirs && !!m.pvp?.opponent;
  if (showing_theirs) show_theirs(m.pvp!.opponent!);
  else hide_theirs();
  play_sound('paper1', 0.9 + Math.random() * 0.1, 0.6);
  show_toggle(m);
}

// ------------------------------------------------------------------ texts
function result_lines(m: MatchView, r: PvPBlindResult): string[] {
  const me = m.seat, them = 1 - m.seat;
  const name = opponent_name(m);
  const score = (i: number) => (r.skipped[i] ? tr('skipped') : `${fmt(r.chips[i])}${r.lost[i] ? ` (${tr('lost_round')})` : ''}`);
  const slot = r.slot === 'Small' ? blind_name('bl_small', 'Small Blind') : r.slot === 'Big' ? blind_name('bl_big', 'Big Blind') : tr('boss_blind');
  return [tr('round_result', { slot, mine: score(me), name, theirs: score(them) })];
}

function status_text(m: MatchView): { text: string; urgent: boolean } {
  const p = m.pvp!;
  const name = opponent_name(m);
  if (m.status !== 'playing') return { text: m.result?.you_won ? tr('victory') : m.result?.winner == null ? tr('draw') : tr('defeat'), urgent: false };
  if (p.opponent_waiting === 'round') return { text: tr('they_wait_round', { name }), urgent: true };
  if (p.opponent_waiting === 'vote') return { text: tr('they_wait_vote', { name }), urgent: true };
  if (p.waiting === 'round') return { text: pvp.cash_out_pending ? tr('cash_out_waiting', { name }) : tr('wait_round', { name }), urgent: false };
  if (p.vote) {
    const choice = (c: string) => tr(c === 'skip' ? 'choice_skip' : 'choice_select');
    const yours = p.vote.yours ?? pvp.choosing;
    if (yours && p.vote.theirs) return { text: `${tr('vote_yours', { choice: choice(yours) })}. ${tr('vote_theirs', { name, choice: choice(p.vote.theirs) })}`, urgent: false };
    if (yours) return { text: `${tr('vote_yours', { choice: choice(yours) })}. ${tr('wait_vote', { name })}`, urgent: false };
    if (p.vote.theirs) return { text: tr('vote_theirs', { name, choice: choice(p.vote.theirs) }), urgent: true };
    return { text: tr('vote_rule'), urgent: false };
  }
  if (pvp.error) return { text: tr('error', { msg: pvp.error }), urgent: true };
  const ante = run.view?.ante ?? 1;
  if (ante <= p.safe_antes) return { text: tr('safe_until', { ante: p.safe_antes + 1 }), urgent: false };
  return { text: '', urgent: false };
}

function opponent_lines(m: MatchView): [string, string, string, string] {
  const o = m.pvp?.opponent;
  const name = opponent_name(m);
  if (!o) return [name, '', '', ''];
  const where = o.phase === 'playing' && o.blind
    ? blind_name(o.blind.key, o.blind.name)
    : tr(`opp_phase_${o.phase}` as Parameters<typeof tr>[0]);
  const playing = o.phase === 'playing' && o.blind;
  return [
    name,
    where,
    playing ? `${fmt(o.round_score)} / ${fmt(o.blind!.chips)}` : `${localize('k_ante')} ${o.ante}  $${fmt(o.dollars)}`,
    playing ? `${tr('hands')} ${o.hands_left}  ${tr('discards')} ${o.discards_left}` : `${tr('jokers')} ${o.jokers.length}/${o.joker_slots}  ${tr('deck')} ${o.deck_size}`,
  ];
}

function update_texts(m: MatchView) {
  const p = m.pvp!;
  ui.you = m.players[m.seat]?.name ?? tr('you');
  ui.them = opponent_name(m);
  ui.you_hp = `${p.hp[m.seat]} ${tr('hp')}`;
  ui.them_hp = `${p.hp[1 - m.seat]} ${tr('hp')}`;
  const s = status_text(m);
  [ui.status_1 = '', ui.status_2 = '', ui.status_3 = ''] = wrap(s.text, 22);
  const left = seconds_left(m);
  ui.timer = left !== null && m.status === 'playing' ? `${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}` : '';
  // the other player waits for you: the last seconds tick
  if (left !== null && left <= 10 && left > 0 && p.opponent_waiting && m.status === 'playing' && left !== last_tick) {
    last_tick = left;
    play_sound('other1', 1.2 + (10 - left) * 0.03, 0.45);
    board?.juice_up?.(0.05, 0.02);
  }
  [ui.opp_1, ui.opp_2, ui.opp_3, ui.opp_4] = opponent_lines(m);
}

// ------------------------------------------------------------------ events
function show_result(m: MatchView) {
  const p = m.pvp!;
  const seen = seen_rounds[m.id];
  const last = p.rounds[p.rounds.length - 1];
  seen_rounds = { [m.id]: p.rounds.length };
  if (seen === undefined || p.rounds.length <= seen || !last || last.skipped.every(Boolean) || !board) return;
  const mine = last.damage[m.seat], theirs = last.damage[1 - m.seat];
  const name = opponent_name(m);
  const text = mine > 0 ? `-${mine} ${tr('hp')}` : theirs > 0 ? `${name} -${theirs} ${tr('hp')}` : tr('no_damage');
  attention_text({ text, scale: 0.9, hold: 2.5, major: board, align: 'cm', offset: { x: 0, y: 0 }, colour: mine > 0 ? G.C.RED : G.C.WHITE });
  play_sound(mine > 0 ? 'cancel' : 'chips2', 1, 0.6);
  board.juice_up?.(0.2, 0.2);
  // what happened, under the board's title for a while
  const [line] = result_lines(m, last);
  [ui.status_1 = '', ui.status_2 = '', ui.status_3 = ''] = wrap(line, 22);
}

/** a row of the end's table: a label, then each player's value */
function summary_row(label: string, values: string[], colour = G.C.UI.TEXT_LIGHT) {
  return { n: G.UIT.R, config: { align: 'cm', padding: 0.02 }, nodes: [
    { n: G.UIT.C, config: { align: 'cl', minw: 2.6 }, nodes: [{ n: G.UIT.T, config: { text: label, scale: 0.32, colour: G.C.UI.TEXT_LIGHT } }] },
    ...values.map((v) => ({ n: G.UIT.C, config: { align: 'cm', minw: 1.8, r: 0.08, padding: 0.04, colour: G.C.L_BLACK }, nodes: [
      { n: G.UIT.T, config: { text: v, scale: 0.32, colour, shadow: true } },
    ] })),
  ] };
}

function summary_table(m: MatchView) {
  const s = m.summary;
  if (!s) return [];
  const by = (seat: number) => s.players.find((p) => p.seat === seat);
  const seats = [m.seat, 1 - m.seat];
  const vals = (f: (p: any) => string) => seats.map((seat) => { const p = by(seat); return p ? f(p) : '-'; });
  return [{ n: G.UIT.R, config: { align: 'cm', r: 0.1, padding: 0.1, colour: G.C.BLACK, emboss: 0.05 }, nodes: [{ n: G.UIT.C, config: { align: 'cm' }, nodes: [
    summary_row('', seats.map((seat) => m.players[seat]?.name ?? '?'), G.C.GOLD),
    summary_row(tr('hp_left'), vals((p) => String(p.hp ?? 0)), G.C.RED),
    summary_row(tr('damage_dealt'), vals((p) => String(p.damage_dealt ?? 0))),
    summary_row(tr('rounds_won'), vals((p) => String(p.rounds_won ?? 0))),
    summary_row(tr('best_hand'), vals((p) => fmt(p.best_hand ?? 0)), G.C.BLUE),
  ] }] }];
}

/** what the end says of a rematch, and its button */
export function rematch_parts(m: MatchView) {
  const r = m.rematch;
  const name = opponent_name(m);
  const line = !r ? '' : r.by_you ? (r.open ? tr('waiting_rematch', { name }) : '') : r.open ? tr('wants_rematch', { name }) : '';
  const label = r && !r.by_you && r.open ? tr('join_rematch') : tr('rematch');
  const button = r?.by_you ? 'nil' : 'mp_rematch';
  return {
    line: { n: G.UIT.R, config: { align: 'cm', minh: 0.4 }, nodes: [{ n: G.UIT.T, config: { text: line, scale: 0.4, colour: G.C.GOLD, shadow: true } }] },
    button: UIBox_button({ button, label: [label], minw: 3, colour: r?.by_you ? G.C.UI.BACKGROUND_INACTIVE : G.C.GREEN, col: true }),
  };
}

function end_definition(m: MatchView) {
  const r = m.result!;
  const draw = r.winner === null;
  const title = draw ? tr('draw') : r.you_won ? tr('victory') : tr('defeat');
  const reason = r.reason === 'left' ? 'reason_left' : r.reason === 'game_over' ? 'reason_game_over' : 'reason_hp';
  const rematch = rematch_parts(m);
  const their_run = other_runs[m.id] ?? null;
  return create_UIBox_generic_options({ no_back: true, contents: [
    { n: G.UIT.R, config: { id: 'mp_end', align: 'cm', padding: 0.1 }, nodes: [
      { n: G.UIT.O, config: { object: new DynaText({ string: [title], colours: [draw ? G.C.WHITE : r.you_won ? G.C.GOLD : G.C.RED], shadow: true, float: true, rotate: true, bump: true, scale: 1.4, pop_in: 0.4 }) } },
    ] },
    { n: G.UIT.R, config: { align: 'cm' }, nodes: [{ n: G.UIT.T, config: { text: tr(reason), scale: 0.45, colour: G.C.UI.TEXT_LIGHT, shadow: true } }] },
    { n: G.UIT.R, config: { align: 'cm', padding: 0.1 }, nodes: summary_table(m) },
    rematch.line,
    { n: G.UIT.R, config: { align: 'cm', padding: 0.08 }, nodes: [
      rematch.button,
      { n: G.UIT.C, config: { minw: 0.3 }, nodes: [] },
      their_run
        ? UIBox_button({ button: 'mp_watch_run', ref_table: { run: their_run }, label: [tr('watch_their_run', { name: opponent_name(m) })], minw: 3, colour: G.C.RED, col: true })
        : { n: G.UIT.C, config: {}, nodes: [] },
      { n: G.UIT.C, config: { minw: 0.3 }, nodes: [] },
      emote_button(2, 0.5, 0.75),
    ] },
    { n: G.UIT.R, config: { align: 'cm', padding: 0.08 }, nodes: [
      UIBox_button({ button: 'pvp_keep_playing', label: [tr('keep_playing')], minw: 3, colour: G.C.GREY, col: true }),
      { n: G.UIT.C, config: { minw: 0.3 }, nodes: [] },
      UIBox_button({ button: 'pvp_to_menu', label: [tr('main_menu')], minw: 3, colour: G.C.ORANGE, col: true }),
    ] },
  ] });
}

/** the other player's run in a finished match (theirs to watch: the match's history has it) */
const other_runs: Record<string, string | null> = {};

function find_other_run(m: MatchView) {
  if (m.id in other_runs) return;
  other_runs[m.id] = null;
  void matches.history(5).then((h) => {
    const entry = h.matches.find((x) => x.id === m.id);
    other_runs[m.id] = entry?.runs[1 - entry.seat] ?? null;
    end_key = '';
    if (mp.match?.id === m.id) end_changed(mp.match);
  }, () => {});
}

/** the rematch (or the other player's run) on the end screen changed: draw it again */
function end_changed(m: MatchView) {
  find_other_run(m);
  const key = `${m.id}:${JSON.stringify(m.rematch ?? null)}:${other_runs[m.id] ?? ''}`;
  if (key === end_key) return;
  end_key = key;
  if (G.OVERLAY_MENU?.get_UIE_by_ID?.('mp_end')) G.FUNCS.overlay_menu({ definition: end_definition(m) });
}

function show_end(m: MatchView) {
  if (ended_shown === m.id || !m.result) return;
  ended_shown = m.id;
  G.E_MANAGER.add_event(new Event({
    trigger: 'after', delay: 1.5, blockable: false, blocking: false,
    func: () => {
      if (!in_match_run(mp.match)) return true;
      G.SETTINGS.paused = true;
      end_key = `${m.id}:${JSON.stringify(m.rematch ?? null)}:${other_runs[m.id] ?? ''}`;
      G.FUNCS.overlay_menu({ definition: end_definition(m) });
      play_sound(m.result?.you_won ? 'win' : 'negative', 1, 0.6);
      return true;
    },
  }));
}

// ------------------------------------------------------------------ the title screen
function menu_definition(m: MatchView) {
  const asked = m.status === 'finished';
  return { n: G.UIT.ROOT, config: { align: 'cm', colour: G.C.CLEAR }, nodes: [
    { n: G.UIT.R, config: { align: 'cm', r: 0.1, padding: 0.12, colour: G.C.L_BLACK, emboss: 0.05 }, nodes: [
      { n: G.UIT.C, config: { align: 'cm', padding: 0.05 }, nodes: [
        { n: G.UIT.T, config: { text: asked ? tr('wants_rematch', { name: opponent_name(m) }) : tr('in_progress'), scale: 0.4, colour: asked ? G.C.GOLD : G.C.UI.TEXT_LIGHT, shadow: true } },
      ] },
      asked
        ? UIBox_button({ button: 'mp_rematch', label: [tr('join_rematch')], minw: 3, minh: 0.6, scale: 0.4, colour: G.C.GREEN, col: true })
        : UIBox_button({ button: 'multiplayer_rejoin', label: [tr('rejoin')], minw: 3, minh: 0.6, scale: 0.4, colour: G.C.RED, col: true }),
    ] },
  ] };
}

function render_menu(m: MatchView | null) {
  const on_menu = G.STAGE === G.STAGES.MAIN_MENU && !!G.MAIN_MENU_UI && !G.screenwipe && !G.OVERLAY_MENU && !!m;
  const playing = on_menu && m!.status === 'playing' && !!m!.run_id;
  const asked = on_menu && m!.status === 'finished' && !!m!.rematch?.open && !m!.rematch.by_you;
  const key = playing ? `play:${m!.id}` : asked ? `rematch:${m!.id}` : '';
  if (key !== menu_key && menu_box) { menu_box.remove(); menu_box = null; }
  menu_key = key;
  if (!key || (menu_box && !menu_box.REMOVED)) return;
  menu_box = new UIBox({ definition: menu_definition(m!), config: { align: 'tmi', offset: { x: 0, y: 0.3 }, major: G.ROOM_ATTACH, bond: 'Weak' } });
}

// ------------------------------------------------------------------ the whole
function remove_all() {
  hide_theirs();
  showing_theirs = false;
  board?.remove();
  board = null;
  toggle?.remove();
  toggle = null;
}

function render(m: MatchView | null = mp.match) {
  render_menu(m);
  if (!in_match_run(m) || !m.pvp || G.STAGE !== G.STAGES.RUN || !G.consumeables || !G.jokers) {
    if (board || toggle || opp_area) remove_all();
    return;
  }
  update_texts(m);
  if (!board || board.REMOVED) {
    board = new UIBox({ definition: board_definition(), config: { major: G.ROOM_ATTACH, align: 'cri', offset: { x: -0.05, y: -0.7 }, bond: 'Weak' } });
  }
  if (!toggle || toggle.REMOVED) show_toggle(m);
  // (the player's own jokers again while an action plays)
  if (showing_theirs && run.busy) set_view(false);
  else if (showing_theirs && m.pvp.opponent) show_theirs(m.pvp.opponent);
  show_result(m);
  if (m.status === 'finished') {
    show_end(m);
    end_changed(m);
  }
}

/** the other player's whole deck, for the full deck screen's tab */
function opponent_deck() {
  const o = mp.match?.pvp?.opponent;
  return (o?.full_deck ?? []).map((d) => deck_card(d.card_key, d.key, d.edition, d.seal, true));
}

export function start_board() {
  on_match((m) => render(m));
  // the timer, and the screens changing under the board (into or out of the run)
  setInterval(() => {
    const m = mp.match;
    if (m && in_match_run(m) && m.pvp) update_texts(m);
    render(m);
  }, 500);
  G.FUNCS.pvp_toggle_jokers = () => set_view(!showing_theirs);
  G.FUNCS.pvp_to_menu = () => {
    close_emotes();
    G.FUNCS.exit_overlay_menu();
    G.FUNCS.go_to_menu();
  };
  G.FUNCS.pvp_keep_playing = () => {
    close_emotes();
    G.FUNCS.exit_overlay_menu();
  };
  G.FUNCS.pvp_give_up_ask = () => {
    G.SETTINGS.paused = true;
    G.FUNCS.overlay_menu({ definition: give_up_definition() });
  };
  G.FUNCS.pvp_give_up = () => {
    G.FUNCS.exit_overlay_menu();
    const m = mp.match;
    if (!m || m.status !== 'playing') return;
    void matches.leave(m.id).then(() => refresh(), () => refresh());
  };
  G.UIDEF.extra_deck_tabs = () => {
    const m = mp.match;
    if (!in_match_run(m) || !m.pvp?.opponent) return [];
    return [{ label: tr('their_deck', { name: opponent_name(m) }), tab_definition_function: () => G.UIDEF.view_deck(false, opponent_deck()) }];
  };
}
