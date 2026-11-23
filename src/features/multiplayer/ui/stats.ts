// The player's multiplayer numbers and their last matches (the MULTIPLAYER
// menu's "Stats & history"), drawn like the game's own Profile > Stats: a tab
// of numbers (PvP and coop, the rivals and partners), and a tab of matches,
// each with buttons to watch its runs again (/play/?watch=<run>).
import { G, number_format } from '@/shared/lib/engine';
import { UIBox_button, create_UIBox_generic_options, create_tabs } from '@/shared/ui';
import { localize } from '@/shared/lib/localization';
import { matches, type MatchHistoryEntry, type MatchOpponentStats, type MultiplayerStats, type Score } from '@/shared/api';
import { close_lobby } from './lobby';
import { tr } from './text';

const HISTORY_SHOWN = 8;

let data: { stats: MultiplayerStats; history: MatchHistoryEntry[] } | null = null;

const fmt = (x: Score | null | undefined) => (typeof x === 'number' ? number_format(x) : x === 'inf' ? 'naneinf' : String(x ?? 0));

function stat_row(label: string, value: string, colour = G.C.UI.TEXT_LIGHT) {
  return { n: G.UIT.R, config: { align: 'cm', padding: 0.03 }, nodes: [
    { n: G.UIT.C, config: { align: 'cl', minw: 2.7 }, nodes: [{ n: G.UIT.T, config: { text: label, scale: 0.3, colour: G.C.UI.TEXT_LIGHT } }] },
    { n: G.UIT.C, config: { align: 'cr', minw: 1.9, r: 0.08, padding: 0.05, colour: G.C.L_BLACK }, nodes: [{ n: G.UIT.T, config: { text: value, scale: 0.3, colour, shadow: true } }] },
  ] };
}

function heading(text: string, colour: any) {
  return { n: G.UIT.R, config: { align: 'cm', padding: 0.06 }, nodes: [{ n: G.UIT.T, config: { text, scale: 0.5, colour, shadow: true } }] };
}

function people(list: MatchOpponentStats[], line: (o: MatchOpponentStats) => string) {
  if (!list.length) return [{ n: G.UIT.R, config: { align: 'cm', padding: 0.04 }, nodes: [{ n: G.UIT.T, config: { text: tr('no_one_yet'), scale: 0.27, colour: G.C.UI.TEXT_INACTIVE } }] }];
  return list.map((o) => ({ n: G.UIT.R, config: { align: 'cm', padding: 0.02 }, nodes: [
    { n: G.UIT.C, config: { align: 'cl', minw: 2.2, maxw: 2.2 }, nodes: [{ n: G.UIT.T, config: { text: o.name ?? '?', scale: 0.28, colour: G.C.UI.TEXT_LIGHT } }] },
    { n: G.UIT.C, config: { align: 'cr', minw: 2.4 }, nodes: [{ n: G.UIT.T, config: { text: line(o), scale: 0.26, colour: G.C.UI.TEXT_INACTIVE } }] },
  ] }));
}

function column(nodes: any[]) {
  return { n: G.UIT.C, config: { align: 'tm', r: 0.1, padding: 0.12, colour: G.C.BLACK, emboss: 0.05, minw: 5, minh: 6.6 }, nodes };
}

function stats_tab() {
  const s = data!.stats;
  const p = s.pvp, c = s.coop;
  const rate = p.played ? `${Math.round((100 * p.won) / p.played)}%` : '-';
  const pvp = column([
    heading(tr('pvp'), G.C.RED),
    stat_row(tr('played'), String(p.played)),
    { n: G.UIT.R, config: { align: 'cm', padding: 0.03 }, nodes: [{ n: G.UIT.T, config: { text: tr('record', { w: p.won, l: p.lost, d: p.drawn }), scale: 0.27, colour: G.C.UI.TEXT_INACTIVE } }] },
    stat_row(tr('win_rate'), rate, G.C.GOLD),
    stat_row(tr('streak'), `${p.streak} (${p.best_streak})`, G.C.GOLD),
    stat_row(tr('damage_dealt'), String(p.damage_dealt), G.C.RED),
    stat_row(tr('damage_taken'), String(p.damage_taken)),
    stat_row(tr('best_ante'), String(p.best_ante), G.C.FILTER),
    heading(tr('rivals'), G.C.UI.TEXT_LIGHT),
    ...people(s.rivals, (o) => `${o.won} - ${o.lost} (${o.played})`),
  ]);
  const coop = column([
    heading(tr('coop'), G.C.BLUE),
    stat_row(tr('played'), String(c.played)),
    stat_row(tr('runs_won'), String(c.runs_won), G.C.GOLD),
    stat_row(tr('best_ante'), String(c.best_ante), G.C.FILTER),
    stat_row(tr('best_round'), String(c.best_round), G.C.FILTER),
    stat_row(tr('hands_played'), String(c.hands), G.C.BLUE),
    stat_row(tr('chips_scored'), fmt(c.chips), G.C.BLUE),
    stat_row(tr('best_hand'), fmt(c.best_hand), G.C.RED),
    ...(c.best_hand_name ? [{ n: G.UIT.R, config: { align: 'cr' }, nodes: [{ n: G.UIT.T, config: { text: localize(c.best_hand_name, 'poker_hands'), scale: 0.26, colour: G.C.UI.TEXT_INACTIVE } }] }] : []),
    heading(tr('partners'), G.C.UI.TEXT_LIGHT),
    ...people(s.partners, (o) => `${tr('ante_n', { n: o.best_ante })} (${o.played})`),
  ]);
  return { n: G.UIT.ROOT, config: { align: 'cm', colour: G.C.CLEAR, padding: 0.1 }, nodes: [
    { n: G.UIT.R, config: { align: 'cm' }, nodes: [pvp, { n: G.UIT.C, config: { minw: 0.3 }, nodes: [] }, coop] },
  ] };
}

function result_text(m: MatchHistoryEntry): { text: string; colour: any } {
  if (m.mode === 'coop') {
    return m.summary?.run_won ? { text: tr('run_won'), colour: G.C.GOLD } : { text: tr('ante_n', { n: m.summary?.ante ?? '?' }), colour: G.C.FILTER };
  }
  if (m.result.winner === null) return { text: tr('draw'), colour: G.C.UI.TEXT_LIGHT };
  return m.result.you_won ? { text: tr('victory'), colour: G.C.GOLD } : { text: tr('defeat'), colour: G.C.RED };
}

function when(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function match_row(m: MatchHistoryEntry) {
  const other = m.players.find((p) => !p.you)?.name ?? '?';
  const r = result_text(m);
  const mine = m.runs[m.seat], theirs = m.runs[1 - m.seat];
  const hp = m.mode === 'pvp' && m.summary ? m.summary.players.map((p) => p.hp ?? '?').join(' - ') + ` ${tr('hp')}` : '';
  const watch = m.mode === 'coop' || mine === theirs
    ? [UIBox_button({ button: 'mp_watch_run', ref_table: { run: mine }, label: [tr('watch')], minw: 2, minh: 0.4, scale: 0.28, colour: G.C.BLUE, col: true })]
    : [
      UIBox_button({ button: 'mp_watch_run', ref_table: { run: mine }, label: [tr('watch_mine')], minw: 1.1, minh: 0.4, scale: 0.28, colour: G.C.BLUE, col: true }),
      { n: G.UIT.C, config: { minw: 0.06 }, nodes: [] },
      UIBox_button({ button: 'mp_watch_run', ref_table: { run: theirs }, label: [tr('watch_theirs')], minw: 1.1, minh: 0.4, scale: 0.28, colour: G.C.RED, col: true }),
    ];
  return { n: G.UIT.R, config: { align: 'cm', r: 0.1, padding: 0.06, colour: G.C.L_BLACK, emboss: 0.04, minw: 11.4 }, nodes: [
    { n: G.UIT.C, config: { align: 'cm', r: 0.08, padding: 0.05, minw: 0.9, colour: m.mode === 'pvp' ? G.C.RED : G.C.BLUE }, nodes: [
      { n: G.UIT.T, config: { text: tr(m.mode), scale: 0.28, colour: G.C.UI.TEXT_LIGHT } },
    ] },
    { n: G.UIT.C, config: { align: 'cl', minw: 3, maxw: 3, padding: 0.05 }, nodes: [
      { n: G.UIT.T, config: { text: tr(m.mode === 'pvp' ? 'versus' : 'with', { name: other }), scale: 0.3, colour: G.C.UI.TEXT_LIGHT, shadow: true } },
    ] },
    { n: G.UIT.C, config: { align: 'cm', minw: 1.9 }, nodes: [{ n: G.UIT.T, config: { text: r.text, scale: 0.32, colour: r.colour, shadow: true } }] },
    { n: G.UIT.C, config: { align: 'cm', minw: 1.6 }, nodes: [{ n: G.UIT.T, config: { text: hp, scale: 0.26, colour: G.C.UI.TEXT_INACTIVE } }] },
    { n: G.UIT.C, config: { align: 'cm', minw: 1.5 }, nodes: [{ n: G.UIT.T, config: { text: when(m.finished_at), scale: 0.26, colour: G.C.UI.TEXT_INACTIVE } }] },
    { n: G.UIT.C, config: { align: 'cr', minw: 2.4 }, nodes: watch },
  ] };
}

function history_tab() {
  const list = data!.history.slice(0, HISTORY_SHOWN);
  const rows = list.length
    ? list.map(match_row)
    : [{ n: G.UIT.R, config: { align: 'cm', padding: 0.3 }, nodes: [{ n: G.UIT.T, config: { text: tr('no_matches'), scale: 0.4, colour: G.C.UI.TEXT_INACTIVE } }] }];
  return { n: G.UIT.ROOT, config: { align: 'cm', colour: G.C.CLEAR, padding: 0.1 }, nodes: [
    { n: G.UIT.R, config: { align: 'tm', r: 0.1, padding: 0.1, colour: G.C.BLACK, emboss: 0.05, minh: 6.6 }, nodes: [
      { n: G.UIT.C, config: { align: 'tm', padding: 0.04 }, nodes: rows.map((r) => ({ n: G.UIT.R, config: { align: 'cm', padding: 0.04 }, nodes: [r] })) },
    ] },
  ] };
}

function definition() {
  return create_UIBox_generic_options({ back_func: 'multiplayer', contents: [create_tabs({
    tabs: [
      { label: tr('stats'), chosen: true, tab_definition_function: stats_tab },
      { label: tr('history'), tab_definition_function: history_tab },
    ],
    tab_h: 7.2, snap_to_nav: true,
  })] });
}

export function register_stats_funcs() {
  G.FUNCS.mp_stats = () => {
    void Promise.all([matches.stats(), matches.history(HISTORY_SHOWN)]).then(([stats, history]) => {
      data = { stats, history: history.matches };
      close_lobby(); // (its screen would draw itself again over this one)
      G.SETTINGS.paused = true;
      G.FUNCS.overlay_menu({ definition: definition() });
    }, (err) => console.warn('[multiplayer] no stats', err));
  };
  /** watch one of a match's runs again (the page reopens on it) */
  G.FUNCS.mp_watch_run = (e: any) => {
    const run = e?.config?.ref_table?.run as string | null | undefined;
    if (!run) return;
    location.assign(`${location.pathname}?watch=${encodeURIComponent(run)}`);
  };
}
