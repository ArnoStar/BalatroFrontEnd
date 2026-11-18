// The MULTIPLAYER menu, drawn as the game's own menus (an overlay like the run
// setup): pick a mode, make a match or join one with its invite code, then the
// lobby (the code, the players, friends to invite, the host's settings) until
// the host starts it. A started match opens the player's run.
import { G, DynaText, UIBox } from '@/shared/lib/engine';
import { localize } from '@/shared/lib/localization';
import { UIBox_button, create_UIBox_generic_options, create_option_cycle, create_text_input } from '@/shared/ui';
import { matches, social_api, type FriendView, type MatchView } from '@/shared/api';
import { mp, on_match, problem, refresh, set_match } from '../model/match';
import { tr } from './text';

const TIMERS = [60, 120, 180, 300];
const RULES = { hp: 50, ante: 4, loss: 10 };

/** what the menu's inputs and texts hold */
const form = { code: '', seed: '', status: '' };
let open = false;
let shown = '';
let off: (() => void) | null = null;

// the player's friends, to invite (signed-in players: the social service)
const friends: { list: FriendView[] | null; at: number; invited: Set<string>; loading: boolean } = {
  list: null, at: 0, invited: new Set(), loading: false,
};

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

/** a text cut into lines of at most `n` characters */
function wrap(text: string, n: number): string[] {
  const out: string[] = [];
  let line = '';
  for (const word of text.split(' ')) {
    if (line && (line + ' ' + word).length > n) { out.push(line); line = word; } else line = line ? line + ' ' + word : word;
  }
  if (line) out.push(line);
  return out;
}

function lines(text: string, n: number, scale: number, colour = G.C.UI.TEXT_LIGHT) {
  return wrap(text, n).map((l) => ({ n: G.UIT.R, config: { align: 'cm' }, nodes: [
    { n: G.UIT.T, config: { text: l, scale, colour, shadow: true } },
  ] }));
}

function title(text: string) {
  return { n: G.UIT.R, config: { align: 'cm', padding: 0.05 }, nodes: [
    { n: G.UIT.O, config: { object: new DynaText({ string: [text], colours: [G.C.UI.TEXT_LIGHT], shadow: true, float: true, bump: true, scale: 0.8, pop_in: 0, silent: true }) } },
  ] };
}

function status_row() {
  return { n: G.UIT.R, config: { align: 'cm', minh: 0.4 }, nodes: [
    { n: G.UIT.T, config: { ref_table: form, ref_value: 'status', scale: 0.32, colour: G.C.RED, shadow: true } },
  ] };
}

function say(text: string) {
  form.status = wrap(text, 70)[0] ?? '';
}

async function attempt(fn: () => Promise<unknown>) {
  say('');
  try {
    await fn();
  } catch (err) {
    say(tr('error', { msg: problem(err) }));
  }
}

/** a text field, in a box of its own as the game's screens have them (its draw layers would hide the rest of a menu) */
function text_field(args: Record<string, unknown>) {
  return { n: G.UIT.O, config: { object: new UIBox({
    definition: { n: G.UIT.ROOT, config: { align: 'cm', colour: G.C.CLEAR }, nodes: [create_text_input(args)] },
    config: { offset: { x: 0, y: 0 } },
  }) } };
}

function panel(colour: any, nodes: any[], minw: number) {
  return { n: G.UIT.C, config: { align: 'tm', r: 0.1, padding: 0.12, colour, emboss: 0.05, minw, minh: 4.2 }, nodes };
}

// ------------------------------------------------------------------ the screens
function menu_contents() {
  const pvp = panel(G.C.BLACK, [
    { n: G.UIT.R, config: { align: 'cm', padding: 0.05 }, nodes: [{ n: G.UIT.T, config: { text: tr('pvp'), scale: 0.7, colour: G.C.RED, shadow: true } }] },
    ...lines(tr('pvp_desc'), 34, 0.3),
    { n: G.UIT.R, config: { align: 'cm', minh: 0.15 }, nodes: [] },
    ...lines(tr('pvp_rules', RULES), 40, 0.25, G.C.UI.TEXT_INACTIVE),
    { n: G.UIT.R, config: { align: 'cm', padding: 0.1 }, nodes: [
      UIBox_button({ button: 'mp_create_pvp', label: [tr('create')], minw: 3, minh: 0.7, scale: 0.4, colour: G.C.RED }),
    ] },
  ], 5);
  const coop = panel(G.C.BLACK, [
    { n: G.UIT.R, config: { align: 'cm', padding: 0.05 }, nodes: [{ n: G.UIT.T, config: { text: tr('coop'), scale: 0.7, colour: G.C.BLUE, shadow: true } }] },
    ...lines(tr('coop_desc'), 30, 0.3),
    { n: G.UIT.R, config: { align: 'cm', minh: 0.15 }, nodes: [] },
    ...lines(tr('coop_rules'), 34, 0.25, G.C.UI.TEXT_INACTIVE),
    { n: G.UIT.R, config: { align: 'cm', padding: 0.1 }, nodes: [
      UIBox_button({ button: 'mp_create_coop', label: [tr('create')], minw: 3, minh: 0.7, scale: 0.4, colour: G.C.BLUE }),
    ] },
  ], 4.4);
  return [
    title(tr('title')),
    { n: G.UIT.R, config: { align: 'cm', padding: 0.1 }, nodes: [
      pvp, { n: G.UIT.C, config: { minw: 0.2 }, nodes: [] }, coop, { n: G.UIT.C, config: { minw: 0.2 }, nodes: [] }, friend_column(),
    ] },
    { n: G.UIT.R, config: { align: 'cm', padding: 0.1 }, nodes: [
      { n: G.UIT.C, config: { align: 'cm', padding: 0.05 }, nodes: [
        text_field({ w: 3.2, max_length: 8, all_caps: true, prompt_text: tr('code_placeholder'), ref_table: form, ref_value: 'code', keyboard_offset: 1 }),
      ] },
      UIBox_button({ button: 'mp_join', label: [tr('join')], minw: 2, minh: 0.7, scale: 0.4, colour: G.C.BLUE, col: true }),
    ] },
    status_row(),
  ];
}

function playing_contents(m: MatchView) {
  const names = m.players.map((p) => p.name ?? '?').join('  vs  ');
  return [
    title(tr('title')),
    ...lines(tr('in_progress'), 50, 0.45),
    ...lines(`${tr(m.mode === 'pvp' ? 'pvp' : 'coop')}: ${names}`, 50, 0.35, G.C.UI.TEXT_INACTIVE),
    { n: G.UIT.R, config: { align: 'cm', padding: 0.15 }, nodes: [
      UIBox_button({ button: 'mp_give_up', label: [tr('give_up')], minw: 3, minh: 0.7, scale: 0.4, colour: G.C.RED, col: true }),
      { n: G.UIT.C, config: { minw: 0.3 }, nodes: [] },
      UIBox_button({ button: 'multiplayer_rejoin', label: [tr('rejoin')], minw: 3.6, minh: 0.7, scale: 0.4, colour: G.C.BLUE, col: true }),
    ] },
    status_row(),
  ];
}

function player_row(name: string, tags: { text: string; colour: any }[]) {
  return { n: G.UIT.R, config: { align: 'cl', r: 0.1, padding: 0.08, colour: G.C.L_BLACK, minw: 5.4, emboss: 0.05 }, nodes: [
    { n: G.UIT.C, config: { align: 'cl', minw: 3, maxw: 3 }, nodes: [{ n: G.UIT.T, config: { text: name, scale: 0.38, colour: G.C.UI.TEXT_LIGHT, shadow: true } }] },
    ...tags.map((t) => ({ n: G.UIT.C, config: { align: 'cm', r: 0.08, padding: 0.05, colour: t.colour }, nodes: [
      { n: G.UIT.T, config: { text: t.text, scale: 0.28, colour: G.C.UI.TEXT_LIGHT } },
    ] })),
  ] };
}

function load_friends(m: MatchView | null) {
  if (friends.loading || Date.now() - friends.at < 15_000) return;
  friends.loading = true;
  void social_api.signed_in().then(async (yes) => {
    friends.list = yes ? await social_api.friends() : [];
  }).catch(() => { friends.list = []; }).finally(() => {
    friends.at = Date.now();
    friends.loading = false;
    if (open && (mp.match?.id ?? null) === (m?.id ?? null)) render(mp.match, true);
  });
}

/** the menu's friends: invite one, and a PvP or coop match is made for the two of you */
function friend_column() {
  load_friends(null);
  const online = (f: FriendView) => (f.presence?.online ? 0 : 1);
  const list = [...(friends.list ?? [])].sort((a, b) => online(a) - online(b)).slice(0, 6);
  return panel(G.C.BLACK, [
    { n: G.UIT.R, config: { align: 'cm', padding: 0.05 }, nodes: [{ n: G.UIT.T, config: { text: tr('play_with_friend'), scale: 0.4, colour: G.C.GOLD, shadow: true } }] },
    ...(list.length ? list.map((f) => ({ n: G.UIT.R, config: { align: 'cm', padding: 0.03 }, nodes: [
      { n: G.UIT.C, config: { align: 'cm', r: 0.05, minw: 0.18, minh: 0.18, colour: f.presence?.online ? G.C.GREEN : G.C.UI.BACKGROUND_INACTIVE }, nodes: [] },
      { n: G.UIT.C, config: { align: 'cl', minw: 1.5, maxw: 1.5, padding: 0.05 }, nodes: [{ n: G.UIT.T, config: { text: f.name ?? '?', scale: 0.3, colour: G.C.UI.TEXT_LIGHT } }] },
      UIBox_button({ button: 'mp_invite_new', ref_table: f, label: [tr('pvp')], minw: 0.95, minh: 0.42, scale: 0.28, colour: G.C.RED, col: true }),
      { n: G.UIT.C, config: { minw: 0.05 }, nodes: [] },
      UIBox_button({ button: 'mp_invite_new_coop', ref_table: f, label: [tr('coop')], minw: 0.95, minh: 0.42, scale: 0.28, colour: G.C.BLUE, col: true }),
    ] })) : lines(friends.list ? tr('no_friends') : tr('loading'), 24, 0.28, G.C.UI.TEXT_INACTIVE)),
  ], 4);
}

function invite_rows(m: MatchView): any[] {
  if (m.players.length >= 2) return [];
  load_friends(m);
  if (!friends.list?.length) return [];
  const online = (f: FriendView) => (f.presence?.online ? 0 : 1);
  return [
    { n: G.UIT.R, config: { align: 'cm', padding: 0.05 }, nodes: [{ n: G.UIT.T, config: { text: tr('invite_friends'), scale: 0.35, colour: G.C.UI.TEXT_LIGHT, shadow: true } }] },
    ...[...friends.list].sort((a, b) => online(a) - online(b)).slice(0, 5).map((f) => {
      const done = friends.invited.has(`${m.id}:${f.id}`);
      return { n: G.UIT.R, config: { align: 'cm', padding: 0.03 }, nodes: [
        { n: G.UIT.C, config: { align: 'cm', r: 0.05, minw: 0.18, minh: 0.18, colour: f.presence?.online ? G.C.GREEN : G.C.UI.BACKGROUND_INACTIVE }, nodes: [] },
        { n: G.UIT.C, config: { align: 'cl', minw: 2.8, maxw: 2.8, padding: 0.05 }, nodes: [{ n: G.UIT.T, config: { text: f.name ?? '?', scale: 0.33, colour: G.C.UI.TEXT_LIGHT } }] },
        UIBox_button({ button: done ? 'nil' : 'mp_invite', ref_table: f, label: [done ? tr('invited') : tr('invite')], minw: 2.2, minh: 0.45, scale: 0.3, colour: done ? G.C.UI.BACKGROUND_INACTIVE : G.C.BLUE, col: true }),
      ] };
    }),
  ];
}

function setting(label: string, value: string) {
  return { n: G.UIT.R, config: { align: 'cm', padding: 0.04 }, nodes: [
    { n: G.UIT.C, config: { align: 'cl', minw: 1.6 }, nodes: [{ n: G.UIT.T, config: { text: label, scale: 0.33, colour: G.C.UI.TEXT_LIGHT } }] },
    { n: G.UIT.C, config: { align: 'cm', minw: 3.2, r: 0.1, padding: 0.06, colour: G.C.L_BLACK }, nodes: [{ n: G.UIT.T, config: { text: value, scale: 0.33, colour: G.C.UI.TEXT_LIGHT } }] },
  ] };
}

function settings_rows(m: MatchView): any[] {
  const s = m.settings;
  const d = decks(), st = stakes();
  const deck_name = d.find((x) => x.key === s.deck)?.name ?? s.deck;
  const stake_name = st.find((x) => x.level === s.stake)?.name ?? String(s.stake);
  if (!m.host) {
    return [setting(tr('deck'), deck_name), setting(tr('stake'), stake_name),
      ...(m.mode === 'pvp' ? [setting(tr('timer'), tr('seconds', { n: s.timer }))] : []),
      setting(tr('seed'), s.seed ?? tr('seed_random'))];
  }
  form.seed = s.seed ?? '';
  return [
    create_option_cycle({ label: tr('deck'), scale: 0.7, w: 4.2, options: d.map((x) => x.name), current_option: Math.max(1, d.findIndex((x) => x.key === s.deck) + 1), opt_callback: 'mp_set_deck', colour: G.C.RED }),
    { n: G.UIT.R, config: { align: 'cm' }, nodes: [
      { n: G.UIT.C, config: { align: 'cm' }, nodes: [
        create_option_cycle({ label: tr('stake'), scale: 0.7, w: 3, options: st.map((x) => x.name), current_option: Math.max(1, st.findIndex((x) => x.level === s.stake) + 1), opt_callback: 'mp_set_stake', colour: G.C.RED }),
      ] },
      ...(m.mode !== 'pvp' ? [] : [{ n: G.UIT.C, config: { align: 'cm' }, nodes: [
        create_option_cycle({ label: tr('timer'), scale: 0.7, w: 1.8, options: TIMERS.map((t) => tr('seconds', { n: t })), current_option: Math.max(1, TIMERS.indexOf(s.timer) + 1), opt_callback: 'mp_set_timer', colour: G.C.RED }),
      ] }]),
    ] },
    { n: G.UIT.R, config: { align: 'cm', padding: 0.05 }, nodes: [
      { n: G.UIT.C, config: { align: 'cm', minw: 1.4 }, nodes: [{ n: G.UIT.T, config: { text: tr('seed'), scale: 0.33, colour: G.C.UI.TEXT_LIGHT } }] },
      { n: G.UIT.C, config: { align: 'cm' }, nodes: [
        text_field({ w: 2.6, max_length: 8, all_caps: true, prompt_text: tr('seed_random'), ref_table: form, ref_value: 'seed', keyboard_offset: 1 }),
      ] },
      UIBox_button({ button: 'mp_set_seed', label: [tr('set')], minw: 1.4, minh: 0.55, scale: 0.3, colour: G.C.BLUE, col: true }),
    ] },
  ];
}

function lobby_contents(m: MatchView) {
  const players: any[] = m.players.map((p) => player_row(p.name ?? '?', [
    ...(p.you ? [{ text: tr('you'), colour: G.C.BLUE }] : []),
    ...(p.host ? [{ text: tr('host'), colour: G.C.GOLD }] : []),
  ]));
  if (m.players.length < 2) players.push({ n: G.UIT.R, config: { align: 'cm', padding: 0.08 }, nodes: [{ n: G.UIT.T, config: { text: tr('waiting_player'), scale: 0.33, colour: G.C.UI.TEXT_INACTIVE } }] });
  const left = { n: G.UIT.C, config: { align: 'tm', padding: 0.1, r: 0.1, colour: G.C.BLACK, emboss: 0.05, minw: 6 }, nodes: [
    { n: G.UIT.R, config: { align: 'cm', padding: 0.05 }, nodes: [{ n: G.UIT.T, config: { text: tr('invite_code'), scale: 0.33, colour: G.C.UI.TEXT_LIGHT } }] },
    { n: G.UIT.R, config: { align: 'cm' }, nodes: [
      { n: G.UIT.O, config: { object: new DynaText({ string: [m.code], colours: [G.C.GOLD], shadow: true, float: true, scale: 0.9, pop_in: 0, silent: true, spacing: 1 }) } },
    ] },
    { n: G.UIT.R, config: { align: 'cm', padding: 0.08 }, nodes: [
      UIBox_button({ button: 'mp_copy_link', label: [tr('copy_link')], minw: 2.6, minh: 0.5, scale: 0.32, colour: G.C.GREY }),
    ] },
    { n: G.UIT.R, config: { align: 'cm', padding: 0.05 }, nodes: [{ n: G.UIT.T, config: { text: tr('players'), scale: 0.35, colour: G.C.UI.TEXT_LIGHT, shadow: true } }] },
    ...players,
    ...invite_rows(m),
  ] };
  const right = { n: G.UIT.C, config: { align: 'tm', padding: 0.1, r: 0.1, colour: G.C.BLACK, emboss: 0.05, minw: 6 }, nodes: [
    ...settings_rows(m),
    { n: G.UIT.R, config: { align: 'cm', minh: 0.15 }, nodes: [] },
    ...lines(m.mode === 'coop' ? tr('coop_rules') : tr('pvp_rules', RULES), 48, 0.24, G.C.UI.TEXT_INACTIVE),
  ] };
  return [
    title(`${tr(m.mode === 'pvp' ? 'pvp' : 'coop')} - ${tr('lobby')}`),
    { n: G.UIT.R, config: { align: 'cm', padding: 0.1 }, nodes: [left, { n: G.UIT.C, config: { minw: 0.2 }, nodes: [] }, right] },
    { n: G.UIT.R, config: { align: 'cm', padding: 0.1 }, nodes: [
      UIBox_button({ button: 'mp_leave', label: [tr('leave')], minw: 3, minh: 0.8, scale: 0.45, colour: G.C.RED, col: true }),
      { n: G.UIT.C, config: { minw: 0.3 }, nodes: [] },
      m.host
        ? UIBox_button({ button: m.players.length >= 2 ? 'mp_start' : 'nil', label: [tr('start')], minw: 4, minh: 0.8, scale: 0.5, colour: m.players.length >= 2 ? G.C.GREEN : G.C.UI.BACKGROUND_INACTIVE, col: true })
        : { n: G.UIT.C, config: { align: 'cm', minw: 4 }, nodes: [{ n: G.UIT.T, config: { text: tr('waiting_host'), scale: 0.35, colour: G.C.UI.TEXT_INACTIVE } }] },
    ] },
    status_row(),
  ];
}

// ------------------------------------------------------------------ showing it
function key_of(m: MatchView | null) {
  if (!m || m.status === 'finished') return `menu:${friends.at}`;
  return `${m.id}:${m.status}:${m.version}`;
}

function render(m: MatchView | null, force = false) {
  if (!open) return;
  const key = key_of(m);
  if (!force && key === shown) return;
  // (not under the player's typing, for a change of the same screen)
  const same_screen = shown.split(':').slice(0, 2).join(':') === key.split(':').slice(0, 2).join(':');
  if (!force && G.CONTROLLER.text_input_hook && same_screen) return;
  shown = key;
  const contents = !m || m.status === 'finished' ? menu_contents() : m.status === 'lobby' ? lobby_contents(m) : playing_contents(m);
  G.FUNCS.overlay_menu({ definition: create_UIBox_generic_options({ back_func: 'mp_close', contents, minw: 12 }) });
}

/** a started match: its run on screen */
export function open_match_run(m: MatchView) {
  if (!m.run_id) return;
  close_lobby();
  G.FUNCS.start_run(null, { open_id: m.run_id });
}

export function open_lobby() {
  open = true;
  shown = '';
  form.status = '';
  G.SETTINGS.paused = true;
  off?.();
  off = on_match((m) => render(m));
  render(mp.match, true);
  void refresh();
}

export function close_lobby() {
  if (!open) return;
  open = false;
  off?.();
  off = null;
  G.CONTROLLER.text_input_hook = null;
  if (G.OVERLAY_MENU) G.FUNCS.exit_overlay_menu();
}

/** join a match by its code (an invite) and show its lobby */
export async function join_match(code: string) {
  open_lobby();
  await attempt(async () => { set_match(await matches.join(code, G.SETTINGS.GAMESPEED ?? 1)); });
}

export function register_lobby_funcs() {
  const F = G.FUNCS;
  F.mp_close = () => close_lobby();
  F.mp_create_pvp = () => attempt(async () => { set_match(await matches.create({ mode: 'pvp', game_speed: G.SETTINGS.GAMESPEED ?? 1 })); });
  F.mp_create_coop = () => attempt(async () => { set_match(await matches.create({ mode: 'coop', game_speed: G.SETTINGS.GAMESPEED ?? 1 })); });
  F.mp_join = () => {
    G.CONTROLLER.text_input_hook = null;
    const code = form.code.trim();
    if (code.length < 4) { say(tr('code_placeholder')); return; }
    void join_match(code);
  };
  const change = (patch: Record<string, unknown>) => {
    const m = mp.match;
    if (!m) return;
    void attempt(async () => { set_match(await matches.settings(m.id, { ...m.settings, ...patch } as typeof m.settings)); });
  };
  F.mp_set_deck = (args: any) => change({ deck: decks()[args.to_key - 1]?.key });
  F.mp_set_stake = (args: any) => change({ stake: stakes()[args.to_key - 1]?.level });
  F.mp_set_timer = (args: any) => change({ timer: TIMERS[args.to_key - 1] });
  F.mp_set_seed = () => {
    G.CONTROLLER.text_input_hook = null;
    const v = form.seed.trim().toUpperCase();
    change({ seed: /^[A-Z0-9]{1,8}$/.test(v) ? v : null });
  };
  F.mp_copy_link = () => {
    const m = mp.match;
    if (!m) return;
    void navigator.clipboard?.writeText(`${location.origin}${location.pathname}?match=${m.code}`).then(() => say(tr('copied')), () => undefined);
  };
  F.mp_invite = (e: any) => {
    const f = e.config.ref_table as FriendView;
    const m = mp.match;
    if (!m) return;
    void attempt(async () => {
      await social_api.invite(f.id);
      friends.invited.add(`${m.id}:${f.id}`);
      render(mp.match, true);
    });
  };
  const invite_new = (mode: 'pvp' | 'coop') => (e: any) => {
    const f = e.config.ref_table as FriendView;
    void attempt(async () => {
      const m = await matches.create({ mode, game_speed: G.SETTINGS.GAMESPEED ?? 1 });
      await social_api.invite(f.id);
      friends.invited.add(`${m.id}:${f.id}`);
      set_match(m);
    });
  };
  F.mp_invite_new = invite_new('pvp');
  F.mp_invite_new_coop = invite_new('coop');
  F.mp_leave = () => {
    const m = mp.match;
    if (!m) return;
    void attempt(async () => { await matches.leave(m.id); set_match(null); });
  };
  F.mp_start = () => {
    const m = mp.match;
    if (!m) return;
    void attempt(async () => { set_match(await matches.start(m.id)); });
  };
  F.mp_give_up = () => {
    const m = mp.match;
    if (!m) return;
    void attempt(async () => { await matches.leave(m.id); await refresh(); });
  };
}
