// The player's installed mods, kept in the browser (IndexedDB: packages can be
// large, with their images): each one's package, where it came from and
// whether it is on. The enabled mods are those a new run is started with.
import type { ModChoice, ModPackage } from '@/shared/api';

export interface InstalledMod {
  id: string;
  version: string;
  /** the package's content hash, as the API computes it (POST /mods/validate, the registry) */
  hash: string;
  name: string;
  enabled: boolean;
  /** registry: installed from the API's registry (it has the package); file: imported from a file */
  source: 'registry' | 'file';
  official?: boolean;
  installed_at: number;
  package: ModPackage;
}

const DB = 'balatro-fe.mods';
const STORE = 'installed';
let db: Promise<IDBDatabase> | null = null;
let memory: Map<string, InstalledMod> | null = null; // (no IndexedDB: kept for the page's life)

function open(): Promise<IDBDatabase> {
  db = db ?? new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: 'id' });
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return db;
}

async function tx<T>(mode: IDBTransactionMode, f: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const d = await open();
  return new Promise((resolve, reject) => {
    const r = f(d.transaction(STORE, mode).objectStore(STORE));
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}

function fallback(): Map<string, InstalledMod> {
  memory = memory ?? new Map();
  return memory;
}

const listeners = new Set<() => void>();
/** called whenever the library changes */
export function on_library_change(f: () => void) { listeners.add(f); return () => listeners.delete(f); }
const changed = () => { for (const f of listeners) f(); };

export async function installed(): Promise<InstalledMod[]> {
  let all: InstalledMod[];
  try { all = await tx('readonly', (s) => s.getAll() as IDBRequest<InstalledMod[]>); } catch { all = [...fallback().values()]; }
  return all.sort((a, b) => a.installed_at - b.installed_at);
}

export async function installed_mod(id: string): Promise<InstalledMod | undefined> {
  try { return await tx('readonly', (s) => s.get(id) as IDBRequest<InstalledMod | undefined>); } catch { return fallback().get(id); }
}

export async function save_mod(m: InstalledMod) {
  try { await tx('readwrite', (s) => s.put(m)); } catch { fallback().set(m.id, m); }
  changed();
}

export async function remove_mod(id: string) {
  try { await tx('readwrite', (s) => s.delete(id)); } catch { fallback().delete(id); }
  changed();
}

export async function set_enabled(id: string, enabled: boolean) {
  const m = await installed_mod(id);
  if (!m) return;
  m.enabled = enabled;
  await save_mod(m);
}

export async function enabled_mods(): Promise<InstalledMod[]> {
  return (await installed()).filter((m) => m.enabled);
}

/** what a new run asks the API for: the registry's mods by hash (the API has them), imported files whole */
export async function enabled_choices(): Promise<ModChoice[]> {
  return (await enabled_mods()).map((m) => (m.source === 'registry' ? { hash: m.hash } : { package: m.package }));
}

/** a package the library has, by its hash */
export async function package_by_hash(hash: string): Promise<ModPackage | undefined> {
  return (await installed()).find((m) => m.hash === hash)?.package;
}
