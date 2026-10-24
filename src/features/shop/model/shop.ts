// The shop's actions (button_callbacks.lua: buy_from_shop, reroll_shop,
// toggle_shop, can_buy, can_buy_and_use, can_redeem, can_open, can_reroll)
// and cashing out the round (cash_out).
import { G, Event, play_sound, delay } from '@/shared/lib/engine';
import { Card } from '@/entities/card';
import { run, perform, legal, stop_use, alert_no_space, sync_game } from '@/entities/run';

const affordable = (card: any) => !(card.cost > G.GAME.dollars - G.GAME.bankrupt_at && card.cost > 0);

export function register_shop_funcs() {
  /** the voucher slot's 'Defeat the boss blind to restock' (shown once the ante's voucher is bought) */
  G.FUNCS.shop_voucher_empty = (e: any) => {
    const has = (G.shop_vouchers && G.shop_vouchers.cards && G.shop_vouchers.cards[0]) || (run.view?.shop?.vouchers.length ?? 0) > 0;
    e.states.visible = !has && G.SETTINGS.language === 'en-us';
  };
  G.FUNCS.can_buy = (e: any) => {
    const card = e.config.ref_table;
    if (!affordable(card)) {
      e.config.colour = G.C.UI.BACKGROUND_INACTIVE;
      e.config.button = null;
    } else {
      e.config.colour = G.C.ORANGE;
      e.config.button = 'buy_from_shop';
    }
    if (e.config.ref_parent && e.config.ref_parent.children.buy_and_use) {
      e.UIBox.alignment.offset.y = e.config.ref_parent.children.buy_and_use.states.visible ? -0.6 : 0;
    }
  };

  G.FUNCS.can_buy_and_use = (e: any) => {
    const card = e.config.ref_table;
    const ok = card.api_id !== undefined && legal('buy', card.api_id).some((a) => a.use);
    if (!ok) {
      e.UIBox.states.visible = false;
      e.config.colour = G.C.UI.BACKGROUND_INACTIVE;
      e.config.button = null;
    } else {
      if (card.highlighted) e.UIBox.states.visible = true;
      e.config.colour = G.C.SECONDARY_SET.Voucher;
      e.config.button = 'buy_from_shop';
    }
  };

  G.FUNCS.can_redeem = (e: any) => {
    const ok = affordable(e.config.ref_table) && legal('buy', e.config.ref_table.api_id).length > 0;
    e.config.colour = ok ? G.C.GREEN : G.C.UI.BACKGROUND_INACTIVE;
    e.config.button = ok ? 'use_card' : null;
  };

  G.FUNCS.can_open = (e: any) => {
    const ok = affordable(e.config.ref_table) && legal('buy', e.config.ref_table.api_id).length > 0;
    e.config.colour = ok ? G.C.GREEN : G.C.UI.BACKGROUND_INACTIVE;
    e.config.button = ok ? 'use_card' : null;
  };

  G.FUNCS.can_reroll = (e: any) => {
    if (!legal('reroll').length) {
      e.config.colour = G.C.UI.BACKGROUND_INACTIVE;
      e.config.button = null;
    } else {
      e.config.colour = G.C.GREEN;
      e.config.button = 'reroll_shop';
    }
  };

  G.FUNCS.buy_from_shop = (e: any) => {
    const c1 = e.config.ref_table;
    if (!(c1 instanceof Card) || c1.api_id === undefined) return;
    const use = e.config.id === 'buy_and_use';
    const a = legal('buy', c1.api_id).find((x) => !!x.use === use);
    if (!a) {
      if (!use) alert_no_space(c1, c1.ability.consumeable ? G.consumeables : G.jokers);
      e.disable_button = null;
      return;
    }
    perform({ type: 'buy', card: c1.api_id, use }, {
      skip_selection: use,
      hooks: use ? G.FUNCS.keep_used_card(c1) : undefined,
      play: (tl) => {
        G.E_MANAGER.add_event(new Event({
          trigger: 'after', delay: 0.1,
          func: () => {
            for (const k of ['price', 'buy_button', 'buy_and_use_button']) {
              if (c1.children[k]) { c1.children[k].remove(); c1.children[k] = null; }
            }
            G.GAME.round_scores.cards_purchased.amt += 1;
            if (c1.ability.set === 'Joker') G.GAME.current_round.jokers_purchased = (G.GAME.current_round.jokers_purchased ?? 0) + 1;
            play_sound('card1');
            if (use) G.FUNCS.use_card_choreography(c1, tl, true);
            return true;
          },
        }));
      },
      refused: () => { e.disable_button = null; },
    });
  };

  G.FUNCS.reroll_shop = (_e: any) => {
    const old = [...(G.shop_jokers?.cards ?? [])];
    perform({ type: 'reroll' }, {
      before: () => {
        stop_use();
        G.CONTROLLER.locks.shop_reroll = true;
      },
      hooks: { card_entered_extra: true } as any,
      play: () => {
        G.reroll_in_progress = true;
        G.E_MANAGER.add_event(new Event({
          trigger: 'immediate',
          func: () => {
            G.GAME.round_scores.times_rerolled.amt += 1;
            for (let i = old.length - 1; i >= 0; i--) {
              const c = old[i];
              if (c.REMOVED) continue;
              G.shop_jokers.remove_card(c);
              c.remove();
            }
            play_sound('coin2');
            play_sound('other1');
            return true;
          },
        }));
        G.E_MANAGER.add_event(new Event({
          trigger: 'after', delay: 0.3,
          func: () => {
            G.E_MANAGER.add_event(new Event({
              func: () => {
                G.CONTROLLER.interrupt.focus = false;
                G.CONTROLLER.locks.shop_reroll = false;
                G.reroll_in_progress = null;
                return true;
              },
            }));
            return true;
          },
        }));
      },
      refused: () => { G.CONTROLLER.locks.shop_reroll = false; },
    });
  };

  G.FUNCS.toggle_shop = (_e: any) => {
    if (!G.shop) return;
    perform({ type: 'end_shop' }, {
      before: () => {
        stop_use();
        G.CONTROLLER.locks.toggle_shop = true;
      },
      play: (_tl, res) => {
        G.E_MANAGER.add_event(new Event({
          trigger: 'immediate',
          func: () => {
            G.shop.alignment.offset.y = G.ROOM.T.y + 29;
            G.SHOP_SIGN.alignment.offset.y = -15;
            return true;
          },
        }));
        G.E_MANAGER.add_event(new Event({
          trigger: 'after', delay: 0.5,
          func: () => {
            G.shop.remove();
            G.shop = null;
            G.SHOP_SIGN.remove();
            G.SHOP_SIGN = null;
            sync_game(res.game);
            G.STATE_COMPLETE = false;
            G.STATE = G.STATES.BLIND_SELECT;
            G.CONTROLLER.locks.toggle_shop = null;
            return true;
          },
        }));
      },
      refused: () => { G.CONTROLLER.locks.toggle_shop = null; },
    });
  };

  G.FUNCS.cash_out = (e: any) => {
    perform({ type: 'cash_out' }, {
      before: () => {
        stop_use();
        e.config.button = null;
      },
      play: (_tl, res) => {
        if (G.round_eval) {
          G.round_eval.alignment.offset.y = G.ROOM.T.y + 15;
          G.round_eval.alignment.offset.x = 0;
          delay(0.3);
          G.E_MANAGER.add_event(new Event({
            trigger: 'immediate',
            func: () => {
              if (G.round_eval) { G.round_eval.remove(); G.round_eval = null; }
              G.GAME.current_round.jokers_purchased = 0;
              G.GAME.current_round.discards_left = res.game.discards_left;
              G.GAME.current_round.hands_left = res.game.hands_left;
              sync_game(res.game, { keep: ['dollars', 'chips'] });
              G.STATE = G.STATES.SHOP;
              G.GAME.shop_free = null;
              G.GAME.shop_d6ed = null;
              G.STATE_COMPLETE = false;
              return true;
            },
          }));
          G.E_MANAGER.add_event(new Event({ trigger: 'immediate', func: () => true })); // ease_dollars: the API's event
          G.E_MANAGER.add_event(new Event({ func: () => { G.GAME.previous_round.dollars = G.GAME.dollars; return true; } }));
          play_sound('coin7');
          G.VIBRATION += 1;
        }
        G.E_MANAGER.add_event(new Event({ trigger: 'immediate', func: () => true })); // ease_chips(0): the API's event
        delay(0.6);
      },
      refused: () => { e.config.button = 'cash_out'; },
    });
  };
}
