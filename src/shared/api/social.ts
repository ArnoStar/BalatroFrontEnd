// The social service (BalatroSocial), at /social/ on the site: friends and chat
// (the portal shows them). The game only tells it what the player is doing, so
// that their friends see it: in the menu, or in a run (its deck, stake, ante).
import { access_token, refresh_session } from './session';

export interface Activity {
  kind: 'menu' | 'run' | 'watching';
  deck?: string;
  stake?: number;
  ante?: number;
  seeded?: boolean;
  challenge?: string | null;
}

/** the social service's base URL: VITE_SOCIAL_URL, or /social on this origin */
export function social_base(): string {
  const env = (import.meta as any).env?.VITE_SOCIAL_URL as string | undefined;
  return (env || '/social').replace(/\/$/, '');
}

export const social = {
  /** the game's heartbeat; false when nobody is signed in (nothing is sent) */
  async presence(activity: Activity): Promise<boolean> {
    const send = (token: string) => fetch(`${social_base()}/v1/me/presence`, {
      method: 'PUT', headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: JSON.stringify({ activity }), keepalive: true,
    });
    const token = await access_token();
    if (!token) return false;
    let res = await send(token);
    if (res.status === 401) {
      const fresh = await refresh_session(token);
      if (fresh) res = await send(fresh.access_token);
    }
    if (!res.ok && res.status !== 204) throw new Error(`the social service answered ${res.status}`);
    return true;
  },
};
