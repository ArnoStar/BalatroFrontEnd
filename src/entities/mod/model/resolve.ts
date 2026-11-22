// The packages of a run's mods (by hash): the player's library has the mods
// they installed; others (a friend's run being watched, another device's
// file) come from the API, which keeps every run's packages.
import { mods as mods_api, type ModPackage, type ModRefView } from '@/shared/api';
import { enabled_mods, package_by_hash } from './library';
import { use_mods, type ModSet } from './apply';

const fetched = new Map<string, Promise<ModPackage>>();

export async function packages_of(refs: ModRefView[]): Promise<ModSet[]> {
  return Promise.all(refs.map(async (r) => {
    const local = await package_by_hash(r.hash);
    if (local) return { hash: r.hash, pkg: local };
    let p = fetched.get(r.hash);
    if (!p) { p = mods_api.package(r.hash); fetched.set(r.hash, p); p.catch(() => fetched.delete(r.hash)); }
    return { hash: r.hash, pkg: await p };
  }));
}

/** the run's mods in the game's tables (before its cards are made) */
export async function use_run_mods(refs: ModRefView[] | undefined) {
  await use_mods(refs?.length ? await packages_of(refs) : []);
}

/** the enabled mods in the game's tables (the menus: the collection, the run setup) */
export async function use_enabled_mods() {
  await use_mods((await enabled_mods()).map((m) => ({ hash: m.hash, pkg: m.package })));
}
