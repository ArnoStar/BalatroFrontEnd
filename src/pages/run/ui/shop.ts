// The shop: G.UIDEF.shop (its card areas, the shop sign, Next Round and
// Reroll) and create_shop_card_ui (a card's price tag and buy buttons), from
// UI_definitions.lua.
import { G, UIBox, DynaText, AnimatedSprite, Event, lighten, darken } from '@/shared/lib/engine';
import { localize } from '@/shared/lib/localization';
import { UIBox_dyn_container } from '@/shared/ui';
import { CardArea } from '@/entities/card';

export function create_UIDEF_shop() {
  G.shop_jokers = new CardArea(G.hand.T.x + 0, G.hand.T.y + G.ROOM.T.y + 9, G.GAME.shop.joker_max * 1.02 * G.CARD_W, 1.05 * G.CARD_H,
    { card_limit: G.GAME.shop.joker_max, type: 'shop', highlight_limit: 1 });
  G.shop_vouchers = new CardArea(G.hand.T.x + 0, G.hand.T.y + G.ROOM.T.y + 9, 2.1 * G.CARD_W, 1.05 * G.CARD_H,
    { card_limit: 1, type: 'shop', highlight_limit: 1 });
  G.shop_booster = new CardArea(G.hand.T.x + 0, G.hand.T.y + G.ROOM.T.y + 9, 2.4 * G.CARD_W, 1.15 * G.CARD_H,
    { card_limit: 2, type: 'shop', highlight_limit: 1, card_w: 1.27 * G.CARD_W });

  const shop_sign = new AnimatedSprite(0, 0, 4.4, 2.2, G.ANIMATION_ATLAS.shop_sign);
  shop_sign.define_draw_steps([{ shader: 'dissolve', shadow_height: 0.05 }, { shader: 'dissolve' }]);
  G.SHOP_SIGN = new UIBox({
    definition: { n: G.UIT.ROOT, config: { colour: G.C.DYN_UI.MAIN, emboss: 0.05, align: 'cm', r: 0.1, padding: 0.1 }, nodes: [
      { n: G.UIT.R, config: { align: 'cm', padding: 0.1, minw: 4.72, minh: 3.1, colour: G.C.DYN_UI.DARK, r: 0.1 }, nodes: [
        { n: G.UIT.R, config: { align: 'cm' }, nodes: [{ n: G.UIT.O, config: { object: shop_sign } }] },
        { n: G.UIT.R, config: { align: 'cm' }, nodes: [
          { n: G.UIT.O, config: { object: new DynaText({ string: [localize('ph_improve_run')], colours: [lighten(G.C.GOLD, 0.3)], shadow: true, rotate: true, float: true, bump: true, scale: 0.5, spacing: 1, pop_in: 1.5, maxw: 4.3 }) } },
        ] },
      ] },
    ] },
    config: { align: 'cm', offset: { x: 0, y: -15 }, major: G.HUD.get_UIE_by_ID('row_blind'), bond: 'Weak' },
  });
  G.E_MANAGER.add_event(new Event({ trigger: 'immediate', func: () => { G.SHOP_SIGN.alignment.offset.y = 0; return true; } }));

  return { n: G.UIT.ROOT, config: { align: 'cl', colour: G.C.CLEAR }, nodes: [
    UIBox_dyn_container([
      { n: G.UIT.C, config: { align: 'cm', padding: 0.1, emboss: 0.05, r: 0.1, colour: G.C.DYN_UI.BOSS_MAIN }, nodes: [
        { n: G.UIT.R, config: { align: 'cm', padding: 0.05 }, nodes: [
          { n: G.UIT.C, config: { align: 'cm', padding: 0.1 }, nodes: [
            { n: G.UIT.R, config: { id: 'next_round_button', align: 'cm', minw: 2.8, minh: 1.5, r: 0.15, colour: G.C.RED, one_press: true, button: 'toggle_shop', hover: true, shadow: true }, nodes: [
              { n: G.UIT.R, config: { align: 'cm', padding: 0.07, focus_args: { button: 'y', orientation: 'cr' }, func: 'set_button_pip' }, nodes: [
                { n: G.UIT.R, config: { align: 'cm', maxw: 1.3 }, nodes: [
                  { n: G.UIT.T, config: { text: localize('b_next_round_1'), scale: 0.4, colour: G.C.WHITE, shadow: true } },
                ] },
                { n: G.UIT.R, config: { align: 'cm', maxw: 1.3 }, nodes: [
                  { n: G.UIT.T, config: { text: localize('b_next_round_2'), scale: 0.4, colour: G.C.WHITE, shadow: true } },
                ] },
              ] },
            ] },
            { n: G.UIT.R, config: { align: 'cm', minw: 2.8, minh: 1.6, r: 0.15, colour: G.C.GREEN, button: 'reroll_shop', func: 'can_reroll', hover: true, shadow: true }, nodes: [
              { n: G.UIT.R, config: { align: 'cm', padding: 0.07, focus_args: { button: 'x', orientation: 'cr' }, func: 'set_button_pip' }, nodes: [
                { n: G.UIT.R, config: { align: 'cm', maxw: 1.3 }, nodes: [
                  { n: G.UIT.T, config: { text: localize('k_reroll'), scale: 0.4, colour: G.C.WHITE, shadow: true } },
                ] },
                { n: G.UIT.R, config: { align: 'cm', maxw: 1.3, minw: 1 }, nodes: [
                  { n: G.UIT.T, config: { text: localize('$'), scale: 0.7, colour: G.C.WHITE, shadow: true } },
                  { n: G.UIT.T, config: { ref_table: G.GAME.current_round, ref_value: 'reroll_cost', scale: 0.75, colour: G.C.WHITE, shadow: true } },
                ] },
              ] },
            ] },
          ] },
          { n: G.UIT.C, config: { align: 'cm', padding: 0.2, r: 0.2, colour: G.C.L_BLACK, emboss: 0.05, minw: 8.2 }, nodes: [
            { n: G.UIT.O, config: { object: G.shop_jokers } },
          ] },
        ] },
        { n: G.UIT.R, config: { align: 'cm', minh: 0.2 }, nodes: [] },
        { n: G.UIT.R, config: { align: 'cm', padding: 0.1 }, nodes: [
          { n: G.UIT.C, config: { align: 'cm', padding: 0.15, r: 0.2, colour: G.C.L_BLACK, emboss: 0.05 }, nodes: [
            { n: G.UIT.C, config: { align: 'cm', padding: 0.2, r: 0.2, colour: G.C.BLACK, maxh: G.shop_vouchers.T.h + 0.4 }, nodes: [
              { n: G.UIT.T, config: { text: localize({ type: 'variable', key: 'ante_x_voucher', vars: [G.GAME.round_resets.ante] }), scale: 0.45, colour: G.C.L_BLACK, vert: true } },
              { n: G.UIT.O, config: { object: G.shop_vouchers } },
            ] },
          ] },
          { n: G.UIT.C, config: { align: 'cm', padding: 0.15, r: 0.2, colour: G.C.L_BLACK, emboss: 0.05 }, nodes: [
            { n: G.UIT.O, config: { object: G.shop_booster } },
          ] },
        ] },
      ] },
    ], false),
  ] };
}

/** create_shop_card_ui: the price tag and the buy (redeem, open, buy and use) buttons */
export function create_shop_card_ui(card: any, _type?: string, _area?: any) {
  G.E_MANAGER.add_event(new Event({
    trigger: 'after', delay: 0.43, blocking: false, blockable: false,
    func: () => {
      if (card.opening || card.REMOVED) return true;
      const t1 = { n: G.UIT.ROOT, config: { minw: 0.6, align: 'tm', colour: darken(G.C.BLACK, 0.2), shadow: true, r: 0.05, padding: 0.05, minh: 1 }, nodes: [
        { n: G.UIT.R, config: { align: 'cm', colour: lighten(G.C.BLACK, 0.1), r: 0.1, minw: 1, minh: 0.55, emboss: 0.05, padding: 0.03 }, nodes: [
          { n: G.UIT.O, config: { object: new DynaText({ string: [{ prefix: localize('$'), ref_table: card, ref_value: 'cost' }], colours: [G.C.MONEY], shadow: true, silent: true, bump: true, pop_in: 0, scale: 0.5 }) } },
        ] },
      ] };
      const set = card.ability.set;
      const t2 = set === 'Voucher'
        ? { n: G.UIT.ROOT, config: { ref_table: card, minw: 1.1, maxw: 1.3, padding: 0.1, align: 'bm', colour: G.C.GREEN, shadow: true, r: 0.08, minh: 0.94, func: 'can_redeem', one_press: true, button: 'redeem_from_shop', hover: true }, nodes: [
          { n: G.UIT.T, config: { text: localize('b_redeem'), colour: G.C.WHITE, scale: 0.4 } },
        ] }
        : set === 'Booster'
          ? { n: G.UIT.ROOT, config: { ref_table: card, minw: 1.1, maxw: 1.3, padding: 0.1, align: 'bm', colour: G.C.GREEN, shadow: true, r: 0.08, minh: 0.94, func: 'can_open', one_press: true, button: 'open_booster', hover: true }, nodes: [
            { n: G.UIT.T, config: { text: localize('b_open'), colour: G.C.WHITE, scale: 0.5 } },
          ] }
          : { n: G.UIT.ROOT, config: { ref_table: card, minw: 1.1, maxw: 1.3, padding: 0.1, align: 'bm', colour: G.C.GOLD, shadow: true, r: 0.08, minh: 0.94, func: 'can_buy', one_press: true, button: 'buy_from_shop', hover: true }, nodes: [
            { n: G.UIT.T, config: { text: localize('b_buy'), colour: G.C.WHITE, scale: 0.5 } },
          ] };
      const t3 = { n: G.UIT.ROOT, config: { id: 'buy_and_use', ref_table: card, minh: 1.1, padding: 0.1, align: 'cr', colour: G.C.RED, shadow: true, r: 0.08, minw: 1.1, func: 'can_buy_and_use', one_press: true, button: 'buy_from_shop', hover: true, focus_args: { type: 'none' } }, nodes: [
        { n: G.UIT.B, config: { w: 0.1, h: 0.6 } },
        { n: G.UIT.C, config: { align: 'cm' }, nodes: [
          { n: G.UIT.R, config: { align: 'cm', maxw: 1 }, nodes: [{ n: G.UIT.T, config: { text: localize('b_buy'), colour: G.C.WHITE, scale: 0.5 } }] },
          { n: G.UIT.R, config: { align: 'cm', maxw: 1 }, nodes: [{ n: G.UIT.T, config: { text: localize('b_and_use'), colour: G.C.WHITE, scale: 0.3 } }] },
        ] },
      ] };
      card.children.price = new UIBox({ definition: t1, config: { align: 'tm', offset: { x: 0, y: 1.5 }, major: card, bond: 'Weak', parent: card } });
      card.children.buy_button = new UIBox({ definition: t2, config: { align: 'bm', offset: { x: 0, y: -0.3 }, major: card, bond: 'Weak', parent: card } });
      if (card.ability.consumeable) {
        card.children.buy_and_use_button = new UIBox({ definition: t3, config: { align: 'cr', offset: { x: -0.3, y: 0 }, major: card, bond: 'Weak', parent: card } });
      }
      card.children.price.alignment.offset.y = set === 'Booster' ? 0.5 : 0.38;
      return true;
    },
  }));
}
