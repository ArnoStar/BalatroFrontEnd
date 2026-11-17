// The MULTIPLAYER screen: pick a mode, make a match or join one with its code,
// then the lobby (the invite code, the players, the host's settings) until the
// host starts it. A started match opens the player's run.
import { G } from '@/shared/lib/engine';
import { localize } from '@/shared/lib/localization';
import { input_state } from '@/shared/lib/input';
import { matches, type MatchView } from '@/shared/api';
import { mp, on_match, problem, refresh, set_match } from '../model/match';
import { add_style, button, el } from './style';
import { tr } from './text';

const TIMERS = [60, 120, 180, 300];
const RULES = { hp: 50, ante: 4, loss: 10 };

let root: HTMLElement | null = null;
let off: (() => void) | null = null;
let status_el: HTMLElement | null = null;
let shown: string | null = null; // what the panel shows: 'menu', or the match's id and status

function decks(): { key: string; name: string }[] {
  return Object.values<any>(G.P_CENTERS)
    .filter((c) => c.set === 'Back' && c.key !== 'b_challenge')
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
    .map((c) => ({ key: c.key, name: localize({ type: 'name_text', key: c.key, set: 'Back' }) || c.name }));
}

function stakes(): { level: number; name: string }[] {
  return Object.values<any>(G.P_STAKES)
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
    .map((s, i) => ({ level: s.stake_level ?? i + 1, name: localize({ type: 'name_text', key: s.key, set: 'Stake' }) || s.name }));
}

function set_status(text: string, error = false) {
  if (!status_el) return;
  status_el.textContent = text;
  status_el.className = `mp-status${error ? ' mp-status--error' : ''}`;
}

async function attempt(fn: () => Promise<unknown>) {
  set_status('');
  try {
    await fn();
  } catch (err) {
    set_status(tr('error', { msg: problem(err) }), true);
  }
}

/** a started match: its run on screen */
export function open_match_run(m: MatchView) {
  if (!m.run_id) return;
  close_lobby();
  G.FUNCS.start_run(null, { open_id: m.run_id });
}

function menu_panel(): HTMLElement {
  const panel = el('div', 'mp-panel');
  panel.append(el('h2', undefined, tr('title')));
  const modes = el('div', 'mp-modes');
  const pvp = el('div', 'mp-mode mp-mode--pvp');
  pvp.append(el('div', 'mp-mode__name', tr('pvp')), el('p', undefined, tr('pvp_desc')),
    el('p', 'mp-rules', tr('pvp_rules', RULES)),
    button(tr('create'), 'mp-btn--red', () => attempt(async () => {
      set_match(await matches.create({ mode: 'pvp', game_speed: G.SETTINGS.GAMESPEED ?? 1 }));
    })));
  pvp.querySelector('button')?.setAttribute('aria-label', `${tr('create')}: ${tr('pvp')}`);
  const coop = el('div', 'mp-mode mp-mode--coop mp-mode--off');
  const coop_btn = button(tr('create'), 'mp-btn--blue', () => {});
  coop_btn.disabled = true;
  coop_btn.setAttribute('aria-label', `${tr('create')}: ${tr('coop')}`);
  coop.append(el('div', 'mp-mode__name', tr('coop')), el('p', undefined, tr('coop_desc')), coop_btn);
  modes.append(pvp, coop);
  panel.append(modes);

  const join = el('div', 'mp-row');
  const code = el('input', 'mp-input');
  code.placeholder = tr('code_placeholder');
  code.maxLength = 8;
  code.autocomplete = 'off';
  code.setAttribute('aria-label', tr('code_placeholder'));
  const go = () => attempt(async () => {
    set_match(await matches.join(code.value.trim(), G.SETTINGS.GAMESPEED ?? 1));
  });
  code.onkeydown = (e) => { if (e.key === 'Enter') void go(); };
  join.append(code, button(tr('join'), 'mp-btn--blue', () => void go()));
  panel.append(join);
  return panel;
}

function playing_panel(m: MatchView): HTMLElement {
  const panel = el('div', 'mp-panel');
  panel.append(el('h2', undefined, tr('title')), el('p', undefined, tr('in_progress')));
  const names = m.players.map((p) => p.name ?? '?').join(' vs ');
  panel.append(el('p', 'mp-dim', `${tr(m.mode === 'pvp' ? 'pvp' : 'coop')}: ${names}`));
  const row = el('div', 'mp-buttons');
  row.append(
    button(tr('give_up'), 'mp-btn--red', () => {
      if (!confirm(tr('give_up_confirm'))) return;
      void attempt(async () => { await matches.leave(m.id); await refresh(); });
    }),
    button(tr('rejoin'), 'mp-btn--blue', () => open_match_run(m)),
  );
  panel.append(row);
  return panel;
}

function lobby_panel(m: MatchView): HTMLElement {
  const panel = el('div', 'mp-panel');
  panel.append(el('h2', undefined, `${tr(m.mode === 'pvp' ? 'pvp' : 'coop')} · ${tr('lobby')}`));
  const code_row = el('div', 'mp-row');
  const copy = button(tr('copy_link'), 'mp-btn--grey', () => {
    const url = `${location.origin}${location.pathname}?match=${m.code}`;
    navigator.clipboard?.writeText(url).then(() => { copy.textContent = tr('copied'); }, () => {});
  });
  code_row.append(el('label', undefined, tr('invite_code')), el('span', 'mp-code', m.code), copy);
  panel.append(code_row);

  panel.append(el('h3', undefined, tr('players')));
  const list = el('ul', 'mp-players');
  for (const p of m.players) {
    const li = el('li');
    li.append(el('span', undefined, p.name ?? '?'));
    if (p.you) li.append(el('span', 'mp-tag', tr('you')));
    if (p.host) li.append(el('span', 'mp-tag mp-tag--host', tr('host')));
    list.append(li);
  }
  if (m.players.length < 2) list.append(el('li', 'mp-dim', tr('waiting_player')));
  panel.append(list);

  // the settings: the host changes them, the other player sees them
  const s = m.settings;
  const change = (patch: Partial<typeof s>) => attempt(async () => {
    set_match(await matches.settings(m.id, { ...s, ...patch }));
  });
  const select = (label: string, options: [string, string][], value: string, on: (v: string) => void) => {
    const row = el('div', 'mp-row');
    const sel = el('select', 'mp-select');
    sel.setAttribute('aria-label', label);
    for (const [v, text] of options) {
      const o = el('option', undefined, text);
      o.value = v;
      sel.append(o);
    }
    sel.value = value;
    sel.disabled = !m.host;
    sel.onchange = () => on(sel.value);
    row.append(el('label', undefined, label), sel);
    return row;
  };
  panel.append(
    select(tr('deck'), decks().map((d) => [d.key, d.name]), s.deck, (v) => void change({ deck: v })),
    select(tr('stake'), stakes().map((st) => [String(st.level), st.name]), String(s.stake), (v) => void change({ stake: Number(v) })),
    select(tr('timer'), TIMERS.map((t) => [String(t), tr('seconds', { n: t })]), String(s.timer), (v) => void change({ timer: Number(v) })),
  );
  const seed_row = el('div', 'mp-row');
  const seed = el('input', 'mp-input');
  seed.value = s.seed ?? '';
  seed.placeholder = tr('seed_random');
  seed.maxLength = 8;
  seed.disabled = !m.host;
  seed.setAttribute('aria-label', tr('seed'));
  seed.onchange = () => {
    const v = seed.value.trim().toUpperCase();
    void change({ seed: /^[A-Z0-9]{1,8}$/.test(v) ? v : null });
  };
  seed_row.append(el('label', undefined, tr('seed')), seed);
  panel.append(seed_row);
  panel.append(el('p', 'mp-rules', tr('pvp_rules', RULES)));

  status_el = el('p', 'mp-status');
  panel.append(status_el);
  if (!m.host) set_status(tr('waiting_host'));
  const row = el('div', 'mp-buttons');
  row.append(button(tr('leave'), 'mp-btn--grey', () => attempt(async () => {
    await matches.leave(m.id);
    set_match(null);
  })));
  if (m.host) {
    const start = button(tr('start'), 'mp-btn--green', () => attempt(async () => {
      set_match(await matches.start(m.id));
    }));
    start.disabled = m.players.length < 2;
    row.append(start);
  }
  panel.append(row);
  return panel;
}

function render(m: MatchView | null) {
  if (!root) return;
  const was = shown;
  const key = !m || m.status === 'finished' ? 'menu' : `${m.id}:${m.status}:${m.version}`;
  if (key === was) return;
  // (not under the player's typing, for a change of the same screen)
  const focused = document.activeElement;
  if (m && was?.startsWith(`${m.id}:${m.status}:`) && focused instanceof HTMLInputElement && root.contains(focused)) return;
  shown = key;
  const error = status_el?.classList.contains('mp-status--error') ? status_el.textContent ?? '' : '';
  status_el = null;
  const panel = !m || m.status === 'finished' ? menu_panel() : m.status === 'lobby' ? lobby_panel(m) : playing_panel(m);
  const buttons = panel.querySelector('.mp-buttons') ?? panel.appendChild(el('div', 'mp-buttons'));
  buttons.prepend(button(tr('close'), 'mp-btn--grey', () => close_lobby()));
  if (!status_el) {
    status_el = el('p', 'mp-status');
    panel.insertBefore(status_el, buttons);
  }
  if (error) set_status(error, true);
  root.replaceChildren(panel);
}

export function open_lobby() {
  add_style();
  close_lobby();
  shown = null;
  root = el('div', 'mp-root');
  root.setAttribute('role', 'dialog');
  root.setAttribute('aria-label', tr('title'));
  root.onclick = (e) => { if (e.target === root) close_lobby(); };
  root.onkeydown = (e) => { if (e.key === 'Escape') close_lobby(); };
  document.body.append(root);
  input_state.blocked = true;
  off = on_match((m) => render(m));
  render(mp.match);
  void refresh();
}

export function close_lobby() {
  off?.();
  off = null;
  root?.remove();
  root = null;
  status_el = null;
  input_state.blocked = false;
}
