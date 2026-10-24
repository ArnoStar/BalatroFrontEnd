// back.lua: the run's deck back (its sprite, name and description).
import { G, copy_table } from '@/shared/lib/engine';
import { localize } from '@/shared/lib/localization';
import { desc_from_rows, UIBox_button } from '@/shared/ui';
import type { Def } from '@/shared/ui';

export class Back {
  name!: string;
  effect!: { center: any; text_UI: string; config: any };
  loc_name!: string;
  pos!: { x: number; y: number };

  constructor(selected_back?: any) {
    if (!selected_back) selected_back = G.P_CENTERS.b_red;
    this.name = selected_back.name ?? 'Red Deck';
    this.effect = { center: selected_back, text_UI: '', config: copy_table(selected_back.config) };
    this.loc_name = localize({ type: 'name_text', set: 'Back', key: this.effect.center.key });
    const pos = (this.effect.center.unlocked && this.effect.center.pos) || { x: 4, y: 0 };
    this.pos = { x: pos.x, y: pos.y };
  }

  get_name() {
    return this.effect.center.unlocked ? this.loc_name : localize('k_locked');
  }

  generate_UI(other?: any, ui_scale?: number, min_dims?: number, challenge?: string): Def {
    min_dims = min_dims ?? 0.7;
    void ui_scale;
    const back_config = other ?? this.effect.center;
    const name_to_check = other ? other.name : this.name;
    const ec = other ? other.config : this.effect.config;
    const ch = G.CHALLENGES.find((c: any) => c.id === (challenge ?? '')) ?? { name: 'ERROR', id: '' };
    let loc_args: any = null;
    const loc_nodes: any[] = [];
    const nt = (key: string, set: string) => localize({ type: 'name_text', key, set });
    switch (name_to_check) {
      case 'Blue Deck': loc_args = [ec.hands]; break;
      case 'Red Deck': loc_args = [ec.discards]; break;
      case 'Yellow Deck': loc_args = [ec.dollars]; break;
      case 'Green Deck': loc_args = [ec.extra_hand_bonus, ec.extra_discard_bonus]; break;
      case 'Black Deck': loc_args = [ec.joker_slot, -ec.hands]; break;
      case 'Magic Deck': loc_args = [nt('v_crystal_ball', 'Voucher'), nt('c_fool', 'Tarot')]; break;
      case 'Nebula Deck': loc_args = [nt('v_telescope', 'Voucher'), -1]; break;
      case 'Zodiac Deck': loc_args = [nt('v_tarot_merchant', 'Voucher'), nt('v_planet_merchant', 'Voucher'), nt('v_overstock_norm', 'Voucher')]; break;
      case 'Painted Deck': loc_args = [ec.hand_size, ec.joker_slot]; break;
      case 'Anaglyph Deck': loc_args = [nt('tag_double', 'Tag')]; break;
      case 'Plasma Deck': loc_args = [ec.ante_scaling]; break;
      default: break;
    }
    localize({ type: 'descriptions', key: back_config.key, set: 'Back', nodes: loc_nodes, vars: loc_args });
    return { n: G.UIT.ROOT, config: { align: 'cm', minw: min_dims * 5, minh: min_dims * 2.5, id: this.name, colour: G.C.CLEAR }, nodes: [
      name_to_check === 'Challenge Deck'
        ? UIBox_button({ button: 'deck_view_challenge', label: [localize(ch.id, 'challenge_names')], minw: 2.2, minh: 1, scale: 0.6, id: ch })
        : desc_from_rows(loc_nodes, true, min_dims * 5),
    ] };
  }

  change_to(new_back?: any) {
    if (!new_back) new_back = G.P_CENTERS.b_red;
    this.name = new_back.name ?? 'Red Deck';
    this.effect = { center: new_back, text_UI: '', config: copy_table(new_back.config) };
    this.loc_name = localize({ type: 'name_text', set: 'Back', key: this.effect.center.key });
    const pos = this.effect.center.unlocked ? copy_table(new_back.pos) : { x: 4, y: 0 };
    this.pos.x = pos.x;
    this.pos.y = pos.y;
  }
}
