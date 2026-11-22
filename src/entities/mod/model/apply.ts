// A content mod's items in the game's tables, as the engine adds them (keys
// j_<mod id>_<key>, c_, v_, b_, bl_): G.P_CENTERS and its pools, G.P_BLINDS,
// their texts in G.localization (in the game's language, from the package's
// `loc`), and their art (a package's images become atlases of one card).
// The tables hold one set of mods at a time: the run's on screen, the enabled
// ones in the menus (the collection, the run setup's decks).
import { G, HEX } from '@/shared/lib/engine';
import { loc_parse_string } from '@/shared/lib/localization';
import { love } from '@/shared/lib/love';
import { on_language_change } from '@/shared/config';
import type { ModPackage } from '@/shared/api';
import { static_vars } from './vars';

export interface ModSet { hash: string; pkg: ModPackage }

const PREFIX: Record<string, string> = { jokers: 'j', consumables: 'c', vouchers: 'v', decks: 'b', blinds: 'bl' };
export const full_key = (id: string, kind: string, key: string) => `${PREFIX[kind]}_${id}_${key}`;

const DEFAULT_ART: Record<string, string> = { Joker: 'j_joker', Tarot: 'c_fool', Planet: 'c_pluto', Spectral: 'c_aura', Voucher: 'v_blank', Back: 'b_red' };

let applied: ModSet[] = [];
let applied_sig = '';
const atlases = new Map<string, Promise<boolean>>();

/** the mods in the game's tables now */
export function active_mods(): ModSet[] { return applied; }

/** an item of a mod, by its game key (null: not a mod's) */
export function mod_item_of(center: any): any | null { return center?.mod_item ?? null; }

function atlas_name(hash: string, asset: string) { return `mod_${hash.slice(0, 12)}_${asset}`; }

/** one card's image (2x: 142x190, or 1x: 71x95) as an atlas of one cell */
function load_atlas(name: string, data_url: string): Promise<boolean> {
  let p = atlases.get(name);
  if (!p) {
    p = (async () => {
      try {
        const blob = await (await fetch(data_url)).blob();
        const bmp = await createImageBitmap(blob, { premultiplyAlpha: 'none', colorSpaceConversion: 'none' });
        const image = love.graphics.newImageFromSource(bmp, bmp.width, bmp.height, { mipmaps: true, dpiscale: bmp.width / 71 });
        bmp.close();
        G.ASSET_ATLAS[name] = { name, image, px: 71, py: 95 };
        return true;
      } catch (err) {
        console.warn('[mods] an image of a mod did not load', name, err);
        return false;
      }
    })();
    atlases.set(name, p);
  }
  return p;
}

function language_text(item: any): { name: string; text: string[] } {
  const lang = String(G.SETTINGS?.language ?? 'en-us');
  const loc = item.loc ?? {};
  const t = loc[lang] ?? loc[lang.split(/[-_]/)[0]] ?? null;
  return { name: t?.name ?? item.name, text: t?.text ?? item.text ?? [] };
}

function set_text(set: string, key: string, name: string, text: string[]) {
  const descriptions = G.localization.descriptions;
  descriptions[set] = descriptions[set] ?? {};
  const parse = (lines: string[]) => lines.map((l) => loc_parse_string(l)).filter(Boolean);
  descriptions[set][key] = { name, text, text_parsed: parse(text), name_parsed: parse([name]) };
}

function sprite_of(m: ModSet, item: any, set: string, loaded: Set<string>): { atlas?: string; pos: { x: number; y: number } } {
  const s = item.sprite;
  if (typeof s === 'string' && set !== 'Back' && loaded.has(atlas_name(m.hash, s))) return { atlas: atlas_name(m.hash, s), pos: { x: 0, y: 0 } };
  if (s && typeof s === 'object' && 'atlas' in s && !(set === 'Back' && s.atlas !== 'centers')) {
    return { atlas: set === 'Back' ? undefined : s.atlas, pos: { x: s.x, y: s.y } };
  }
  const d = G.P_CENTERS[DEFAULT_ART[set]];
  return { pos: { ...(d?.pos ?? { x: 0, y: 0 }) } };
}

let order = 1000;

function add_center(c: any, pools: string[]) {
  c.order = ++order;
  c.proto_unlocked = true;
  c.proto_discovered = true;
  c.unlocked = true;
  c.discovered = true;
  c.alerted = true;
  G.P_CENTERS[c.key] = c;
  for (const p of pools) (G.P_CENTER_POOLS[p] = G.P_CENTER_POOLS[p] ?? []).push(c);
}

function inject(m: ModSet, loaded: Set<string>) {
  const pkg = m.pkg;
  const base = { mod: pkg.id, mod_hash: m.hash };
  for (const j of pkg.jokers ?? []) {
    const key = full_key(pkg.id, 'jokers', j.key);
    const c: any = {
      ...base, key, name: key, set: 'Joker', rarity: j.rarity ?? 1, cost: j.cost ?? 5, cost_mult: 1,
      config: { extra: { ...(j.config ?? {}) } }, blueprint_compat: j.blueprint_compat ?? true,
      eternal_compat: j.eternal_compat ?? true, perishable_compat: j.perishable_compat ?? true, mod_item: j,
      ...sprite_of(m, j, 'Joker', loaded),
    };
    add_center(c, j.in_shop === false ? [] : ['Joker']);
    if (j.in_shop !== false) G.P_JOKER_RARITY_POOLS[c.rarity - 1]?.push(c);
    const t = language_text(j);
    set_text('Joker', key, t.name, t.text);
  }
  for (const x of pkg.consumables ?? []) {
    const key = full_key(pkg.id, 'consumables', x.key);
    const config: any = { extra: { ...(x.config ?? {}) } };
    if (x.hand) config.hand_type = x.hand;
    if (x.targets) {
      config.min_highlighted = x.targets.min ?? 1;
      config.max_highlighted = x.targets.max ?? config.min_highlighted;
      config.mod_num = Math.min(5, config.max_highlighted);
    }
    const c: any = { ...base, key, name: key, set: x.set, consumeable: true, cost: x.cost ?? (x.set === 'Spectral' ? 4 : 3), cost_mult: 1, config, mod_item: x, ...sprite_of(m, x, x.set, loaded) };
    add_center(c, x.set === 'Spectral' ? ['Spectral', 'Consumeables'] : [x.set, 'Tarot_Planet', 'Consumeables']);
    const t = language_text(x);
    // (a Planet card that only names its hand says what the game's planets say)
    const text = t.text.length || x.set !== 'Planet' ? t.text : (G.localization.descriptions.Planet?.c_pluto?.text ?? []);
    set_text(x.set, key, t.name, text);
  }
  for (const v of pkg.vouchers ?? []) {
    const key = full_key(pkg.id, 'vouchers', v.key);
    const c: any = { ...base, key, name: key, set: 'Voucher', cost: v.cost ?? 10, cost_mult: 1, available: true, config: { extra: { ...(v.config ?? {}) } }, requires: v.requires, mod_item: v, ...sprite_of(m, v, 'Voucher', loaded) };
    add_center(c, ['Voucher']);
    const t = language_text(v);
    set_text('Voucher', key, t.name, t.text);
  }
  for (const d of pkg.decks ?? []) {
    const key = full_key(pkg.id, 'decks', d.key);
    const c: any = { ...base, key, name: key, set: 'Back', stake: 1, config: {}, mod_item: d, ...sprite_of(m, d, 'Back', loaded) };
    c.mod_vars = static_vars(d, {});
    add_center(c, ['Back']);
    const t = language_text(d);
    set_text('Back', key, t.name, t.text);
  }
  for (const b of pkg.blinds ?? []) {
    const key = full_key(pkg.id, 'blinds', b.key);
    const art = G.P_BLINDS[b.sprite?.blind ?? 'bl_hook'] ?? G.P_BLINDS.bl_hook;
    G.P_BLINDS[key] = {
      ...base, key, name: key, mult: b.mult ?? 2, dollars: b.dollars ?? 5, debuff: {}, defeated: false, mod_item: b,
      boss: { min: b.min_ante ?? 1, max: b.max_ante ?? 10, ...(b.showdown ? { showdown: true } : {}) },
      boss_colour: b.colour ? HEX(b.colour.slice(1)) : art.boss_colour, pos: { ...art.pos }, atlas: art.atlas,
      vars: static_vars(b, {}), order: ++order, discovered: true, proto_discovered: true, alerted: true,
    };
    const t = language_text(b);
    set_text('Blind', key, t.name, t.text);
  }
}

function clear() {
  for (const m of applied) {
    const id = m.pkg.id;
    for (const kind of ['jokers', 'consumables', 'vouchers', 'decks']) {
      for (const it of (m.pkg as any)[kind] ?? []) {
        const key = full_key(id, kind, it.key);
        const c = G.P_CENTERS[key];
        if (c) delete G.localization.descriptions[c.set]?.[key];
        delete G.P_CENTERS[key];
      }
    }
    for (const b of m.pkg.blinds ?? []) {
      const key = full_key(id, 'blinds', b.key);
      delete G.P_BLINDS[key];
      delete G.localization.descriptions.Blind?.[key];
    }
  }
  for (const k of Object.keys(G.P_CENTER_POOLS)) G.P_CENTER_POOLS[k] = G.P_CENTER_POOLS[k].filter((c: any) => !c?.mod);
  G.P_JOKER_RARITY_POOLS = G.P_JOKER_RARITY_POOLS.map((p: any[]) => p.filter((c) => !c?.mod));
  applied = [];
  applied_sig = '';
}

/** Put these mods' items in the game's tables (instead of the ones there). */
export async function use_mods(list: ModSet[]) {
  const sig = list.map((m) => m.hash).join(',');
  if (sig === applied_sig) return;
  const loaded = new Set<string>();
  await Promise.all(list.flatMap((m) => Object.entries(m.pkg.assets ?? {}).map(async ([name, url]) => {
    if (await load_atlas(atlas_name(m.hash, name), url)) loaded.add(atlas_name(m.hash, name));
  })));
  clear();
  for (const m of list) inject(m, loaded);
  applied = list;
  applied_sig = sig;
}

// the texts follow the game's language
on_language_change(() => {
  const list = applied;
  if (!list.length) return;
  const loaded = new Set([...atlases.keys()].filter((k) => G.ASSET_ATLAS[k]));
  clear();
  for (const m of list) inject(m, loaded);
  applied = list;
  applied_sig = list.map((m) => m.hash).join(',');
});
