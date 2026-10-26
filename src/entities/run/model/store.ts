// The run being played: the API's latest GameView and what the player is
// doing with it (an action in flight, the hand preview).
import type { Area, CardView, GameView, HandPreview, LegalAction, ActionType } from '@/shared/api';

export const run = {
  id: null as string | null,
  view: null as GameView | null,
  /** an action is being sent or its timeline is playing */
  busy: false,
  preview: null as HandPreview | null,
  /** the preview's request counter, to drop late answers */
  preview_seq: 0,
  /** times the game entered DRAW_TO_HAND (update_draw_to_hand with STATE_COMPLETE false) */
  draws: 0,
};

export function set_view(view: GameView) {
  run.view = view;
  run.id = view.id;
}

export function clear_run() {
  run.id = null;
  run.view = null;
  run.busy = false;
  run.preview = null;
}

/** the legal actions of a type (for a card) */
export function legal(type: ActionType, card?: number | null): LegalAction[] {
  const v = run.view;
  if (!v) return [];
  return v.actions.filter((a) => a.type === type && (card === undefined || card === null || a.card === card));
}

export function is_legal(type: ActionType, card?: number | null) {
  return legal(type, card).length > 0;
}

/** the card views of an area in a GameView */
export function area_views(view: GameView, area: Area): CardView[] | null {
  switch (area) {
    case 'hand': return view.hand;
    case 'jokers': return view.jokers;
    case 'consumables': return view.consumables;
    case 'shop': return view.shop ? view.shop.jokers : null;
    case 'vouchers': return view.shop ? view.shop.vouchers : null;
    case 'boosters': return view.shop ? view.shop.boosters : null;
    case 'pack': return view.pack ? view.pack.cards : null;
    default: return null;
  }
}

export const VIEW_AREAS: Area[] = ['hand', 'jokers', 'consumables', 'shop', 'vouchers', 'boosters', 'pack'];

/** a card's view and area in a GameView */
export function find_view(view: GameView | null, id: number): { cv: CardView; area: Area } | null {
  if (!view) return null;
  for (const area of VIEW_AREAS) {
    const list = area_views(view, area);
    const cv = list?.find((c) => c.id === id);
    if (cv) return { cv, area };
  }
  return null;
}
