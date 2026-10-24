// HTTP client for BalatroWebAPI.
import type {
  ActionResult, GameSummaryView, GameView, HandPreview, NewGameRequest, PlayerAction, ProblemDetails,
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

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${api_base()}/api/v1${path}`, {
    method,
    headers: body !== undefined ? { 'content-type': 'application/json' } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (res.status === 204) return undefined as T;
  const text = await res.text();
  const json = text ? JSON.parse(text) : null;
  if (!res.ok) {
    const p = json && typeof json === 'object' && 'code' in json ? (json as ProblemDetails) : null;
    throw new ApiError(res.status, p, p?.detail ?? `${method} ${path}: ${res.status}`);
  }
  return json as T;
}

export const api = {
  health: () => request<{ status: string; api_version: string; engine_version: string; game_version: string }>('GET', '/health'),
  newGame: (req: NewGameRequest) => request<GameView>('POST', '/games', req),
  listGames: (limit = 50, offset = 0) => request<GameSummaryView[]>('GET', `/games?limit=${limit}&offset=${offset}`),
  getGame: (id: string) => request<GameView>('GET', `/games/${id}`),
  deleteGame: (id: string) => request<void>('DELETE', `/games/${id}`),
  act: (id: string, action: PlayerAction, expected_version?: number) =>
    request<ActionResult>('POST', `/games/${id}/actions`, { ...action, expected_version: expected_version ?? null }),
  preview: (id: string, cards: number[]) => request<HandPreview>('POST', `/games/${id}/preview`, { cards }),
  debug: (id: string, command: Record<string, unknown>, expected_version?: number) =>
    request<ActionResult>('POST', `/games/${id}/debug`, { command, expected_version: expected_version ?? null }),
};
