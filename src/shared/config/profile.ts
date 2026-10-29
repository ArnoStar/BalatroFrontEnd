// The player's profile (G.PROFILES): the progress the API keeps (apply_progress:
// what is unlocked and discovered, the decks' wins, the challenges); the deck
// and stake last chosen are remembered in this browser.
import { G } from '@/shared/lib/engine';
import type { ProgressView } from '@/shared/api';

const KEY = 'balatro-fe.memory';
const PROFILE_KEY = 'balatro-fe.profile';

function load_memory(): { deck: string; stake: number } {
  try {
    const m = JSON.parse(localStorage.getItem(KEY) ?? 'null');
    if (m && typeof m.deck === 'string' && typeof m.stake === 'number') return m;
  } catch { /* no storage */ }
  return { deck: 'Red Deck', stake: 1 };
}

/** the current profile (G.PROFILES[G.SETTINGS.profile] in Lua) */
export function profile(): any {
  return G.PROFILES[(G.SETTINGS.profile ?? 1) - 1];
}

/** get_deck_win_stake(_deck_key) (misc_functions.lua): the highest stake won with the deck (0: none) */
export function get_deck_win_stake(_deck_key: string): number {
  let _w = 0;
  for (const k of Object.keys(profile().deck_usage?.[_deck_key]?.wins ?? {})) _w = Math.max(Number(k), _w);
  return _w;
}

export function save_memory() {
  try { localStorage.setItem(KEY, JSON.stringify(profile().MEMORY)); } catch { /* no storage */ }
}

export function init_profile() {
  const p = profile();
  p.name = p.name || 'P' + G.SETTINGS.profile;
  p.all_unlocked = false;
  p.MEMORY = load_memory();
  p.deck_usage = p.deck_usage ?? {};
  p.joker_usage = p.joker_usage ?? {};
  p.challenge_progress = p.challenge_progress ?? { completed: {}, unlocked: {} };
  p.high_scores = p.high_scores ?? {
    hand: { label: 'Best Hand', amt: 0 }, furthest_round: { label: 'Highest Round', amt: 0 },
    furthest_ante: { label: 'Highest Ante', amt: 0 }, most_money: { label: 'Most Money', amt: 0 },
    boss_streak: { label: 'Most Bosses in a Row', amt: 0 }, collection: { label: 'Collection', amt: 0, tot: 1 },
    win_streak: { label: 'Best Win Streak', amt: 0 }, current_streak: { label: '', amt: 0 }, poker_hand: { label: 'Most Played Hand', amt: 0 },
  };
  p.hand_usage = p.hand_usage ?? {};
  p.consumeable_usage = p.consumeable_usage ?? {};
  p.voucher_usage = p.voucher_usage ?? {};
  p.career_stats = p.career_stats ?? {};
  p.progress = p.progress ?? {};
  try {
    const saved = JSON.parse(localStorage.getItem(PROFILE_KEY) ?? 'null');
    if (saved) {
      for (const k of Object.keys(saved.high_scores ?? {})) if (p.high_scores[k]) p.high_scores[k].amt = saved.high_scores[k];
      for (const k of ['hand_usage', 'joker_usage', 'consumeable_usage', 'voucher_usage']) if (saved[k]) p[k] = saved[k];
      if (saved.challenges_completed) p.challenge_progress.completed = saved.challenges_completed;
      if (saved.wins) p.career_stats.c_wins = saved.wins;
    }
  } catch { /* no storage */ }
}

/** Game:save_progress, for what this front end keeps: high scores and usage counts */
export function save_profile() {
  const p = profile();
  const hs: Record<string, number> = {};
  for (const k of Object.keys(p.high_scores)) hs[k] = p.high_scores[k].amt;
  try {
    localStorage.setItem(PROFILE_KEY, JSON.stringify({
      high_scores: hs, hand_usage: p.hand_usage, joker_usage: p.joker_usage, consumeable_usage: p.consumeable_usage,
      voucher_usage: p.voucher_usage, challenges_completed: p.challenge_progress.completed, wins: p.career_stats.c_wins ?? 0,
    }));
  } catch { /* no storage */ }
}

/** check_and_set_high_score (misc_functions.lua), for the profile's part (seeded runs don't count) */
export function check_and_set_high_score(score: string, amt: number) {
  if (typeof amt !== 'number') return;
  const p = profile();
  if (G.GAME?.round_scores?.[score] && Math.floor(amt) > G.GAME.round_scores[score].amt) G.GAME.round_scores[score].amt = Math.floor(amt);
  if (G.GAME?.seeded) return;
  if (p.high_scores[score] && Math.floor(amt) > p.high_scores[score].amt) {
    if (G.GAME?.round_scores?.[score]) G.GAME.round_scores[score].high_score = true;
    p.high_scores[score].amt = Math.floor(amt);
    save_profile();
  }
}

/** a usage count of the profile (set_hand_usage, set_joker_usage, set_consumeable_usage...) */
export function count_usage(table: 'hand_usage' | 'joker_usage' | 'consumeable_usage' | 'voucher_usage', key: string, order?: any) {
  if (G.GAME?.seeded && table !== 'hand_usage') return;
  const t = profile()[table];
  t[key] = t[key] ?? { count: 0, order: order ?? key };
  t[key].count += 1;
  save_profile();
}

const SETTINGS_KEY = 'balatro-fe.settings';

/** the player's settings, as Game:save_settings keeps them (here: in this browser) */
export function save_settings() {
  const S = G.SETTINGS;
  const keep = {
    GAMESPEED: S.GAMESPEED, play_button_pos: S.play_button_pos, screenshake: S.screenshake, run_stake_stickers: S.run_stake_stickers,
    colourblind_option: S.colourblind_option, reduced_motion: S.reduced_motion, CUSTOM_DECK: S.CUSTOM_DECK,
    SOUND: { volume: S.SOUND.volume, music_volume: S.SOUND.music_volume, game_sounds_volume: S.SOUND.game_sounds_volume },
    GRAPHICS: { shadows: S.GRAPHICS.shadows, crt: S.GRAPHICS.crt, bloom: S.GRAPHICS.bloom, texture_scaling: S.GRAPHICS.texture_scaling },
  };
  try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(keep)); } catch { /* no storage */ }
}

export function load_settings() {
  let s: any = null;
  try { s = JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? 'null'); } catch { s = null; }
  if (!s || typeof s !== 'object') return;
  const S = G.SETTINGS;
  if (s.CUSTOM_DECK?.Collabs) Object.assign(S.CUSTOM_DECK.Collabs, s.CUSTOM_DECK.Collabs);
  for (const k of ['GAMESPEED', 'play_button_pos', 'screenshake', 'run_stake_stickers', 'colourblind_option', 'reduced_motion']) {
    if (s[k] !== undefined) S[k] = s[k];
  }
  if (s.SOUND) Object.assign(S.SOUND, s.SOUND);
  if (s.GRAPHICS) {
    for (const k of ['shadows', 'crt', 'bloom']) if (s.GRAPHICS[k] !== undefined) S.GRAPHICS[k] = s.GRAPHICS[k];
  }
}

/**
 * The player's progress (GET /players/me) on the game's tables, as the game
 * keeps it in G.PROFILES and the centers' unlocked and discovered flags: the
 * run setup, the collection and the challenges read them. ``null``: a new
 * save. The pools themselves are the API's (each run keeps its profile).
 */
export function apply_progress(view: ProgressView | null) {
  const p = profile();
  const all = !!view?.all_unlocked;
  p.all_unlocked = all;
  const unlocked = new Set(view?.unlocked ?? []);
  const discovered = new Set(view?.discovered ?? []);
  for (const t of [G.P_CENTERS, G.P_BLINDS, G.P_TAGS]) {
    for (const [k, v] of Object.entries<any>(t)) {
      if (v.wip || v.demo) continue;
      // (only centers can be locked; one the game leaves unset counts as unlocked, as `unlocked ~= false`)
      if (t === G.P_CENTERS) v.unlocked = v.proto_unlocked === false ? all || unlocked.has(k) : (all || v.proto_unlocked);
      v.discovered = all || discovered.has(k) || v.proto_discovered;
      v.alerted = true;
    }
  }
  // set_deck_win's wins: every stake up to the best one won
  p.deck_usage = {};
  for (const [deck, stake] of Object.entries(view?.deck_stakes ?? {})) {
    const wins: Record<number, number> = {};
    for (let i = 1; i <= stake; i++) wins[i] = 1;
    p.deck_usage[deck] = { count: 1, order: G.P_CENTERS[deck]?.order ?? 0, wins, losses: {} };
  }
  p.challenge_progress.completed = Object.fromEntries((view?.challenges_completed ?? []).map((id) => [id, true]));
  p.challenges_unlocked = all ? G.CHALLENGES?.length : (view?.challenges_unlocked || undefined);
  // game.lua sorts the deck list with the unlocked decks first
  G.P_CENTER_POOLS?.Back?.sort((a: any, b: any) => (a.order - (a.unlocked ? 100 : 0)) - (b.order - (b.unlocked ? 100 : 0)));
}
