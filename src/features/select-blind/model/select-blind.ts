// Choosing the next blind (button_callbacks.lua: select_blind, skip_blind,
// reroll_boss; state_events.lua: new_round's on-screen part).
import { G, Event, play_sound, delay } from '@/shared/lib/engine';
import type { GameView } from '@/shared/api';
import { add_tag, react_tags } from '@/entities/tag';
import { perform, stop_use, ease_round, sync_game, type Timeline } from '@/entities/run';

/** new_round: the blind is set, then the hand is drawn (the API's events) */
function new_round(view: GameView, tl: Timeline) {
  G.RESET_JIGGLES = null;
  delay(0.4);
  G.E_MANAGER.add_event(new Event({
    trigger: 'immediate',
    func: () => {
      const cr = G.GAME.current_round;
      cr.discards_left = view.discards_left;
      cr.hands_left = view.hands_left;
      cr.hands_played = 0;
      cr.discards_used = 0;
      const b = view.blind;
      const slot = b?.slot ?? G.GAME.blind_on_deck;
      if (slot) G.GAME.round_resets.blind_states[slot] = 'Current';
      if (b && b.key) G.GAME.blind.set_blind(G.P_BLINDS[b.key], undefined, undefined, b.chips, b.reward);
      delay(0.4);
      G.E_MANAGER.add_event(new Event({
        trigger: 'immediate',
        func: () => {
          G.STATE = G.STATES.DRAW_TO_HAND;
          G.STATE_COMPLETE = false;
          return true;
        },
      }));
      return true;
    },
  }));
  if (view.phase === 'playing') {
    tl.at(tl.end_t + 0.117, () => {
      G.STATE = G.STATES.SELECTING_HAND;
      G.STATE_COMPLETE = false;
      G.GAME.blind?.drawn_to_hand?.();
    });
  }
}

const PACK_OF_KIND: Record<string, string> = {
  tarot: 'p_arcana_mega_1', planet: 'p_celestial_mega_1', spectral: 'p_spectral_normal_1', standard: 'p_standard_mega_1', buffoon: 'p_buffoon_mega_1',
};

/**
 * The tags that act when blinds are offered (Tag:apply_to_run 'immediate'
 * and 'new_blind_choice': after a skip, when the blind select appears, when a
 * pack closes, after a boss reroll). The tags the API took away triggered:
 * their yep shows, and a pack tag's yep opens its booster, the Boss Tag's
 * rerolls the boss.
 */
function blind_choice_tags(view: GameView | null, tl: Timeline | null) {
  if (!view) return;
  // one pack per answer (a Boss Tag's reroll comes back here)
  const opening = view.phase === 'pack' && !packs_opened.has(view);
  if (opening) packs_opened.add(view);
  let opened = false;
  react_tags(view.tags, (t) => {
    // the tag locks the controls until it has acted (G.CONTROLLER.locks[self.ID])
    const lock = t.ID;
    if (t.name === 'Boss Tag') {
      G.CONTROLLER.locks[lock] = true;
      return () => {
        reroll_boss_ui(view, tl);
        G.E_MANAGER.add_event(new Event({ func: () => {
          G.E_MANAGER.add_event(new Event({ func: () => { G.CONTROLLER.locks[lock] = null; return true; } }));
          return true;
        } }));
        return true;
      };
    }
    const key = G.FUNCS.tag_booster(t);
    if (!opening || opened || !key) return undefined;
    opened = true;
    G.CONTROLLER.locks[lock] = true;
    return () => { G.FUNCS.open_tag_booster(key, tl ?? undefined); G.CONTROLLER.locks[lock] = null; return true; };
  });
  if (opening && !opened) G.FUNCS.open_tag_booster(PACK_OF_KIND[view.pack?.kind ?? 'buffoon'], tl ?? undefined);
}
const packs_opened = new WeakSet<GameView>();

/** G.FUNCS.reroll_boss's on-screen part: the boss slides away, the view's new boss comes in */
function reroll_boss_ui(view: GameView, tl: Timeline | null) {
  G.GAME.round_resets.boss_rerolled = true;
  G.CONTROLLER.locks.boss_reroll = true;
  G.E_MANAGER.add_event(new Event({
    trigger: 'immediate',
    func: () => {
      play_sound('other1');
      const boss = G.blind_select_opts?.boss;
      if (boss) {
        boss.set_role({ xy_bond: 'Weak' });
        boss.alignment.offset.y = 20;
      }
      return true;
    },
  }));
  G.E_MANAGER.add_event(new Event({
    trigger: 'after', delay: 0.3,
    func: () => {
      sync_game(view, { keep: ['dollars'] });
      if (G.blind_select_opts?.boss) G.FUNCS.replace_boss_choice();
      G.E_MANAGER.add_event(new Event({ blocking: false, trigger: 'after', delay: 0.5, func: () => { G.CONTROLLER.locks.boss_reroll = null; return true; } }));
      blind_choice_tags(view, tl);
      return true;
    },
  }));
}

export function register_select_blind_funcs() {
  G.FUNCS.select_blind = (e: any) => {
    if (!G.blind_select) return;
    perform({ type: 'select_blind' }, {
      before: () => stop_use(),
      play: (tl, res) => {
        G.GAME.facing_blind = true;
        for (const id of ['prompt_dynatext1', 'prompt_dynatext2']) {
          const o = G.blind_prompt_box?.get_UIE_by_ID(id)?.config.object;
          if (o) { o.pop_delay = 0; o.pop_out(5); }
        }
        G.E_MANAGER.add_event(new Event({
          trigger: 'before', delay: 0.2,
          func: () => {
            G.blind_prompt_box.alignment.offset.y = -10;
            G.blind_select.alignment.offset.y = 40;
            G.blind_select.alignment.offset.x = 0;
            return true;
          },
        }));
        G.E_MANAGER.add_event(new Event({
          trigger: 'immediate',
          func: () => {
            ease_round(1, res.game.round);
            G.GAME.round_resets.blind = e.config.ref_table;
            G.GAME.round_resets.blind_states[G.GAME.blind_on_deck] = 'Current';
            G.blind_select.remove();
            G.blind_prompt_box.remove();
            G.blind_select = null;
            delay(0.2);
            return true;
          },
        }));
        G.E_MANAGER.add_event(new Event({ trigger: 'immediate', func: () => { new_round(res.game, tl); return true; } }));
      },
      refused: () => { e.config.button = 'select_blind'; },
    });
  };

  G.FUNCS.skip_blind = (e: any) => {
    const _tag = e.UIBox.get_UIE_by_ID('tag_container');
    perform({ type: 'skip_blind' }, {
      before: () => {
        stop_use();
        G.CONTROLLER.locks.skip_blind = true;
        G.E_MANAGER.add_event(new Event({
          no_delete: true, trigger: 'after', blocking: false, blockable: false, delay: 2.5, timer: 'TOTAL',
          func: () => { G.CONTROLLER.locks.skip_blind = null; return true; },
        }));
      },
      play: (tl, res) => {
        G.GAME.skips = (G.GAME.skips ?? 0) + 1;
        if (_tag) {
          add_tag(_tag.config.ref_table);
          const skipped = G.GAME.blind_on_deck ?? 'Small';
          const skip_to = skipped === 'Small' ? 'Big' : 'Boss';
          G.GAME.round_resets.blind_states[skipped] = 'Skipped';
          G.GAME.round_resets.blind_states[skip_to] = 'Select';
          G.GAME.blind_on_deck = skip_to;
          play_sound('generic1');
          G.E_MANAGER.add_event(new Event({
            trigger: 'immediate',
            func: () => {
              delay(0.3);
              blind_choice_tags(res.game, tl);
              return true;
            },
          }));
        }
      },
      refused: () => { G.CONTROLLER.locks.skip_blind = null; },
    });
  };

  G.FUNCS.reroll_boss = (_e: any) => {
    perform({ type: 'reroll_boss' }, {
      before: () => stop_use(),
      play: (tl, res) => reroll_boss_ui(res.game, tl),
    });
  };
  G.FUNCS.blind_choice_tags = blind_choice_tags;
}
