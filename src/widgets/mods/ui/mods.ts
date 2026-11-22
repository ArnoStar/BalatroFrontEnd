// The MODS menu (not in the game; drawn as the game's own menus): the player's
// installed mods, each on or off (new runs are played with those on), their
// contents with the cards they add, import from a file (button or drop),
// export to a file, publishing, and the community's mods (the API's registry):
// search, sort, install, update.
import { G, UIBox, DynaText } from '@/shared/lib/engine';
import { create_UIBox_generic_options, create_option_cycle, create_text_input, UIBox_button } from '@/shared/ui';
import { ApiError, mods as mods_api, type ModPackage, type ModSummaryView } from '@/shared/api';
import { Card, CardArea } from '@/entities/card';
import {
  installed, installed_mod, remove_mod, save_mod, set_enabled, use_enabled_mods, use_mods, full_key, enabled_mods,
  type InstalledMod,
} from '@/entities/mod';
import { tr, loc_of } from './text';

const PAGE = 5;
const SORTS = ['popular', 'new', 'updated', 'name'] as const;

interface State {
  open: boolean;
  tab: 'installed' | 'browse' | 'info';
  back_to: 'installed' | 'browse';
  page: number;
  list: InstalledMod[];
  browse: ModSummaryView[];
  total: number;
  browse_page: number;
  loading: boolean;
  offline: boolean;
  form: { q: string; status: string; status2: string };
  sort: (typeof SORTS)[number];
  info: { pkg: ModPackage; hash: string; summary?: ModSummaryView; installed?: InstalledMod } | null;
  confirm: string | null;
}

const st: State = {
  open: false, tab: 'installed', back_to: 'installed', page: 0, list: [], browse: [], total: 0, browse_page: 0, loading: false, offline: false,
  form: { q: '', status: '', status2: '' }, sort: 'popular', info: null, confirm: null,
};

// ------------------------------------------------------------------ helpers
function wrap(text: string, n: number): string[] {
  const out: string[] = [];
  for (const para of text.split('\n')) {
    let line = '';
    for (const w of para.split(/\s+/)) {
      if (!w) continue;
      if (line && (line + ' ' + w).length > n) { out.push(line); line = w; } else line = line ? line + ' ' + w : w;
    }
    out.push(line);
  }
  return out;
}

function lines(text: string, n: number, scale: number, colour = G.C.UI.TEXT_LIGHT) {
  return wrap(text, n).map((l) => ({ n: G.UIT.R, config: { align: 'cm' }, nodes: [{ n: G.UIT.T, config: { text: l, scale, colour, shadow: true } }] }));
}

function text(t: string, scale: number, colour = G.C.UI.TEXT_LIGHT, maxw?: number) {
  return { n: G.UIT.T, config: { text: t, scale, colour, shadow: true, maxw } };
}

function title(t: string) {
  return { n: G.UIT.R, config: { align: 'cm', padding: 0.05 }, nodes: [
    { n: G.UIT.O, config: { object: new DynaText({ string: [t], colours: [G.C.UI.TEXT_LIGHT], shadow: true, float: true, bump: true, scale: 0.8, pop_in: 0, silent: true }) } },
  ] };
}

function button(label: string, fn: string, colour: any, minw = 1.6, ref?: any, scale = 0.32) {
  return UIBox_button({ button: fn, ref_table: ref, label: [label], minw, minh: 0.5, scale, colour, col: true });
}

function say(status: string, status2 = '') {
  st.form.status = wrap(status, 80)[0] ?? '';
  st.form.status2 = wrap(status2, 80)[0] ?? '';
}

function status_rows() {
  return [
    { n: G.UIT.R, config: { align: 'cm', minh: 0.35 }, nodes: [{ n: G.UIT.T, config: { ref_table: st.form, ref_value: 'status', scale: 0.3, colour: G.C.FILTER, shadow: true } }] },
    { n: G.UIT.R, config: { align: 'cm', minh: 0.3 }, nodes: [{ n: G.UIT.T, config: { ref_table: st.form, ref_value: 'status2', scale: 0.26, colour: G.C.UI.TEXT_INACTIVE, shadow: true } }] },
  ];
}

function contents_line(summary: Record<string, any>): string {
  const parts: string[] = [];
  for (const k of ['jokers', 'consumables', 'vouchers', 'decks', 'blinds'] as const) if (summary[k]) parts.push(tr(k, { n: summary[k] }));
  if (summary.rules) parts.push(tr('rules'));
  if (summary.creative) parts.push(tr('creative'));
  return parts.join(' - ');
}

function summary_of(pkg: ModPackage): Record<string, any> {
  return {
    jokers: pkg.jokers?.length ?? 0, consumables: pkg.consumables?.length ?? 0, vouchers: pkg.vouchers?.length ?? 0,
    decks: pkg.decks?.length ?? 0, blinds: pkg.blinds?.length ?? 0, rules: !!pkg.rules && Object.keys(pkg.rules).length > 0,
    creative: !!pkg.creative,
  };
}

const newer = (a: string, b: string) => {
  const p = (v: string) => v.split('.').map(Number);
  const [x, y] = [p(a), p(b)];
  for (let i = 0; i < 3; i++) if ((x[i] ?? 0) !== (y[i] ?? 0)) return (x[i] ?? 0) > (y[i] ?? 0);
  return false;
};

function why(err: unknown): string {
  if (err instanceof ApiError) return err.problem?.detail ?? err.message;
  return String((err as Error)?.message ?? err);
}

// ------------------------------------------------------------------ the screens
function tab_row() {
  const tab = (label: string, key: 'installed' | 'browse') => UIBox_button({
    button: 'mods_tab', ref_table: { tab: key }, label: [label], minw: 2.8, minh: 0.6, scale: 0.4, col: true,
    colour: st.tab === key || (st.tab === 'info' && st.back_to === key) ? G.C.RED : G.C.GREY,
  });
  return { n: G.UIT.R, config: { align: 'cm', padding: 0.08 }, nodes: [tab(tr('installed'), 'installed'), { n: G.UIT.C, config: { minw: 0.2 }, nodes: [] }, tab(tr('browse'), 'browse')] };
}

function pager(page: number, total: number, fn: string) {
  const pages = Math.max(1, Math.ceil(total / PAGE));
  if (pages <= 1) return { n: G.UIT.R, config: { minh: 0.1 }, nodes: [] };
  return { n: G.UIT.R, config: { align: 'cm', padding: 0.05 }, nodes: [
    button('<', fn, page > 0 ? G.C.RED : G.C.UI.BACKGROUND_INACTIVE, 0.8, { d: -1 }),
    { n: G.UIT.C, config: { align: 'cm', minw: 2 }, nodes: [text(tr('page', { n: page + 1, of: pages }), 0.32)] },
    button('>', fn, page < pages - 1 ? G.C.RED : G.C.UI.BACKGROUND_INACTIVE, 0.8, { d: 1 }),
  ] };
}

function installed_row(m: InstalledMod) {
  const l = loc_of({ name: m.package.name, description: m.package.description, loc: m.package.loc });
  const tag = m.official ? tr('official') : m.source === 'file' ? tr('file') : '';
  return { n: G.UIT.R, config: { align: 'cm', r: 0.1, padding: 0.08, colour: G.C.L_BLACK, emboss: 0.05, minw: 13 }, nodes: [
    UIBox_button({ button: 'mods_toggle', ref_table: { id: m.id }, label: [m.enabled ? tr('on') : tr('off')], minw: 1.1, minh: 0.55, scale: 0.36, colour: m.enabled ? G.C.GREEN : G.C.UI.BACKGROUND_INACTIVE, col: true }),
    { n: G.UIT.C, config: { align: 'cl', padding: 0.05, minw: 6.2, maxw: 6.2 }, nodes: [
      { n: G.UIT.R, config: { align: 'cl' }, nodes: [text(l.name, 0.4, G.C.UI.TEXT_LIGHT, 4.6), text('  ' + tr('version', { v: m.version }), 0.28, G.C.UI.TEXT_INACTIVE)] },
      { n: G.UIT.R, config: { align: 'cl' }, nodes: [text(contents_line(summary_of(m.package)) + (tag ? '  (' + tag + ')' : ''), 0.26, G.C.UI.TEXT_INACTIVE, 6)] },
    ] },
    button(tr('info'), 'mods_info', G.C.BLUE, 1.3, { id: m.id }),
    button(tr('export'), 'mods_export', G.C.GREY, 1.4, { id: m.id }),
    st.confirm === m.id
      ? button(tr('remove') + '?', 'mods_remove', G.C.RED, 1.5, { id: m.id })
      : button('X', 'mods_ask_remove', G.C.RED, 0.6, { id: m.id }),
  ] };
}

function installed_contents() {
  const rows = st.list.slice(st.page * PAGE, st.page * PAGE + PAGE).map(installed_row);
  return [
    title(tr('title')),
    tab_row(),
    { n: G.UIT.R, config: { align: 'tm', padding: 0.08, minh: 4.4, minw: 13.4 }, nodes: rows.length ? rows : lines(tr('none_installed'), 60, 0.34, G.C.UI.TEXT_INACTIVE) },
    pager(st.page, st.list.length, 'mods_page'),
    { n: G.UIT.R, config: { align: 'cm', padding: 0.1 }, nodes: [
      button(tr('import'), 'mods_import', G.C.BLUE, 3, undefined, 0.38),
      { n: G.UIT.C, config: { align: 'cm', padding: 0.1 }, nodes: [text(tr('import_hint'), 0.26, G.C.UI.TEXT_INACTIVE)] },
    ] },
    ...lines(tr('enabled_note'), 90, 0.25, G.C.UI.TEXT_INACTIVE),
    ...status_rows(),
  ];
}

function text_field(args: Record<string, unknown>) {
  return { n: G.UIT.O, config: { object: new UIBox({
    definition: { n: G.UIT.ROOT, config: { align: 'cm', colour: G.C.CLEAR }, nodes: [create_text_input(args)] },
    config: { offset: { x: 0, y: 0 } },
  }) } };
}

function browse_row(m: ModSummaryView) {
  const l = loc_of(m);
  const mine = st.list.find((x) => x.id === m.id);
  const action = !mine ? button(tr('install'), 'mods_install', G.C.GREEN, 1.8, { id: m.id })
    : newer(m.version, mine.version) ? button(tr('update'), 'mods_install', G.C.ORANGE, 1.8, { id: m.id })
      : { n: G.UIT.C, config: { align: 'cm', minw: 1.8 }, nodes: [text(tr('installed_tag'), 0.3, G.C.GREEN)] };
  const who = m.official ? tr('official') : m.yours ? tr('yours') : (m.author ? tr('by', { author: m.author }) : '');
  return { n: G.UIT.R, config: { align: 'cm', r: 0.1, padding: 0.08, colour: G.C.L_BLACK, emboss: 0.05, minw: 13 }, nodes: [
    { n: G.UIT.C, config: { align: 'cl', padding: 0.04, minw: 8.4, maxw: 8.4 }, nodes: [
      { n: G.UIT.R, config: { align: 'cl' }, nodes: [text(l.name, 0.4, G.C.UI.TEXT_LIGHT, 4.4), text(`  ${tr('version', { v: m.version })}  ${who} - ${tr('installs', { n: m.installs })}`, 0.26, G.C.UI.TEXT_INACTIVE)] },
      { n: G.UIT.R, config: { align: 'cl' }, nodes: [text(wrap(l.description, 95)[0] ?? '', 0.26, G.C.UI.TEXT_LIGHT, 8.3)] },
      { n: G.UIT.R, config: { align: 'cl' }, nodes: [text(contents_line(m.summary), 0.24, G.C.FILTER, 8.3)] },
    ] },
    button(tr('info'), 'mods_browse_info', G.C.BLUE, 1.3, { id: m.id }),
    action,
  ] };
}

function browse_contents() {
  const rows = st.loading ? lines(tr('loading'), 60, 0.36, G.C.UI.TEXT_INACTIVE)
    : st.offline ? lines(tr('offline'), 60, 0.36, G.C.RED)
      : st.browse.length ? st.browse.map(browse_row) : lines(tr('nothing_found'), 60, 0.36, G.C.UI.TEXT_INACTIVE);
  return [
    title(tr('title')),
    tab_row(),
    { n: G.UIT.R, config: { align: 'cm', padding: 0.08 }, nodes: [
      text_field({ w: 4.5, max_length: 30, prompt_text: tr('search_prompt'), ref_table: st.form, ref_value: 'q', keyboard_offset: 1, callback: () => G.FUNCS.mods_search() }),
      button(tr('search'), 'mods_search', G.C.BLUE, 1.6, undefined, 0.34),
      { n: G.UIT.C, config: { minw: 0.3 }, nodes: [] },
      create_option_cycle({ scale: 0.6, w: 2.6, options: SORTS.map((s) => tr(`sort_${s}` as any)), current_option: SORTS.indexOf(st.sort) + 1, opt_callback: 'mods_sort', colour: G.C.RED }),
    ] },
    { n: G.UIT.R, config: { align: 'tm', padding: 0.08, minh: 5, minw: 13.4 }, nodes: rows },
    pager(st.browse_page, st.total, 'mods_browse_page'),
    ...status_rows(),
  ];
}

/** a row of the mod's cards (the menus have its items in the game's tables while this shows) */
function card_row(keys: string[]) {
  const size = 0.7;
  const area = new CardArea(0, 0, Math.min(10, Math.max(3, keys.length)) * size * G.CARD_W, size * G.CARD_H,
    { card_limit: Math.max(keys.length, 1), card_w: size * G.CARD_W, type: 'title_2', highlight_limit: 0 });
  for (const k of keys.slice(0, 10)) {
    if (!G.P_CENTERS[k]) continue;
    const card: any = new Card(0, 0, G.CARD_W * size, G.CARD_H * size, null, G.P_CENTERS[k], { bypass_discovery_center: true, bypass_discovery_ui: true, bypass_lock: true });
    area.emplace(card);
  }
  return { n: G.UIT.R, config: { align: 'cm', padding: 0.05, r: 0.1, colour: G.C.UI.TRANSPARENT_DARK }, nodes: [{ n: G.UIT.O, config: { object: area } }] };
}

function info_contents() {
  const info = st.info!;
  const pkg = info.pkg;
  const l = loc_of({ name: pkg.name, description: pkg.description, loc: pkg.loc });
  const id = pkg.id;
  const cards = [
    ...(pkg.jokers ?? []).map((j) => full_key(id, 'jokers', j.key)),
    ...(pkg.consumables ?? []).map((c) => full_key(id, 'consumables', c.key)),
    ...(pkg.vouchers ?? []).map((v) => full_key(id, 'vouchers', v.key)),
  ];
  const name_of = (set: string, key: string) => G.localization.descriptions[set]?.[key]?.name ?? key;
  const extra: string[] = [];
  if (pkg.decks?.length) extra.push(tr('decks_list', { list: pkg.decks.map((d) => name_of('Back', full_key(id, 'decks', d.key))).join(', ') }));
  if (pkg.blinds?.length) extra.push(tr('blinds_list', { list: pkg.blinds.map((b) => name_of('Blind', full_key(id, 'blinds', b.key))).join(', ') }));
  if (pkg.rules && Object.keys(pkg.rules).length) extra.push(tr('rules_list', { list: Object.entries(pkg.rules).map(([k, v]) => `${k} ${Number(v) > 0 ? '+' : ''}${v}`).join(', ') }));
  if (pkg.creative) extra.push(tr('creative_desc'));
  const mine = info.installed;
  const who = info.summary?.official || mine?.official ? tr('official') : (pkg.author ? tr('by', { author: pkg.author }) : '');
  const actions: any[] = [button(tr('back'), 'mods_info_back', G.C.GREY, 1.8, undefined, 0.36)];
  if (mine) {
    actions.push(button(mine.enabled ? tr('disable') : tr('enable'), 'mods_toggle', mine.enabled ? G.C.RED : G.C.GREEN, 2.2, { id: mine.id, stay: true }, 0.36));
    actions.push(button(tr('export'), 'mods_export', G.C.BLUE, 1.8, { id: mine.id }, 0.36));
    if (mine.source === 'file') actions.push(button(tr('publish'), 'mods_publish', G.C.PURPLE, 2, { id: mine.id }, 0.36));
  } else if (info.summary) {
    actions.push(button(tr('install'), 'mods_install', G.C.GREEN, 2, { id: info.summary.id }, 0.36));
  }
  return [
    title(l.name),
    { n: G.UIT.R, config: { align: 'cm' }, nodes: [text(`${tr('version', { v: pkg.version })}  ${who}`, 0.3, G.C.UI.TEXT_INACTIVE)] },
    { n: G.UIT.R, config: { align: 'cm', padding: 0.1, r: 0.1, colour: G.C.BLACK, emboss: 0.05, minw: 13 }, nodes: [
      { n: G.UIT.C, config: { align: 'cm', padding: 0.05 }, nodes: [
        ...lines(l.description, 90, 0.3),
        { n: G.UIT.R, config: { align: 'cm', minh: 0.15 }, nodes: [] },
        { n: G.UIT.R, config: { align: 'cm' }, nodes: [text(contents_line(summary_of(pkg)), 0.3, G.C.FILTER)] },
        ...(cards.length ? [card_row(cards.slice(0, 10))] : []),
        ...(cards.length > 10 ? [card_row(cards.slice(10, 20))] : []),
        ...extra.flatMap((e) => lines(e, 95, 0.28, G.C.UI.TEXT_LIGHT)),
      ] },
    ] },
    { n: G.UIT.R, config: { align: 'cm', padding: 0.1 }, nodes: actions },
    ...status_rows(),
  ];
}

function render() {
  if (!st.open) return;
  const contents = st.tab === 'info' && st.info ? info_contents() : st.tab === 'browse' ? browse_contents() : installed_contents();
  G.FUNCS.overlay_menu({ definition: create_UIBox_generic_options({ back_func: 'mods_close', contents, minw: 14 }) });
}

// ------------------------------------------------------------------ doing
async function refresh_installed() {
  st.list = await installed();
  st.page = Math.min(st.page, Math.max(0, Math.ceil(st.list.length / PAGE) - 1));
}

async function load_browse() {
  st.loading = true;
  render();
  try {
    const r = await mods_api.list({ q: st.form.q.trim() || undefined, sort: st.sort, limit: PAGE, offset: st.browse_page * PAGE });
    st.browse = r.items;
    st.total = r.total;
    st.offline = false;
  } catch (err) {
    console.warn('[mods] the registry is out of reach', err);
    st.offline = true;
  }
  st.loading = false;
  render();
}

/** the menus show the enabled mods' items (the collection, the run setup's decks) */
async function after_change() {
  await refresh_installed();
  await use_enabled_mods().catch((err) => console.warn('[mods]', err));
}

async function import_package(raw: string, source = 'file') {
  let pkg: any;
  try { pkg = JSON.parse(raw); } catch { say(tr('not_json')); render(); return; }
  try {
    const check = await mods_api.validate(pkg);
    if (!check.valid || !check.hash) {
      say(tr('invalid'), check.errors.slice(0, 2).join('  |  '));
      console.warn('[mods] invalid mod:', check.errors);
      render();
      return;
    }
    const old = await installed_mod(pkg.id);
    await save_mod({
      id: pkg.id, version: pkg.version, hash: check.hash, name: pkg.name, enabled: old?.enabled ?? true,
      source: source as 'file', installed_at: old?.installed_at ?? Date.now(), package: pkg,
    });
    say(tr('imported', { name: pkg.name, v: pkg.version }));
    await after_change();
  } catch (err) {
    say(tr('failed', { why: why(err) }));
  }
  render();
}

async function install(id: string) {
  const summary = st.browse.find((m) => m.id === id) ?? st.info?.summary;
  say(tr('installing', { name: summary?.name ?? id }));
  render();
  try {
    const [pkg, detail] = await Promise.all([mods_api.download(id), mods_api.get(id)]);
    const old = await installed_mod(id);
    await save_mod({
      id, version: pkg.version, hash: detail.hash, name: pkg.name, enabled: old?.enabled ?? true, source: 'registry',
      official: detail.official, installed_at: old?.installed_at ?? Date.now(), package: pkg,
    });
    void mods_api.install(id).catch(() => undefined);
    say(tr('imported', { name: pkg.name, v: pkg.version }));
    await after_change();
    if (st.tab === 'info' && st.info) st.info.installed = await installed_mod(id);
  } catch (err) {
    say(tr('failed', { why: why(err) }));
  }
  render();
}

function download_file(pkg: ModPackage) {
  const blob = new Blob([JSON.stringify(pkg, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${pkg.id}-${pkg.version}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

async function show_info(pkg: ModPackage, hash: string, summary?: ModSummaryView) {
  st.back_to = st.tab === 'info' ? st.back_to : (st.tab as 'installed' | 'browse');
  const mine = await installed_mod(pkg.id);
  st.info = { pkg, hash, summary, installed: mine };
  // (its cards in the game's tables while the info shows: with the enabled mods, and this one)
  const enabled = (await enabled_mods()).filter((m) => m.id !== pkg.id).map((m) => ({ hash: m.hash, pkg: m.package }));
  await use_mods([...enabled, { hash, pkg }]).catch((err) => console.warn('[mods]', err));
  st.tab = 'info';
  render();
}

function on_drop(ev: DragEvent) {
  if (!st.open) return;
  ev.preventDefault();
  const file = ev.dataTransfer?.files?.[0];
  if (file) void file.text().then((t) => import_package(t));
}
function on_drag_over(ev: DragEvent) { if (st.open) ev.preventDefault(); }

export function open_mods_menu() {
  st.open = true;
  st.tab = 'installed';
  st.confirm = null;
  say('');
  window.addEventListener('drop', on_drop);
  window.addEventListener('dragover', on_drag_over);
  void refresh_installed().then(render);
  render();
}

/** a message from elsewhere about mods (a run that didn't start because of one) */
function notice(rows: string[]) {
  if (G.OVERLAY_MENU) return;
  open_mods_menu();
  say(`${tr('run_failed')} ${rows[0] ?? ''}`, rows.slice(1).join('  |  '));
}

export function register_mods_funcs() {
  G.FUNCS.mods_menu = () => open_mods_menu();
  G.FUNCS.mods_notice = notice;
  G.FUNCS.mods_close = () => {
    st.open = false;
    window.removeEventListener('drop', on_drop);
    window.removeEventListener('dragover', on_drag_over);
    void use_enabled_mods().catch(() => undefined);
    G.FUNCS.exit_overlay_menu();
  };
  G.FUNCS.mods_tab = (e: any) => {
    st.tab = e.config.ref_table.tab;
    st.confirm = null;
    say('');
    if (st.tab === 'browse') void load_browse();
    else void use_enabled_mods().then(render);
    render();
  };
  G.FUNCS.mods_page = (e: any) => {
    const pages = Math.max(1, Math.ceil(st.list.length / PAGE));
    st.page = Math.max(0, Math.min(pages - 1, st.page + e.config.ref_table.d));
    render();
  };
  G.FUNCS.mods_browse_page = (e: any) => {
    const pages = Math.max(1, Math.ceil(st.total / PAGE));
    const next = Math.max(0, Math.min(pages - 1, st.browse_page + e.config.ref_table.d));
    if (next !== st.browse_page) { st.browse_page = next; void load_browse(); }
  };
  G.FUNCS.mods_toggle = async (e: any) => {
    const { id, stay } = e.config.ref_table;
    const m = await installed_mod(id);
    if (!m) return;
    await set_enabled(id, !m.enabled);
    await after_change();
    if (stay && st.info) { st.info.installed = await installed_mod(id); await show_info(st.info.pkg, st.info.hash, st.info.summary); return; }
    render();
  };
  G.FUNCS.mods_ask_remove = (e: any) => { st.confirm = e.config.ref_table.id; render(); };
  G.FUNCS.mods_remove = async (e: any) => {
    await remove_mod(e.config.ref_table.id);
    st.confirm = null;
    await after_change();
    render();
  };
  G.FUNCS.mods_export = async (e: any) => {
    const m = await installed_mod(e.config.ref_table.id);
    if (m) download_file(m.package);
  };
  G.FUNCS.mods_info = async (e: any) => {
    const m = await installed_mod(e.config.ref_table.id);
    if (m) await show_info(m.package, m.hash);
  };
  G.FUNCS.mods_browse_info = async (e: any) => {
    const id = e.config.ref_table.id;
    const summary = st.browse.find((m) => m.id === id);
    try {
      const pkg = await mods_api.download(id);
      await show_info(pkg, summary?.hash ?? id, summary);
    } catch (err) { say(tr('failed', { why: why(err) })); render(); }
  };
  G.FUNCS.mods_info_back = async () => {
    st.tab = st.back_to;
    st.info = null;
    await use_enabled_mods().catch(() => undefined);
    if (st.tab === 'browse') void load_browse();
    render();
  };
  G.FUNCS.mods_install = (e: any) => { void install(e.config.ref_table.id); };
  G.FUNCS.mods_search = () => { st.browse_page = 0; void load_browse(); };
  G.FUNCS.mods_sort = (args: any) => { st.sort = SORTS[args.to_key - 1] ?? 'popular'; st.browse_page = 0; void load_browse(); };
  G.FUNCS.mods_import = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,application/json';
    input.onchange = () => { const f = input.files?.[0]; if (f) void f.text().then((t) => import_package(t)); };
    input.click();
  };
  G.FUNCS.mods_publish = async (e: any) => {
    const m = await installed_mod(e.config.ref_table.id);
    if (!m) return;
    try {
      const detail = await mods_api.publish(m.package);
      await save_mod({ ...m, source: 'registry', hash: detail.hash });
      say(tr('published'));
      await refresh_installed();
      if (st.info) st.info.installed = await installed_mod(m.id);
    } catch (err) {
      say(err instanceof ApiError && err.status === 401 ? tr('sign_in_publish') : tr('failed', { why: why(err) }),
        ((err as ApiError)?.problem as any)?.errors?.slice(0, 2).join('  |  ') ?? '');
    }
    render();
  };
}

/** the main menu's MODS button label */
export function mods_label() { return tr('mods'); }

