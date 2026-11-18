// The player's items (BalatroItemService) in the game: the one they show on
// the title screen (their showcase, in place of the Ace), and the coins their
// runs have just earned, told on the title screen. Items change nothing in a
// run; the shop, the market, trading and the collection are on the site (the
// portal's /shop, /market, /inventory).
import { G } from '@/shared/lib/engine';
import { items, type EarnedCoins, type PlayerItem } from '@/shared/api';

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
 * On the title screen: earns the coins the player's runs have earned (the
 * service gives each grant once), then the showcase. `earned`: the new grants
 * and the balance; `showcase`: the item to show now, if it changed.
 */
export async function look_for_items(on: {
  earned(earned: EarnedCoins[], balance: number): void; showcase(item: PlayerItem | null): void;
}) {
  if (passing_through()) return;
  const before = cached_showcase();
  try {
    const { earned, balance } = await items.earn();
    if (earned.length) on.earned(earned, balance);
  } catch (err) {
    // (no item service here, or signed out: the game goes on without items)
    console.warn('[items]', (err as Error)?.message ?? err);
  }
  try {
    const me = await items.me();
    keep_showcase(me.showcase);
    const same = (a: PlayerItem | null, b: PlayerItem | null) => (a?.id ?? null) === (b?.id ?? null) && a?.edition === b?.edition
      && a?.kind === b?.kind;
    if (!same(before, me.showcase)) on.showcase(me.showcase);
  } catch (err) {
    console.warn('[items]', (err as Error)?.message ?? err);
  }
}

/** the item's center: a joker's or a consumable's, a playing card's enhancement (or the blank card); null for a
 *  key this game doesn't have (or an item of before, a tag) */
export function item_center(item: PlayerItem): any {
  if (item.kind === 'card') return G.P_CARDS[item.key] ? G.P_CENTERS[item.enhancement ?? 'c_base'] ?? null : null;
  return ['joker', 'tarot', 'planet', 'spectral'].includes(item.kind) ? G.P_CENTERS[item.key] ?? null : null;
}
