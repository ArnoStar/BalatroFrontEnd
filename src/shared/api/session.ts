// The player's sign-in, shared with the portal (BalatroPortal): both are served
// from one origin (the portal at /, the game at /play/), so they read the same
// localStorage entry. The portal signs in and out; the game only refreshes the
// access token and sends the player to the portal when there is no session.
//
// The contract (keep it the same in BalatroPortal's src/shared/api/session.ts):
//   localStorage['balatro.session'] = { access_token, refresh_token, expires_at }
//   (expires_at: the access token's expiry, ms since the epoch). A refresh token
//   works once: refreshes are serialised across tabs with the Web Locks API
//   (lock 'balatro.session'), and whoever holds the lock re-reads the entry first.

const KEY = 'balatro.session';
const LOCK = 'balatro.session';
const EARLY_MS = 30_000; // refresh this long before the access token expires

export interface Session {
  access_token: string;
  refresh_token: string;
  expires_at: number;
}

function env(name: string): string | undefined {
  return (import.meta as any).env?.[name] as string | undefined;
}

/** the identity service's base URL: `?identity=...`, VITE_IDENTITY_URL, or /identity on this origin */
export function identity_base(): string {
  const q = new URLSearchParams(window.location.search).get('identity');
  return (q || env('VITE_IDENTITY_URL') || '/identity').replace(/\/$/, '');
}

/** the portal's base URL: VITE_PORTAL_URL, or this origin's root */
export function portal_base(): string {
  return (env('VITE_PORTAL_URL') ?? '').replace(/\/$/, '');
}

export function read_session(): Session | null {
  try {
    const s = JSON.parse(localStorage.getItem(KEY) ?? 'null');
    return s && typeof s.access_token === 'string' && typeof s.refresh_token === 'string' ? s : null;
  } catch {
    return null;
  }
}

function write_session(s: Session | null) {
  try {
    if (s) localStorage.setItem(KEY, JSON.stringify(s));
    else localStorage.removeItem(KEY);
  } catch { /* no storage */ }
}

function with_lock<T>(fn: () => Promise<T>): Promise<T> {
  const locks = (navigator as any).locks;
  return locks?.request ? locks.request(LOCK, fn) : fn();
}

/** A fresh session, or null when signed out. `failed` is an access token the
 * API refused: it is replaced even if it hasn't expired yet. Network errors
 * keep the session (and throw). */
export function refresh_session(failed?: string): Promise<Session | null> {
  return with_lock(async () => {
    const s = read_session();
    if (!s) return null;
    const stale = failed !== undefined ? s.access_token === failed : s.expires_at - Date.now() < EARLY_MS;
    if (!stale) return s; // (another tab refreshed it meanwhile)
    const res = await fetch(`${identity_base()}/auth/refresh`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ refresh_token: s.refresh_token }),
    });
    if (res.status === 400 || res.status === 401 || res.status === 422) {
      write_session(null);
      return null;
    }
    if (!res.ok) throw new Error(`the sign-in service answered ${res.status}`);
    const t = await res.json();
    const next: Session = { access_token: t.access_token, refresh_token: t.refresh_token, expires_at: Date.now() + t.expires_in * 1000 };
    write_session(next);
    return next;
  });
}

/** a valid access token, or null when signed out */
export async function access_token(): Promise<string | null> {
  const s = read_session();
  if (!s) return null;
  if (s.expires_at - Date.now() >= EARLY_MS) return s.access_token;
  return (await refresh_session())?.access_token ?? null;
}

/** the signed-in player's display name (the access token's `name` claim) */
export function display_name(): string | null {
  const s = read_session();
  if (!s) return null;
  try {
    const payload = s.access_token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    const json = new TextDecoder().decode(Uint8Array.from(atob(payload), (c) => c.charCodeAt(0)));
    const name = JSON.parse(json).name;
    return typeof name === 'string' ? name : null;
  } catch {
    return null;
  }
}

/** thrown by go_to_sign_in: the page is leaving, nothing went wrong */
export class SigningIn extends Error {
  constructor() {
    super('leaving for the sign-in page');
    this.name = 'SigningIn';
  }
}

/** to the portal's sign-in page, back here afterwards */
export function go_to_sign_in(): never {
  const next = window.location.pathname + window.location.search;
  window.location.assign(`${portal_base()}/login?next=${encodeURIComponent(next)}`);
  throw new SigningIn();
}

export function go_to_account() {
  window.location.assign(`${portal_base()}/account`);
}

/** the portal's home page (the player's runs, their account) */
export function go_to_portal() {
  window.location.assign(`${portal_base()}/`);
}

/** ends this session at the identity service, then back to the portal */
export async function sign_out() {
  const s = read_session();
  write_session(null);
  if (s) {
    try {
      await fetch(`${identity_base()}/auth/logout`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ refresh_token: s.refresh_token }),
      });
    } catch { /* signed out here anyway */ }
  }
  window.location.assign(`${portal_base()}/`);
}
