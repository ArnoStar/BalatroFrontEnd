// The game's generic UI kit (UI_definitions.lua / button_callbacks.lua).
import { hooks } from '@/shared/lib/engine';
import { create_popup_UIBox_tooltip } from './widgets';
import { register_ui_funcs } from './funcs';

export {
  UIBox_button, create_UIBox_generic_options, UIBox_dyn_container, simple_text_container, overlay_infotip,
  transparent_multiline_text, create_UIBox_card_alert, create_slider, create_toggle, create_option_cycle, create_tabs,
  create_text_input, create_dynatext_pips, create_popup_UIBox_tooltip, attention_text,
} from './widgets';
export type { Def } from './widgets';
export { notify_alert } from './notify-alert';
export { desc_from_rows, info_tip_from_rows, name_from_rows, create_badge, get_badge_colour } from './desc';

/** registers the widgets' callbacks in G.FUNCS */
export function init_ui_kit() {
  register_ui_funcs();
  hooks.create_popup_UIBox_tooltip = create_popup_UIBox_tooltip;
}
