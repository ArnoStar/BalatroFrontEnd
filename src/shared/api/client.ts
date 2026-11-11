// HTTP client for BalatroWebAPI. With sign-in on, every request carries the
// player's access token (session.ts); a refused token is refreshed once, and a
// player without a session goes to the portal's sign-in page.
import { access_token, go_to_sign_in, refresh_session } from './session';
import { recorder } from '@/shared/lib/recorder';
import type {
  ActionResult, GameSummaryView, GameView, HandPreview, HistoryView, MeView, NewGameRequest, PlayerAction, ProblemDetails, WatchView,
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

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const token = await access_token();
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
  importGame: (history: Pick<HistoryView, 'settings' | 'commands' | 'start_profile'>) => request<GameView>('POST', '/games/import', history),
  /** the player's settings and progress */
  me: () => request<MeView>('GET', '/players/me'),
  /** watch a run again: a copy at its start and the player's actions */
  watch: (id: string) => request<WatchView>('POST', `/games/${id}/watch`),
};
