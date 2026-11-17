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

// ------------------------------------------------------------------ friends, invites, the inbox, live events
export interface PlayerRef { id: string; name: string | null; avatar: number | null }
export interface FriendView {
  id: string; name: string | null; avatar: number | null;
  presence: { online: boolean; activity: Activity | null; last_seen: string | null } | null;
}
export interface FriendRequestView { id: string; sender: PlayerRef; recipient: PlayerRef; status: string; created_at: string }
export interface InviteView {
  id: string; sender: PlayerRef; recipient: PlayerRef; mode: string; code: string;
  status: 'pending' | 'accepted' | 'declined'; created_at: string; expires_at: string;
}
export interface ChatMessageView { id: string; conversation: string; seq: number; sender: PlayerRef | null; kind: string; text: string; created_at: string }
export interface ConversationView {
  id: string; kind: 'direct' | 'group'; title: string | null; members: PlayerRef[]; last_seq: number;
  last_message: ChatMessageView | null; unread: number; muted: boolean;
}
export interface InboxView { requests: FriendRequestView[]; conversations: ConversationView[]; invites: InviteView[]; count: number }
export interface SocialEvent { type: string; data: any }

/** a request to the social service as the signed-in player (null: nobody is signed in) */
async function call(method: string, path: string, body?: unknown, signal?: AbortSignal): Promise<Response | null> {
  const send = (token: string) => fetch(`${social_base()}${path}`, {
    method, signal, cache: 'no-store',
    headers: { authorization: `Bearer ${token}`, ...(body !== undefined ? { 'content-type': 'application/json' } : {}) },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const token = await access_token();
  if (!token) return null;
  let res = await send(token);
  if (res.status === 401) {
    const fresh = await refresh_session(token);
    if (fresh) res = await send(fresh.access_token);
  }
  return res;
}

async function json<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await call(method, path, body);
  if (!res) throw new Error('not signed in');
  const data = res.status === 204 ? null : await res.json().catch(() => null);
  if (!res.ok) throw new Error((data as any)?.detail ?? `the social service answered ${res.status}`);
  return data as T;
}

export const social_api = {
  signed_in: async () => !!(await access_token()),
  friends: () => json<FriendView[]>('GET', '/v1/friends'),
  inbox: () => json<InboxView>('GET', '/v1/inbox'),
  /** invite a friend to the player's match waiting for players */
  invite: (to: string) => json<InviteView>('POST', '/v1/invites', { to }),
  answer_invite: (id: string, accept: boolean) => json<InviteView>('POST', `/v1/invites/${id}/${accept ? 'accept' : 'decline'}`),
  answer_request: (id: string, accept: boolean) => json<FriendRequestView>('POST', `/v1/friends/requests/${id}/${accept ? 'accept' : 'decline'}`),

  /**
   * The player's live events (server-sent events, read with fetch: an EventSource can't send the token), until
   * the stream ends (its token expired, it fell behind, the connection broke: open it again). False when nobody is
   * signed in.
   */
  async events(on_event: (e: SocialEvent) => void, signal: AbortSignal): Promise<boolean> {
    const res = await call('GET', '/v1/events', undefined, signal);
    if (!res) return false;
    if (!res.ok || !res.body) throw new Error(`the event stream answered ${res.status}`);
    const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
    let buffer = '';
    for (;;) {
      const { value, done } = await reader.read();
      if (done) return true;
      buffer += value;
      let end: number;
      while ((end = buffer.indexOf('\n\n')) >= 0) {
        const block = buffer.slice(0, end);
        buffer = buffer.slice(end + 2);
        let type = '', data = '';
        for (const line of block.split('\n')) {
          if (line.startsWith('event:')) type = line.slice(6).trim();
          else if (line.startsWith('data:')) data += line.slice(5).trim();
        }
        if (type && data) {
          try { on_event({ type, data: JSON.parse(data) }); } catch (err) { console.error('[social]', err); }
        }
      }
    }
  },
};
