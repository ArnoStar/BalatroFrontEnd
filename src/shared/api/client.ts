// HTTP client for BalatroWebAPI. With sign-in on, every request carries the
// player's access token (session.ts); a refused token is refreshed once, and a
// player without a session goes to the portal's sign-in page.
import { access_token, go_to_sign_in, refresh_session } from './session';
import { recorder } from '@/shared/lib/recorder';
import type {
  ActionResult, BlindChoice, CoopDecksView, CoopStepsView, EmoteName, GameSummaryView, MatchHistoryView, MultiplayerStats, GameView, HandPreview, HistoryView, MatchSettingsView, MatchView, MeView, NewGameRequest,
  NewMatchRequest, PlayerAction, ProblemDetails, WatchView,
  CreativeRequest, ModCheck, ModDetailView, ModListView, ModPackage, ModSummaryView,
} from './types';

export class ApiError extends Error {
  status: number;
  problem: ProblemDetails | null;
  constructor(status: number, problem: ProblemDetails | null, message: string) {
    super(message);
    this.status = status;
    this.problem = problem;
  }
  get code() { return this.problem?.code ?? 'error'; }
}

/** the API's base URL: `?api=...` in the page URL, VITE_API_URL, or the dev proxy */
export function api_base(): string {
  const q = new URLSearchParams(window.location.search).get('api');
  if (q) return q.replace(/\/$/, '');
  const env = (import.meta as any).env?.VITE_API_URL as string | undefined;
  return (env ?? '').replace(/\/$/, '');
}

/** a request id the API logs with the request (and sends back): bug reports name it */
function new_request_id() {
  return `fe-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function send(method: string, path: string, body: unknown, token: string | null, request_id: string): Promise<Response> {
  const headers: Record<string, string> = { 'x-request-id': request_id };
  if (body !== undefined) headers['content-type'] = 'application/json';
  if (token) headers.authorization = `Bearer ${token}`;
  return fetch(`${api_base()}/api/v1${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

/** a body as the recorder keeps it: an action's pointer as its size (it is long, and only for watching) */
function recorded(body: unknown): unknown {
  if (body && typeof body === 'object' && 'pointer' in body) {
    const { pointer, ...rest } = body as { pointer?: { e?: unknown[] } };
    return { ...rest, pointer: `${pointer?.e?.length ?? 0} entries` };
  }
  return body ?? null;
}

/** false once the API refused an action's pointer (an API from before it kept them): sent without it */
let pointer_accepted = true;

/**
 * With the API's sign-in off everyone is one player. To try multiplayer alone, `?player=<name>` names
 * this tab's player (kept for the tab): the API takes the token `dev:<name>` only when sign-in is off.
 */
function dev_token(): string | null {
  try {
    const q = new URLSearchParams(window.location.search).get('player');
    if (q && /^[A-Za-z0-9_-]{1,24}$/.test(q)) sessionStorage.setItem('balatro-fe.player', q);
    const name = sessionStorage.getItem('balatro-fe.player');
    return name ? `dev:${name}` : null;
  } catch {
    return null;
  }
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const token = (await access_token()) ?? dev_token();
  const rid = new_request_id();
  const started = performance.now();
  let res: Response;
  try {
    res = await send(method, path, body, token, rid);
    if (res.status === 401) {
      // expired or revoked meanwhile: one refresh, then sign in again
      const fresh = token ? await refresh_session(token) : null;
      if (!fresh) go_to_sign_in();
      res = await send(method, path, body, fresh.access_token, rid);
      if (res.status === 401) go_to_sign_in();
    }
  } catch (err) {
    recorder.api(method, path, recorded(body), 0, performance.now() - started, rid, { network_error: String(err) });
    throw err;
  }
  const text = res.status === 204 ? '' : await res.text();
  let json: unknown = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = { not_json: text.slice(0, 500) };
  }
  recorder.api(method, path, recorded(body), res.status, performance.now() - started, res.headers.get('x-request-id') ?? rid, json);
  if (res.status === 204) return undefined as T;
  if (!res.ok) {
    const p = json && typeof json === 'object' && 'code' in json ? (json as ProblemDetails) : null;
    throw new ApiError(res.status, p, p?.detail ?? `${method} ${path}: ${res.status}`);
  }
  return json as T;
}

export const api = {
  health: () => request<{ status: string; api_version: string; engine_version: string; game_version: string; auth?: 'required' | 'off' }>('GET', '/health'),
  newGame: (req: NewGameRequest) => request<GameView>('POST', '/games', req),
  listGames: (limit = 50, offset = 0) => request<GameSummaryView[]>('GET', `/games?limit=${limit}&offset=${offset}`),
  getGame: (id: string) => request<GameView>('GET', `/games/${id}`),
  deleteGame: (id: string) => request<void>('DELETE', `/games/${id}`),
  /** `pointer`: the player's pointer since the previous action (shared/lib/pointer-trace), kept for watching the run */
  act: async (id: string, action: PlayerAction, expected_version?: number, pointer?: { v: 1; e: (number | string)[][] } | null) => {
    const body = { ...action, expected_version: expected_version ?? null };
    if (pointer && pointer_accepted) {
      try {
        return await request<ActionResult>('POST', `/games/${id}/actions`, { ...body, pointer });
      } catch (err) {
        // (the API doesn't know the field: the action goes again without it, and so do the next ones)
        if (!(err instanceof ApiError && err.status === 422 && JSON.stringify(err.problem ?? {}).includes('pointer'))) throw err;
        pointer_accepted = false;
      }
    }
    return request<ActionResult>('POST', `/games/${id}/actions`, body);
  },
  preview: (id: string, cards: number[]) => request<HandPreview>('POST', `/games/${id}/preview`, { cards }),
  debug: (id: string, command: Record<string, unknown>, expected_version?: number) =>
    request<ActionResult>('POST', `/games/${id}/debug`, { command, expected_version: expected_version ?? null }),
  history: (id: string) => request<HistoryView>('GET', `/games/${id}/history`),
  /** a run rebuilt from a history (admins, or servers with debug commands) */
  importGame: (history: Pick<HistoryView, 'settings' | 'commands' | 'start_profile' | 'mod_packages'>) => request<GameView>('POST', '/games/import', history),
  /** creative mode: change a run played with a creative mod */
  creative: (id: string, change: CreativeRequest, expected_version?: number) =>
    request<ActionResult>('POST', `/games/${id}/creative`, { ...change, expected_version: expected_version ?? null }),
  /** the player's settings and progress */
  me: () => request<MeView>('GET', '/players/me'),
  /** watch a run again: a copy at its start (or after its first `at` actions) and the player's actions */
  watch: (id: string, at = 0) => request<WatchView>('POST', `/games/${id}/watch${at > 0 ? `?at=${at}` : ''}`),
};

/** content mods: the registry (browse, publish, install), packages by hash */
export const mods = {
  list: (q: { q?: string; tag?: string; sort?: string; mine?: boolean; limit?: number; offset?: number } = {}) => {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries(q)) if (v !== undefined && v !== '' && v !== false) p.set(k, String(v));
    return request<ModListView>('GET', `/mods${p.size ? '?' + p : ''}`);
  },
  get: (id: string) => request<ModDetailView>('GET', `/mods/${encodeURIComponent(id)}`),
  download: (id: string, version?: string) =>
    request<ModPackage>('GET', `/mods/${encodeURIComponent(id)}/package${version ? '?version=' + encodeURIComponent(version) : ''}`),
  package: (hash: string) => request<ModPackage>('GET', `/mods/packages/${hash}`),
  validate: (pkg: unknown) => request<ModCheck>('POST', '/mods/validate', pkg),
  publish: (pkg: ModPackage) => request<ModDetailView>('POST', '/mods', pkg),
  install: (id: string) => request<ModSummaryView>('POST', `/mods/${encodeURIComponent(id)}/install`),
  unlist: (id: string) => request<void>('DELETE', `/mods/${encodeURIComponent(id)}`),
};

/** multiplayer matches: a lobby with an invite code, then the players' runs (PvP) */
export const matches = {
  create: (req: NewMatchRequest) => request<MatchView>('POST', '/matches', req),
  join: (code: string, game_speed: number) => request<MatchView>('POST', '/matches/join', { code, game_speed }),
  /** the player's match not finished yet (null: none) */
  current: () => request<MatchView | undefined>('GET', '/matches/current').then((m) => m ?? null),
  get: (id: string) => request<MatchView>('GET', `/matches/${id}`),
  settings: (id: string, s: MatchSettingsView) => request<MatchView>('PUT', `/matches/${id}/settings`, s),
  start: (id: string) => request<MatchView>('POST', `/matches/${id}/start`),
  vote: (id: string, choice: BlindChoice) => request<MatchView>('POST', `/matches/${id}/vote`, { choice }),
  leave: (id: string) => request<void>('POST', `/matches/${id}/leave`),
  /** coop: the hand cards selected on your turn, for the other player to watch */
  selection: (id: string, cards: number[]) => request<void>('PUT', `/matches/${id}/selection`, { cards }),
  /** coop: the run's actions since a version, with their events (the other player's, to play them again) */
  steps: (id: string, since: number) => request<CoopStepsView>('GET', `/matches/${id}/steps?since=${since}`),
  /** after a match: a new lobby with the same settings (or the other player's, joined) */
  rematch: (id: string) => request<MatchView>('POST', `/matches/${id}/rematch`),
  /** the host sends a player away from the lobby */
  kick: (id: string, seat: number) => request<MatchView>('POST', `/matches/${id}/kick`, { seat }),
  emote: (id: string, emote: EmoteName) => request<void>('POST', `/matches/${id}/emote`, { emote }),
  /** the player's finished matches, the latest first */
  history: (limit = 20, before?: string | null) =>
    request<MatchHistoryView>('GET', `/matches/history?limit=${limit}${before ? `&before=${encodeURIComponent(before)}` : ''}`),
  stats: () => request<MultiplayerStats>('GET', '/matches/stats'),
  /** a coop run's two decks (each player's cards, and those still to draw) */
  coop_decks: (run_id: string) => request<CoopDecksView>('GET', `/games/${run_id}/coop/decks`),
};
