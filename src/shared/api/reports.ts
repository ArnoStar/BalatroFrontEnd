// The bug report service (BalatroBugReportService), at /reports/ on the site.
// Its calls are not recorded: a report doesn't contain its own sending.
import { ApiError } from './client';
import { access_token, refresh_session } from './session';
import type { HistoryView, ProblemDetails } from './types';

/** the report service's base URL: `?reports=...`, VITE_REPORTS_URL, or /reports on this origin */
export function reports_base(): string {
  const q = new URLSearchParams(window.location.search).get('reports');
  const env = (import.meta as any).env?.VITE_REPORTS_URL as string | undefined;
  return (q || env || '/reports').replace(/\/$/, '');
}

async function call<T>(method: string, path: string, body?: unknown): Promise<T> {
  const send = (token: string | null) => fetch(`${reports_base()}${path}`, {
    method,
    headers: { ...(body !== undefined ? { 'content-type': 'application/json' } : {}), ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: body !== undefined ? JSON.stringify(body) : undefined,
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
    throw new ApiError(res.status, p, p?.detail ?? `the report service answered ${res.status}`);
  }
  return json as T;
}

export interface NewReport {
  description: string;
  game: { id: string; version: number } | null;
  history: HistoryView | null;
  client: Record<string, unknown>;
  recording: Record<string, unknown>;
  screenshot: string | null;
}

export interface ReportView {
  id: string;
  created_at: string;
  reporter_name: string | null;
  description: string;
  status: 'open' | 'closed';
  game_id: string | null;
  game_version: number | null;
  history: HistoryView | null;
  client: Record<string, unknown>;
  recording: { events?: Array<{ t: number; k: string; [key: string]: unknown }>; errors?: unknown[]; [key: string]: unknown };
}

export const reports = {
  me: () => call<{ id: string; name: string | null; admin: boolean }>('GET', '/v1/me'),
  submit: (report: NewReport) => call<{ id: string; created_at: string }>('POST', '/v1/reports', report),
  get: (id: string) => call<ReportView>('GET', `/v1/reports/${encodeURIComponent(id)}`),
};
