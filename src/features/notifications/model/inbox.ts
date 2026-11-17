// What waits for the player (the social service's inbox): friend requests to
// answer, unread conversations, invites to a friend's match. Loaded when the
// event stream opens and kept up to date by its events; each new thing is also
// handed to `on_new` (the pop-ups).
import { social_api, type ConversationView, type FriendRequestView, type InboxView, type InviteView, type SocialEvent } from '@/shared/api';

export type NewThing =
  | { kind: 'request'; request: FriendRequestView }
  | { kind: 'message'; conversation: ConversationView; text: string; from: string }
  | { kind: 'invite'; invite: InviteView };

export const inbox = {
  me: null as string | null,
  requests: [] as FriendRequestView[],
  conversations: [] as ConversationView[],
  invites: [] as InviteView[],
  live: false,
};

const listeners = new Set<() => void>();
const news = new Set<(n: NewThing) => void>();

export function on_inbox(l: () => void) { listeners.add(l); return () => listeners.delete(l); }
export function on_new(l: (n: NewThing) => void) { news.add(l); return () => news.delete(l); }

function changed() { for (const l of [...listeners]) l(); }
function tell(n: NewThing) { for (const l of [...news]) l(n); }

export function count(): number {
  const now = Date.now();
  return inbox.requests.length + inbox.conversations.filter((c) => c.unread > 0 && !c.muted).length
    + inbox.invites.filter((i) => Date.parse(i.expires_at) > now).length;
}

function set(box: InboxView) {
  inbox.requests = box.requests;
  inbox.conversations = box.conversations;
  inbox.invites = box.invites;
  changed();
}

export async function reload() {
  try { set(await social_api.inbox()); } catch (err) { console.warn('[notifications] the inbox could not be read', err); }
}

/** an answer given here (the event comes too: either removes it) */
export function forget(kind: 'request' | 'invite' | 'conversation', id: string) {
  if (kind === 'request') inbox.requests = inbox.requests.filter((r) => r.id !== id);
  else if (kind === 'invite') inbox.invites = inbox.invites.filter((i) => i.id !== id);
  else inbox.conversations = inbox.conversations.filter((c) => c.id !== id);
  changed();
}

function on_event(e: SocialEvent) {
  const me = inbox.me;
  switch (e.type) {
    case 'hello':
      inbox.me = e.data.id;
      inbox.live = true;
      void reload();
      return;
    case 'friend_request': {
      const r = e.data as FriendRequestView;
      const had = inbox.requests.some((x) => x.id === r.id);
      inbox.requests = inbox.requests.filter((x) => x.id !== r.id);
      if (r.status === 'pending' && r.recipient.id === me) {
        inbox.requests = [r, ...inbox.requests];
        if (!had) tell({ kind: 'request', request: r });
      }
      break;
    }
    case 'invite': {
      const i = e.data as InviteView;
      const had = inbox.invites.find((x) => x.id === i.id);
      inbox.invites = inbox.invites.filter((x) => x.id !== i.id);
      if (i.status === 'pending' && i.recipient.id === me) {
        inbox.invites = [i, ...inbox.invites];
        if (!had || had.expires_at !== i.expires_at) tell({ kind: 'invite', invite: i });
      }
      break;
    }
    case 'message': {
      const m = e.data;
      if (!m.sender || m.sender.id === me) return;
      const c = inbox.conversations.find((x) => x.id === m.conversation);
      if (c?.muted) return;
      const conv: ConversationView = c
        ? { ...c, unread: c.unread + 1, last_message: m, last_seq: m.seq }
        : { id: m.conversation, kind: 'direct', title: null, members: [m.sender], last_seq: m.seq, last_message: m, unread: 1, muted: false };
      inbox.conversations = [conv, ...inbox.conversations.filter((x) => x.id !== m.conversation)];
      const text = m.kind === 'run' || m.kind === 'seed' ? `(${m.kind})` : m.text;
      tell({ kind: 'message', conversation: conv, text, from: m.sender.name ?? '?' });
      break;
    }
    case 'read':
      if (e.data.player === me) {
        inbox.conversations = inbox.conversations.filter((c) => c.id !== e.data.conversation || e.data.seq < c.last_seq);
      }
      break;
    case 'conversation':
      if ((e.data as ConversationView).muted) inbox.conversations = inbox.conversations.filter((c) => c.id !== e.data.id);
      break;
    case 'conversation_left':
      inbox.conversations = inbox.conversations.filter((c) => c.id !== e.data.id);
      break;
    default:
      return;
  }
  changed();
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
let started = false;

/** the event stream, while a player is signed in (opened again whenever it ends) */
export function start_inbox() {
  if (started) return;
  started = true;
  const abort = new AbortController();
  void (async () => {
    let delay = 0;
    for (;;) {
      try {
        const signed_in = await social_api.events(on_event, abort.signal);
        if (!signed_in) return; // (nobody to notify)
        delay = 0;
      } catch (err) {
        console.warn('[notifications] the event stream broke', err);
        delay = Math.min(60_000, delay ? delay * 2 : 2_000);
      }
      inbox.live = false;
      changed();
      await wait(delay);
    }
  })();
}
