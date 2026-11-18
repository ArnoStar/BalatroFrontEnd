// Coop in the run, drawn with the game's own UI: the board right of the blind
// select (whose turn it is, both players' jokers and decks, the shop's
// leaving), and a name tag on the other player's jokers (they count for both,
// but only their owner sells and moves them).
import { G, UIBox, play_sound } from '@/shared/lib/engine';
import { UIBox_button, attention_text, create_UIBox_generic_options } from '@/shared/ui';
import { matches, type MatchView } from '@/shared/api';
import { run } from '@/entities/run';
import { mp, on_match, refresh } from '../model/match';
import { in_coop_run } from '../model/coop';
import { tr } from './text';

const W = 2.8;
const ui = { turn: '', you: '', you_info: '', them: '', them_info: '', status_1: '', status_2: '' };

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
          text_row('them', 0.3, G.C.GREEN),
          text_row('them_info', 0.25, G.C.UI.TEXT_LIGHT),
        ] },
      ] },
      { n: G.UIT.R, config: { align: 'cm', padding: 0.04, minw: W - 0.15, minh: 0.45 }, nodes: [
        { n: G.UIT.C, config: { align: 'cm' }, nodes: [
          text_row('status_1', 0.25, G.C.UI.TEXT_LIGHT),
          text_row('status_2', 0.25, G.C.UI.TEXT_LIGHT),
        ] },
      ] },
      { n: G.UIT.R, config: { align: 'cm', padding: 0.02 }, nodes: [
        UIBox_button({ button: 'coop_leave', label: [tr('leave')], minw: 1.6, minh: 0.36, scale: 0.26, colour: G.C.UI.BACKGROUND_INACTIVE }),
      ] },
    ] },
  ] };
}

function update(m: MatchView) {
  const v = run.view?.coop;
  if (!v) return;
  const seat = v.seat ?? m.seat;
  const name = partner(m);
  const mine_jokers = (run.view?.jokers ?? []).filter((j) => j.owner === seat).length;
  const theirs_jokers = (run.view?.jokers ?? []).filter((j) => j.owner === 1 - seat).length;
  ui.turn = v.your_turn ? tr('your_turn') : tr('their_turn', { name });
  ui.you = m.players[m.seat]?.name ?? tr('you');
  ui.them = name;
  const deck = (s: number) => v.seats[s]?.deck ?? 0;
  ui.you_info = `${tr('jokers')} ${mine_jokers}/${v.joker_slots[seat] ?? 5}  ${tr('deck')} ${deck(seat)}`;
  ui.them_info = `${tr('jokers')} ${theirs_jokers}/${v.joker_slots[1 - seat] ?? 5}  ${tr('deck')} ${deck(1 - seat)}`;
  let status = '';
  if (run.view?.phase === 'shop') {
    if (v.shop_votes.includes(seat) && !v.shop_votes.includes(1 - seat)) status = tr('wait_shop', { name });
    else if (v.shop_votes.includes(1 - seat)) status = tr('they_left_shop', { name });
  } else if (v.pack_seat !== null && v.pack_seat !== seat && run.view?.phase === 'pack') {
    status = tr('their_pack', { name });
  } else if (!v.your_turn && run.view?.phase === 'playing') {
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
  const seat = run.view?.coop?.seat ?? m.seat;
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

export function start_coop_board() {
  on_match((m) => render(m));
  setInterval(() => render(), 400);
  G.FUNCS.coop_leave = () => {
    const m = mp.match;
    if (!m || m.status !== 'playing') return;
    void matches.leave(m.id).then(() => refresh(), () => refresh()).then(() => G.FUNCS.go_to_menu());
  };
}
