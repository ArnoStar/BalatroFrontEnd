// What a report sends: the player's words, the run and its whole history
// (which rebuilds every state of the run exactly), the recorder's last
// minutes, the environment, and a screenshot.
import { G } from '@/shared/lib/engine';
import { api, api_base, type HistoryView, type NewReport } from '@/shared/api';
import { recorder, type Recording } from '@/shared/lib/recorder';
import { run } from '@/entities/run';

export const BUILD: string = (import.meta as any).env?.VITE_BUILD ?? 'unknown';

/** what the game knows at the moment the player asks to report */
export interface Draft {
  recording: Recording;
  screenshot: string | null;
  game: { id: string; version: number } | null;
  history: Promise<HistoryView | null>;
  history_error: string | null;
  client: Record<string, unknown>;
}

function name_of(table: Record<string, unknown> | undefined, v: unknown) {
  return Object.keys(table ?? {}).find((k) => table![k] === v) ?? v;
}

export function start_draft(screenshot: string | null): Draft {
  const recording = recorder.snapshot();
  const game = run.id && run.view ? { id: run.id, version: run.view.version } : null;
  const draft: Draft = {
    recording, screenshot, game, history_error: null, history: Promise.resolve(null),
    client: {
      build: BUILD,
      time: new Date().toISOString(),
      user_agent: navigator.userAgent,
      language: navigator.language,
      page: location.pathname + location.search,
      api_base: api_base() || location.origin,
      screen: { width: window.innerWidth, height: window.innerHeight, dpr: window.devicePixelRatio },
      state: name_of(G.STATES, G.STATE),
      stage: name_of(G.STAGES, G.STAGE),
      busy: run.busy,
      settings: G.SETTINGS ? {
        game_speed: G.SETTINGS.GAMESPEED, reduced_motion: G.SETTINGS.reduced_motion, screenshake: G.SETTINGS.screenshake,
        play_button_pos: G.SETTINGS.play_button_pos, high_contrast: G.SETTINGS.colourblind_option,
      } : null,
    },
  };
  if (game) {
    draft.history = api.history(game.id).catch((err) => {
      draft.history_error = String(err?.message ?? err);
      return null;
    });
  }
  return draft;
}

export async function finish_draft(draft: Draft, description: string, with_screenshot: boolean): Promise<NewReport> {
  const history = await draft.history;
  return {
    description,
    game: draft.game,
    history,
    client: draft.history_error ? { ...draft.client, history_error: draft.history_error } : draft.client,
    recording: draft.recording as unknown as Record<string, unknown>,
    screenshot: with_screenshot ? draft.screenshot : null,
  };
}
