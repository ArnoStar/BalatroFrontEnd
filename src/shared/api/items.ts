// The item service (BalatroItemService), at /items/ on the site: the player's
// collectible items (the game's cards with their upgrades) and the coins their
// runs earn. Items change nothing in a run: the game shows them (the title
// screen), and tells the coins earned.
import { ApiError } from './client';
import { access_token, refresh_session } from './session';
import type { ProblemDetails } from './types';

export type ItemEdition = 'base' | 'foil' | 'holographic' | 'polychrome' | 'negative';

export interface PlayerItem {
  id: string;
  kind: 'joker' | 'tarot' | 'planet' | 'spectral' | 'card';
  /** the game's key: a center's (j_joker, c_fool ...) or, for a playing card, its P_CARDS key (S_A ...) */
  key: string;
  name: string;
  edition: ItemEdition;
  /** a playing card's enhancement (m_glass ...) and seal (Gold, Red, Blue, Purple) */
  enhancement?: string | null;
  seal?: string | null;
  /** how well kept its card is: 0 (ruined) ... 1 (pristine) */
  condition?: number;
  rarity: 1 | 2 | 3 | 4;
  /** the stake of the win it came from (1 White ... 8 Gold): the game's stake sticker */
  stake: number | null;
  serial: number;
  minted: number;
  odds: number;
  source: string;
}

export interface ItemsMe { id: string; can_trade: boolean; items: number; coins: number; showcase: PlayerItem | null }

/** a grant the player's runs earned: weekly, weekly_win, first_deck_win, first_stake_win */
export interface EarnedCoins { source: string; reason: string; coins: number; run: string | null }

/** the item service's base URL: VITE_ITEMS_URL, or /items on this origin */
export function items_base(): string {
  const env = (import.meta as any).env?.VITE_ITEMS_URL as string | undefined;
  return (env || '/items').replace(/\/$/, '');
}

async function call<T>(method: string, path: string): Promise<T> {
  const send = (token: string | null) => fetch(`${items_base()}${path}`, {
    method, headers: token ? { authorization: `Bearer ${token}` } : {},
  });
  const token = await access_token();
  let res = await send(token);
  if (res.status === 401 && token) {
    const fresh = await refresh_session(token);
    if (fresh) res = await send(fresh.access_token);
  }
  const text = await res.text();
  let json: any = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }
  if (!res.ok) {
    const p = json && typeof json === 'object' && 'code' in json ? (json as ProblemDetails) : null;
    throw new ApiError(res.status, p, p?.detail ?? `the item service answered ${res.status}`);
  }
  return json as T;
}

export const items = {
  me: () => call<ItemsMe>('GET', '/v1/me'),
  /** the coins the player's runs have earned since they last looked (each grant once) */
  earn: () => call<{ earned: EarnedCoins[]; coins: number; balance: number }>('POST', '/v1/me/drops'),
};
