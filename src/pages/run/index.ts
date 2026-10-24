// The run screen: Game:start_run and the run's state machine, with the
// timeline hooks the run's screens need (the shop's price tags, pack cards).
import { G } from '@/shared/lib/engine';
import { default_hooks, resync } from '@/entities/run';
import { create_shop_card_ui } from './ui/shop';
import { replace_boss_choice } from '@/widgets/blind-select';
import { show_win } from './ui/game-over';
import { start_run } from './model/start-run';

export { start_run };

export function init_run_page() {
  G.start_run_page = start_run;
  G.FUNCS.replace_boss_choice = replace_boss_choice;
  G.FUNCS.win_game = show_win;
  resync.handler = (view) => { G.FUNCS.start_run(null, { open_id: view.id }); };
  default_hooks.card_entered = (card: any, area: string, fresh: boolean) => {
    if (!fresh) return;
    if (area === 'shop' || area === 'vouchers' || area === 'boosters') {
      create_shop_card_ui(card);
      if (area !== 'shop' || card.ability.consumeable) card.start_materialize();
      if (G.reroll_in_progress) card.juice_up();
    } else if (area === 'pack') {
      const b = G.opened_booster;
      if (b) { card.T.x = b.T.x; card.T.y = b.T.y; }
      card.start_materialize([G.C.WHITE, G.C.WHITE], undefined, 1.5 * G.SETTINGS.GAMESPEED);
    }
  };
}
