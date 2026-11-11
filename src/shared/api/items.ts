// The item service (BalatroItemService), at /items/ on the site: the player's
// collectible items (the game's jokers and tags with an edition). They change
// nothing in a run: the game shows them (the title screen, new finds).
import { ApiError } from './client';
import { access_token, refresh_session } from './session';
import type { ProblemDetails } from './types';

export type ItemEdition = 'base' | 'foil' | 'holographic' | 'polychrome' | 'negative';

export interface PlayerItem {
  id: string;
  kind: 'joker' | 'tag';
  key: string;
  name: string;
  edition: ItemEdition;
  rarity: 1 | 2 | 3 | 4;
  /** the stake of the win it came from (1 White ... 8 Gold): the game's stake sticker */
  stake: number | null;
  serial: number;
  minted: number;
  odds: number;
  source: string;
}

export interface ItemsMe { id: string; can_trade: boolean; items: number; showcase: PlayerItem | null }

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
  /** the items the player's runs have earned since they last looked (each once) */
  find: () => call<{ found: PlayerItem[] }>('POST', '/v1/me/drops'),
};
