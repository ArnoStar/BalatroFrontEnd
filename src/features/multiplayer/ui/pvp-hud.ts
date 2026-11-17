// The PvP panel beside the run: both players' hit points, the other player's
// run (where they are, their score, money and jokers), what the match waits
// for and the timer, each blind's result, and the end of the match. On the
// title screen, a match being played shows a button back to it.
import { G } from '@/shared/lib/engine';
import { localize } from '@/shared/lib/localization';
import { matches, type MatchView, type OpponentView, type PvPBlindResult } from '@/shared/api';
import { run } from '@/entities/run';
import { mp, on_match, refresh, seconds_left } from '../model/match';
import { in_match_run, pvp } from '../model/pvp';
import { add_style, button, el, toast } from './style';
import { tr } from './text';

let hud: HTMLElement | null = null;
const parts: Record<string, HTMLElement> = {};
let minimized = false;
let seen_rounds: Record<string, number> = {};
let ended_shown = '';
let end_el: HTMLElement | null = null;
let bubble: HTMLElement | null = null;

function fmt(x: number | string): string {
  if (typeof x === 'string') return x;
  return Math.abs(x) >= 1e11 ? x.toExponential(3) : Math.floor(x).toLocaleString();
}

function opponent_name(m: MatchView): string {
  return m.players.find((p) => !p.you)?.name ?? tr('opponent');
}

function blind_name(key: string | null | undefined, fallback: string): string {
  if (!key) return fallback;
  const name = localize({ type: 'name_text', key, set: 'Blind' });
  return name && name !== 'ERROR' ? name : fallback;
}

function bar(cls: string): { row: HTMLElement; name: HTMLElement; fill: HTMLElement; hp: HTMLElement } {
  const row = el('div', `mp-bar ${cls}`);
  const name = el('span', 'mp-bar__name');
  const track = el('div', 'mp-bar__track');
  const fill = el('div', 'mp-bar__fill');
  track.append(fill);
  const hp = el('span', 'mp-bar__hp');
  row.append(name, track, hp);
  return { row, name, fill, hp };
}

const bars: Record<'me' | 'them', ReturnType<typeof bar> | null> = { me: null, them: null };

function build() {
  add_style();
  hud = el('div', 'mp-hud');
  hud.setAttribute('role', 'region');
  hud.setAttribute('aria-label', 'PvP');
  const top = el('div', 'mp-hud__top');
  top.append(el('span', 'mp-hud__title', tr('pvp')));
  const min = el('button', 'mp-hud__tiny', '–');
  min.type = 'button';
  min.title = 'Hide / show';
  min.onclick = () => { minimized = !minimized; hud?.classList.toggle('mp-hud--min', minimized); };
  top.append(min);
  bars.me = bar('mp-bar--me');
  bars.them = bar('mp-bar--them');
  parts.safe = el('div', 'mp-hud__safe');
  parts.status = el('div', 'mp-hud__status');
  parts.status.setAttribute('aria-live', 'polite');
  const more = el('div', 'mp-hud__more');
  parts.opp = el('div', 'mp-hud__opp');
  parts.result = el('div', 'mp-hud__result');
  const give_up = el('button', 'mp-hud__tiny', tr('give_up'));
  give_up.type = 'button';
  give_up.onclick = () => {
    const m = mp.match;
    if (!m || m.status !== 'playing' || !confirm(tr('give_up_confirm'))) return;
    void matches.leave(m.id).then(() => refresh(), () => refresh());
  };
  parts.give_up = give_up;
  more.style.display = 'grid';
  more.style.gap = '6px';
  more.append(parts.opp, parts.result, give_up);
  hud.append(top, bars.me.row, bars.them.row, parts.safe, parts.status, more);
  hud.classList.toggle('mp-hud--min', minimized);
  document.body.append(hud);
}

function set_bar(b: ReturnType<typeof bar> | null, name: string, hp: number, start: number) {
  if (!b) return;
  b.name.textContent = name;
  const old = Number(b.hp.textContent);
  b.hp.textContent = String(hp);
  b.fill.style.width = `${Math.max(0, Math.min(100, (100 * hp) / start))}%`;
  if (b.hp.textContent !== '' && Number.isFinite(old) && hp < old) {
    b.row.classList.remove('mp-hit');
    void b.row.offsetWidth;
    b.row.classList.add('mp-hit');
  }
}

function opponent_box(o: OpponentView | null, name: string): HTMLElement[] {
  if (!o) return [];
  const rows: HTMLElement[] = [];
  const head = el('div');
  head.append(el('b', undefined, name), ` · Ante ${o.ante} · $${fmt(o.dollars)}`);
  rows.push(head);
  if (o.phase === 'playing' && o.blind) {
    rows.push(el('div', undefined, tr('opp_playing', { blind: blind_name(o.blind.key, o.blind.name) })));
    rows.push(el('div', undefined, `${fmt(o.round_score)} / ${fmt(o.blind.chips)}`));
    rows.push(el('div', 'mp-dim', `${tr('hands')} ${o.hands_left} · ${tr('discards')} ${o.discards_left}`));
  } else {
    const key = `opp_phase_${o.phase}` as const;
    rows.push(el('div', undefined, tr(key as Parameters<typeof tr>[0])));
  }
  const jokers = el('div', 'mp-hud__jokers');
  jokers.append(el('span', 'mp-dim', `${tr('jokers')} ${o.jokers.length}/${o.joker_slots}:`));
  for (const j of o.jokers) {
    const chip = el('span', `mp-chip${j.edition ? ` mp-chip--${j.edition}` : ''}`, j.name ?? '?');
    if (j.edition) chip.title = j.edition;
    jokers.append(chip);
  }
  rows.push(jokers);
  return rows;
}

function result_text(m: MatchView, r: PvPBlindResult): string[] {
  const me = m.seat, them = 1 - m.seat;
  const name = opponent_name(m);
  const score = (i: number) => (r.skipped[i] ? tr('skipped') : `${fmt(r.chips[i])}${r.lost[i] ? ` (${tr('lost_round')})` : ''}`);
  const slot = r.slot === 'Small' ? blind_name('bl_small', 'Small Blind') : r.slot === 'Big' ? blind_name('bl_big', 'Big Blind') : tr('boss_blind');
  const lines = [tr('round_result', { slot, mine: score(me), name, theirs: score(them) })];
  if (r.damage[me] > 0) lines.push(tr('damage_you', { n: r.damage[me] }));
  if (r.damage[them] > 0) lines.push(tr('damage_them', { name, n: r.damage[them] }));
  if (r.damage[me] === 0 && r.damage[them] === 0) lines.push(tr('no_damage'));
  return lines;
}

function status_line(m: MatchView): { text: string; urgent: boolean } {
  const p = m.pvp!;
  const name = opponent_name(m);
  const left = seconds_left(m);
  const time = left !== null ? ` · ${tr('time_left', { n: left })}` : '';
  if (m.status !== 'playing') return { text: '', urgent: false };
  if (p.opponent_waiting === 'round') return { text: tr('they_wait_round', { name }) + time, urgent: true };
  if (p.opponent_waiting === 'vote') return { text: tr('they_wait_vote', { name }) + time, urgent: true };
  const lines: string[] = [];
  if (p.waiting === 'round') lines.push(pvp.cash_out_pending ? tr('cash_out_waiting', { name }) : tr('wait_round', { name }));
  if (p.vote) {
    const choice = (c: string) => tr(c === 'skip' ? 'choice_skip' : 'choice_select');
    const yours = p.vote.yours ?? pvp.choosing;
    if (yours) lines.push(tr('vote_yours', { choice: choice(yours) }));
    if (p.vote.theirs) lines.push(tr('vote_theirs', { name, choice: choice(p.vote.theirs) }));
    if (p.waiting === 'vote') lines.push(tr('wait_vote', { name }));
    lines.push(tr('vote_rule'));
  }
  if (pvp.error) lines.push(tr('error', { msg: pvp.error }));
  return { text: lines.join(' · ') + (p.waiting ? time : ''), urgent: false };
}

function show_end(m: MatchView) {
  if (ended_shown === m.id || !m.result) return;
  ended_shown = m.id;
  add_style();
  end_el?.remove();
  const r = m.result;
  const draw = r.winner === null;
  const root = el('div', 'mp-root');
  root.setAttribute('role', 'dialog');
  const panel = el('div', `mp-panel mp-end ${draw ? '' : r.you_won ? 'mp-end--win' : 'mp-end--lose'}`);
  panel.append(el('h2', undefined, draw ? tr('draw') : r.you_won ? tr('victory') : tr('defeat')));
  const reason = r.reason === 'left' ? 'reason_left' : r.reason === 'game_over' ? 'reason_game_over' : 'reason_hp';
  panel.append(el('p', undefined, tr(reason)));
  if (m.pvp) {
    panel.append(el('p', 'mp-dim', m.players.map((p) => `${p.name ?? '?'}: ${m.pvp!.hp[p.seat]} ${tr('hp')}`).join(' · ')));
  }
  const row = el('div', 'mp-buttons');
  row.style.justifyContent = 'center';
  row.append(
    button(tr('keep_playing'), 'mp-btn--grey', () => { root.remove(); end_el = null; }),
    button(tr('main_menu'), 'mp-btn--orange', () => { root.remove(); end_el = null; G.FUNCS.go_to_menu(); }),
  );
  panel.append(row);
  root.append(panel);
  document.body.append(root);
  end_el = root;
}

function render(m: MatchView | null = mp.match) {
  render_bubble(m);
  if (!in_match_run(m) || !m.pvp) {
    hud?.remove();
    hud = null;
    return;
  }
  if (!hud) build();
  const p = m.pvp;
  const me = m.players[m.seat];
  set_bar(bars.me, `${me?.name ?? tr('you')}`, p.hp[m.seat], p.start_hp);
  set_bar(bars.them, opponent_name(m), p.hp[1 - m.seat], p.start_hp);
  const ante = run.view?.ante ?? 1;
  parts.safe.textContent = ante <= p.safe_antes && m.status === 'playing' ? tr('safe_until', { ante: p.safe_antes + 1 }) : '';
  const s = status_line(m);
  parts.status.textContent = s.text;
  parts.status.classList.toggle('mp-hud__status--urgent', s.urgent);
  parts.opp.replaceChildren(...opponent_box(p.opponent, opponent_name(m)));
  const last = p.rounds[p.rounds.length - 1];
  parts.result.textContent = last ? result_text(m, last).join(' · ') : '';
  parts.give_up.hidden = m.status !== 'playing';
  // a blind both have finished: what it cost
  const seen = seen_rounds[m.id];
  if (seen !== undefined && p.rounds.length > seen && last && !last.skipped.every(Boolean)) {
    const lines = result_text(m, last);
    toast(lines.map((l, i) => [l, i > 0 && l !== tr('no_damage')] as [string, boolean]));
  }
  seen_rounds = { [m.id]: p.rounds.length };
  if (m.status === 'finished') show_end(m);
}

/** the title screen: back to the match being played */
function render_bubble(m: MatchView | null) {
  const on_menu = G.STAGE === G.STAGES.MAIN_MENU && !!m && m.status === 'playing' && !!m.run_id;
  if (!on_menu) {
    bubble?.remove();
    bubble = null;
    return;
  }
  if (bubble) return;
  add_style();
  bubble = el('div', 'mp-toast mp-toast--corner');
  bubble.append(el('div', undefined, tr('in_progress')));
  const go = button(tr('rejoin'), 'mp-btn--red', () => { G.FUNCS.multiplayer_rejoin?.(); });
  go.style.marginTop = '6px';
  bubble.append(go);
  document.body.append(bubble);
}

export function start_pvp_hud() {
  on_match((m) => render(m));
  // the countdown, and the screen changing under the panel (into or out of the run)
  setInterval(() => render(), 500);
}
