// The player's items (BalatroItemService) in the game: the one they show on
// the title screen (their showcase, in place of the Ace), and the ones their
// runs have just found, revealed on the title screen. Items change nothing in
// a run; trading and the collection are on the site (the portal's /inventory).
import { G } from '@/shared/lib/engine';
import { items, type PlayerItem } from '@/shared/api';

const KEY = 'balatro-fe.showcase';

/** the showcase as last seen (kept in the browser: the title screen doesn't wait for the service) */
export function cached_showcase(): PlayerItem | null {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? 'null');
    return v && typeof v === 'object' && typeof v.key === 'string' ? (v as PlayerItem) : null;
  } catch {
    return null;
  }
}

function keep_showcase(item: PlayerItem | null) {
  try {
    if (item) localStorage.setItem(KEY, JSON.stringify(item));
    else localStorage.removeItem(KEY);
  } catch { /* no storage */ }
}

/** watching a run or a bug report's replay: the title screen is only on the way */
function passing_through(): boolean {
  const q = new URLSearchParams(location.search);
  return q.has('watch') || q.has('report') || q.has('test');
}

/**
 * On the title screen: finds the items the player's runs have earned (the
 * service gives each once), then the showcase. `found`: new items to reveal;
 * `showcase`: the item to show now, if it changed.
 */
export async function look_for_items(on: { found(items: PlayerItem[]): void; showcase(item: PlayerItem | null): void }) {
  if (passing_through()) return;
  const before = cached_showcase();
  try {
    const { found } = await items.find();
    if (found.length) on.found(found);
  } catch (err) {
    // (no item service here, or signed out: the game goes on without items)
    console.warn('[items]', (err as Error)?.message ?? err);
  }
  try {
    const me = await items.me();
    keep_showcase(me.showcase);
    const same = (a: PlayerItem | null, b: PlayerItem | null) => (a?.id ?? null) === (b?.id ?? null) && a?.edition === b?.edition;
    if (!same(before, me.showcase)) on.showcase(me.showcase);
  } catch (err) {
    console.warn('[items]', (err as Error)?.message ?? err);
  }
}

/** the item's center (jokers), or null for a tag or a key this game doesn't have */
export function item_center(item: PlayerItem): any {
  return item.kind === 'joker' ? G.P_CENTERS[item.key] ?? null : null;
}
