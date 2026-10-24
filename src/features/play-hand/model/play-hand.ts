// Playing, discarding and sorting the hand (state_events.lua:
// play_cards_from_highlighted, discard_cards_from_highlighted, evaluate_play's
// on-screen part; button_callbacks.lua: sort_hand_*, can_play, can_discard),
// and the hand preview while cards are selected (CardArea:parse_highlighted).
import { G, Event, play_sound, delay } from '@/shared/lib/engine';
import { api } from '@/shared/api';
import { react_tags } from '@/entities/tag';
import { check_and_set_high_score, count_usage, profile, save_profile } from '@/shared/config';
import type { GameEvent } from '@/shared/api';
import {
  run, perform, perform_debug, is_legal, legal, stop_use, ease_hands_played, ease_discard, ease_ante, highlight_card, update_hand_text_now,
  card_by_id, type Timeline,
} from '@/entities/run';

const ids_of = (cards: any[]) => cards.map((c) => c.api_id).filter((x) => x !== undefined) as number[];
const by_x = (cards: any[]) => [...cards].sort((a, b) => a.T.x - b.T.x);

/** CardArea:parse_highlighted, with the API's answer */
function preview_hand(area: any) {
  if (area !== G.hand || !run.id) return;
  const selected = ids_of(area.highlighted);
  const seq = ++run.preview_seq;
  if (selected.length === 0) {
    run.preview = null;
    G.boss_throw_hand = null;
    update_hand_text_now({ immediate: true, nopulse: true, delay: 0 }, { mult: 0, chips: 0, level: '', handname: '' });
    return;
  }
  api.preview(run.id, selected).then((p) => {
    if (seq !== run.preview_seq || G.STATE !== G.STATES.SELECTING_HAND) return;
    run.preview = p;
    if (!p.hand && !p.hidden) {
      update_hand_text_now({ immediate: true, nopulse: true, delay: 0 }, { mult: 0, chips: 0, level: '', handname: '' });
      return;
    }
    G.boss_throw_hand = p.not_allowed ? true : null;
    if (p.hidden) update_hand_text_now({ immediate: true, delay: 0 }, { handname: '????', level: '?', mult: '?', chips: '?' });
    else update_hand_text_now({ immediate: true, delay: 0 }, { handname: p.display_name, level: p.level, mult: p.mult, chips: p.chips });
  }).catch(() => { /* a stale selection: ignore */ });
}

/** the state the game is in after a play's or discard's last move */
function after_round_cues(tl: Timeline, played: Set<number>, hands_before: number) {
  const view = tl.view;
  const newly_won = view.won && !G.GAME.won;
  const moved = (e: GameEvent) => e.type === 'card_moved';
  // the played cards' last move to the discard pile: update_hand_played picks the next state
  const t_disc = tl.find_last((e) => moved(e) && (e as any).to === 'discard' && played.has((e as any).card));
  if (view.phase === 'playing') {
    if (t_disc !== null) tl.at(t_disc + 0.117, () => { G.STATE = G.STATES.DRAW_TO_HAND; G.STATE_COMPLETE = false; });
    tl.at(tl.end_t + 0.117, () => {
      G.STATE = G.STATES.SELECTING_HAND;
      G.STATE_COMPLETE = false;
      G.GAME.blind?.drawn_to_hand?.();
    });
  } else {
    const t_nr = t_disc !== null ? t_disc + 0.117 : 0.017;
    tl.at(t_nr, () => { G.STATE = G.STATES.NEW_ROUND; G.STATE_COMPLETE = false; });
    if (view.phase === 'game_over') {
      tl.at(Math.max(t_nr + 0.217, tl.end_t), () => {
        if (!G.GAME.won && !G.GAME.seeded && !G.GAME.challenge) { profile().high_scores.current_streak.amt = 0; save_profile(); }
        G.STATE = G.STATES.GAME_OVER;
        G.STATE_COMPLETE = false;
      });
    } else {
      const t_deck = tl.find((e) => moved(e) && (e as any).to === 'deck', t_nr);
      const t_eval = t_deck !== null ? t_deck - 0.017 : tl.end_t + 0.3;
      if (view.ante > (G.GAME.round_resets.ante ?? view.ante)) {
        // a beaten boss: delay(0.4); ease_ante(1); delay(0.4) between the two pile moves
        tl.at(t_eval - 0.3 - 0.4 - 0.033, () => ease_ante(view.ante - G.GAME.round_resets.ante, view.ante));
      }
      tl.at(t_eval, () => {
        // set_joker_usage, and the profile's streaks on a win
        for (const j of G.jokers.cards) if (j.ability.set === 'Joker') count_usage('joker_usage', j.config.center.key, j.config.center.order);
        if (newly_won && !G.GAME.seeded) {
          const hs = profile().high_scores;
          if (!G.GAME.challenge) {
            profile().career_stats.c_wins = (profile().career_stats.c_wins ?? 0) + 1;
            hs.current_streak.amt += 1;
            check_and_set_high_score('win_streak', hs.current_streak.amt);
          } else {
            profile().challenge_progress.completed[G.GAME.challenge] = true;
          }
          save_profile();
        }
        G.STATE = G.STATES.ROUND_EVAL;
        G.STATE_COMPLETE = false;
        // end_round's win_game, once the round evaluation is up
        if (newly_won) { G.GAME.won = true; G.FUNCS.win_game?.(); }
      });
    }
  }
  void hands_before;
}

export function register_play_hand_funcs() {
  G.FUNCS.preview_hand = preview_hand;

  G.FUNCS.can_play = (e: any) => {
    const n = G.hand.highlighted.length;
    const a = legal('play')[0];
    const max = a?.max_cards ?? 5;
    if (n <= 0 || G.GAME.blind.block_play || n > max || !a) {
      e.config.colour = G.C.UI.BACKGROUND_INACTIVE;
      e.config.button = null;
    } else {
      e.config.colour = G.C.BLUE;
      e.config.button = 'play_cards_from_highlighted';
    }
  };

  G.FUNCS.can_discard = (e: any) => {
    if (G.GAME.current_round.discards_left <= 0 || G.hand.highlighted.length <= 0 || !is_legal('discard')) {
      e.config.colour = G.C.UI.BACKGROUND_INACTIVE;
      e.config.button = null;
    } else {
      e.config.colour = G.C.RED;
      e.config.button = 'discard_cards_from_highlighted';
    }
  };

  /** development: a debug command of the API (e.g. {cmd: 'cheat', win: true}), played like a hand */
  G.FUNCS.debug_command = (cmd: Record<string, unknown>) => perform_debug(cmd, {
    play: (tl) => {
      if (cmd.win) after_round_cues(tl, new Set(), 0);
      if (cmd.cmd === 'add_tag') react_tags(tl.view.tags);
    },
  });

  G.FUNCS.sort_hand_suit = () => sort('suit');
  G.FUNCS.sort_hand_value = () => sort('rank');

  G.FUNCS.play_cards_from_highlighted = (_e: any) => {
    if (G.play && G.play.cards[0]) return;
    const cards = by_x(G.hand.highlighted);
    const ids = ids_of(cards);
    const scoring = run.preview && same(run.preview.selected, ids) ? run.preview.scoring : null;
    const hands_before = G.GAME.current_round.hands_left;
    perform({ type: 'play', cards: ids }, {
      skip_selection: true,
      before: () => {
        stop_use();
        G.GAME.blind.triggered = false;
        G.CONTROLLER.interrupt.focus = true;
      },
      play: (tl) => {
        G.E_MANAGER.add_event(new Event({ trigger: 'immediate', func: () => { G.STATE = G.STATES.HAND_PLAYED; G.STATE_COMPLETE = true; return true; } }));
        ease_hands_played(-1, false, tl.view.phase === 'playing' ? tl.view.hands_left : G.GAME.current_round.hands_left - 1);
        delay(0.4);
        const played = new Set(ids);
        const t_last_play = tl.find_last((e) => e.type === 'card_moved' && e.to === 'play' && played.has(e.card));
        if (G.GAME.blind?.acts_on_play?.() && t_last_play !== null) {
          // G.GAME.blind:press_play() returned true: the HUD's blind reacts
          G.E_MANAGER.add_event(tl.until(t_last_play + 0.1));
          G.E_MANAGER.add_event(new Event({
            trigger: 'immediate',
            func: () => {
              G.HUD_blind.get_UIE_by_ID('HUD_blind_debuff_1')?.juice_up(0.3, 0);
              G.HUD_blind.get_UIE_by_ID('HUD_blind_debuff_2')?.juice_up(0.3, 0);
              G.GAME.blind.juice_up();
              G.E_MANAGER.add_event(new Event({ trigger: 'after', delay: 0.06 * G.SETTINGS.GAMESPEED, blockable: false, blocking: false, func: () => { play_sound('tarot2', 0.76, 0.4); return true; } }));
              play_sound('tarot2', 1, 0.4);
              return true;
            },
          }));
        }
        const t_eval = tl.find((e) => e.type === 'hand' && !!e.hand, t_last_play ?? 0);
        const t_hs = tl.find((e) => e.type === 'hand_scored');
        const scorers = (scoring ?? []).map((id) => card_by_id(id)).filter((c) => c) as any[];
        if (t_eval !== null && scorers.length) {
          // evaluate_play's highlights come after play_cards_from_highlighted's own two events
          G.E_MANAGER.add_event(tl.until(t_eval));
          delay(0.1);
          G.E_MANAGER.add_event(new Event({ trigger: 'immediate', func: () => true }));
          delay(0.2);
          by_x(scorers).forEach((c, i) => highlight_card(c, (i + 1 - 0.999) / 5, 'up'));
          if (t_hs !== null) {
            G.E_MANAGER.add_event(tl.until(t_hs - 0.517 - 0.117 * (scorers.length - 1)));
            by_x(scorers).forEach((c, i) => highlight_card(c, (i + 1 - 0.999) / (scorers.length - 0.998), 'down'));
          }
        }
        if (t_hs !== null) {
          const hs = tl.events.find((e) => e.type === 'hand_scored') as any;
          G.E_MANAGER.add_event(tl.until(t_hs));
          if (hs.score > 0) {
            delay(0.8);
            G.E_MANAGER.add_event(new Event({ trigger: 'immediate', func: () => { play_sound('chips2'); return true; } }));
          }
          G.E_MANAGER.add_event(new Event({
            trigger: 'ease', blocking: false, ref_table: G.GAME, ref_value: 'chips', ease_to: hs.round_score, delay: 0.5,
            func: (t: number) => Math.floor(t),
          }));
          G.E_MANAGER.add_event(new Event({
            trigger: 'ease', blocking: true, ref_table: G.GAME.current_round.current_hand, ref_value: 'chip_total', ease_to: 0, delay: 0.5,
            func: (t: number) => Math.floor(t),
          }));
          G.E_MANAGER.add_event(new Event({ trigger: 'immediate', func: () => { G.GAME.current_round.current_hand.handname = ''; return true; } }));
          count_usage('hand_usage', String(hs.hand).replace(/\s+/g, ''), hs.hand);
          check_and_set_high_score('hand', hs.score);
          if (hs.score > G.GAME.round_scores.hand.amt) {
            G.GAME.round_scores.hand.amt = hs.score;
            try { localStorage.setItem('balatro-fe.best.' + run.id, String(hs.score)); } catch { /* no storage */ }
          }
        }
        G.GAME.round_scores.cards_played.amt += ids.length;
        after_round_cues(tl, played, hands_before);
      },
    });
  };

  G.FUNCS.discard_cards_from_highlighted = (_e: any) => {
    const cards = by_x(G.hand.highlighted);
    const ids = ids_of(cards);
    if (!ids.length) return;
    perform({ type: 'discard', cards: ids }, {
      skip_selection: true,
      before: () => {
        stop_use();
        G.CONTROLLER.interrupt.focus = true;
      },
      play: (tl) => {
        const set = new Set(ids);
        const t_last = tl.find_last((e) => e.type === 'card_moved' && e.to === 'discard' && set.has(e.card));
        G.STATE = G.STATES.DRAW_TO_HAND;
        if (t_last !== null) G.E_MANAGER.add_event(tl.until(t_last + 0.1));
        ease_discard(-1, false, false, tl.view.discards_left);
        G.GAME.current_round.discards_used = (G.GAME.current_round.discards_used ?? 0) + 1;
        G.E_MANAGER.add_event(new Event({ trigger: 'immediate', func: () => { G.STATE_COMPLETE = false; return true; } }));
        G.GAME.round_scores.cards_discarded.amt += ids.length;
        const view = tl.view;
        if (view.phase === 'playing') {
          tl.at(tl.end_t + 0.117, () => {
            G.STATE = G.STATES.SELECTING_HAND;
            G.STATE_COMPLETE = false;
            G.GAME.blind?.drawn_to_hand?.();
          });
        } else if (view.phase === 'game_over') {
          tl.at(tl.end_t + 0.3, () => { G.STATE = G.STATES.GAME_OVER; G.STATE_COMPLETE = false; });
        }
      },
    });
  };
}

function same(a: number[], b: number[]) {
  if (a.length !== b.length) return false;
  const s = new Set(a);
  return b.every((x) => s.has(x));
}

/** G.FUNCS.sort_hand_*: the API sorts (the choice sticks), the hand slides into its order */
function sort(mode: 'rank' | 'suit') {
  G.hand.sort(mode === 'suit' ? 'suit desc' : 'desc');
  play_sound('paper1');
  perform({ type: 'sort', mode });
}
