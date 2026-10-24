// The card entity: Card and CardArea, and the card's description popup.
import { G, UIBox, hooks } from '@/shared/lib/engine';
import { localize } from '@/shared/lib/localization';
import { mix_colours } from '@/shared/lib/engine';
import { create_UIBox_detailed_tooltip } from './ui/card-ui';

export { Card, get_front_spriteinfo } from './model/card';
export { Card_Character, speech_bubble } from './model/card-character';
export type { CardParams } from './model/card';
export { CardArea } from './model/card-area';
export type { CardAreaConfig } from './model/card-area';
export { generate_card_ui, generate_UIBox_ability_table, card_h_popup, get_type_colour, create_UIBox_detailed_tooltip } from './ui/card-ui';

/** the card popups' callbacks (button_callbacks.lua) */
export function init_card_entity() {
  hooks.create_UIBox_detailed_tooltip = create_UIBox_detailed_tooltip;
  G.UIDEF = G.UIDEF ?? {};

  G.FUNCS.show_infotip = (e: any) => {
    if (e.config.ref_table) {
      e.children.info = new UIBox({
        definition: { n: G.UIT.ROOT, config: { align: 'cm', colour: G.C.CLEAR, padding: 0.02 }, nodes: e.config.ref_table },
        config: { offset: { x: -0.03, y: 0 }, align: 'cl', parent: e },
      });
      e.children.info.align_to_major();
      e.config.ref_table = null;
    }
  };

  G.FUNCS.blueprint_compat = (e: any) => {
    const a = e.config.ref_table.ability;
    if (a.blueprint_compat !== a.blueprint_compat_check) {
      if (a.blueprint_compat === 'compatible') e.config.colour = mix_colours(G.C.GREEN, G.C.JOKER_GREY, 0.8);
      else if (a.blueprint_compat === 'incompatible') e.config.colour = mix_colours(G.C.RED, G.C.JOKER_GREY, 0.8);
      a.blueprint_compat_ui = ' ' + localize('k_' + a.blueprint_compat) + ' ';
      a.blueprint_compat_check = a.blueprint_compat;
    }
  };
}
