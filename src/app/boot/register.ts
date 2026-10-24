// Registers every slice's callbacks in G.FUNCS / G.UIDEF, as the game's
// button_callbacks.lua and UI_definitions.lua do at load time.
import { G } from '@/shared/lib/engine';
import { init_ui_kit } from '@/shared/ui';
import { init_card_entity } from '@/entities/card';
import { register_play_hand_funcs } from '@/features/play-hand';
import { register_select_blind_funcs } from '@/features/select-blind';
import { register_shop_funcs } from '@/features/shop';
import { register_use_card_funcs } from '@/features/use-card';
import { register_run_lifecycle_funcs } from '@/features/run-lifecycle';
import { register_hud_funcs } from '@/widgets/hud';
import { register_blind_select_funcs } from '@/widgets/blind-select';
import { register_run_setup_funcs } from '@/widgets/run-setup';
import { register_options_funcs } from '@/widgets/options';
import { register_run_info_funcs } from '@/widgets/run-info';
import { register_challenge_funcs } from '@/widgets/challenges';
import { register_collection_funcs } from '@/widgets/collection';
import { register_stats_funcs } from '@/widgets/stats';
import { main_menu, register_main_menu_overlays } from '@/pages/main-menu';
import { init_run_page } from '@/pages/run';

export function register_all() {
  G.UIDEF = G.UIDEF ?? {};
  init_ui_kit();
  init_card_entity();
  register_hud_funcs();
  register_blind_select_funcs();
  register_run_setup_funcs();
  register_options_funcs();
  register_run_info_funcs();
  register_challenge_funcs();
  register_collection_funcs();
  register_stats_funcs();
  register_play_hand_funcs();
  register_select_blind_funcs();
  register_shop_funcs();
  register_use_card_funcs();
  register_run_lifecycle_funcs();
  init_run_page();
  register_main_menu_overlays();
  G.main_menu = main_menu;
  G.FUNCS.quit = () => { window.close(); };
}
