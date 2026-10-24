// tag.lua: a tag (skip reward), its sprite and popup, and the yep/nope
// animations when it triggers.
import { G, Sprite, Node, Event, UIBox, play_sound, copy_table, array_remove } from '@/shared/lib/engine';
import { localize } from '@/shared/lib/localization';
import { attention_text } from '@/shared/ui';
import { generate_card_ui, card_h_popup } from '@/entities/card/@x/tag';

export class Tag {
  key: string;
  config: any;
  pos: any;
  name: string;
  tally: number;
  triggered = false;
  ID: number;
  ability: any;
  hide_ability?: boolean;
  tag_sprite?: any;
  HUD_tag?: any;

  constructor(_tag: string, _for_collection?: boolean, _blind_type?: string, orbital_hand?: string | null) {
    this.key = _tag;
    const proto = G.P_TAGS[_tag] ?? G.tag_undiscovered;
    this.config = copy_table(proto.config);
    this.pos = proto.pos;
    this.name = proto.name;
    this.tally = G.GAME.tag_tally ?? 0;
    G.tagid = G.tagid ?? 0;
    this.ID = G.tagid;
    G.tagid += 1;
    this.ability = { orbital_hand: '[' + localize('k_poker_hand') + ']', blind_type: _blind_type };
    if (orbital_hand) this.ability.orbital_hand = orbital_hand;
    G.GAME.tag_tally = (G.GAME.tag_tally ?? 0) + 1;
  }

  nope() {
    G.E_MANAGER.add_event(new Event({
      delay: 0.2, trigger: 'after',
      func: () => {
        attention_text({ text: 'NOPE', colour: G.C.WHITE, scale: 0.7, hold: 0.3 / G.SETTINGS.GAMESPEED, cover: this.HUD_tag, cover_colour: G.C.BLACK, align: 'cm' });
        play_sound('cancel', 1.4, 0.5);
        return true;
      },
    }));
    G.E_MANAGER.add_event(new Event({ trigger: 'after', delay: 0.1, func: () => { this.HUD_tag.states.visible = false; play_sound('cancel', 1.26, 0.5); return true; } }));
    G.E_MANAGER.add_event(new Event({ trigger: 'after', delay: 0.5, func: () => { this.remove(); return true; } }));
  }

  yep(message: string, _colour?: any, func?: () => boolean) {
    G.E_MANAGER.add_event(new Event({
      delay: 0.4, trigger: 'after',
      func: () => {
        attention_text({ text: message, colour: G.C.WHITE, scale: 1, hold: 0.3 / G.SETTINGS.GAMESPEED, cover: this.HUD_tag, cover_colour: _colour ?? G.C.GREEN, align: 'cm' });
        play_sound('generic1', 0.9 + Math.random() * 0.1, 0.8);
        play_sound('holo1', 1.2 + Math.random() * 0.1, 0.4);
        return true;
      },
    }));
    G.E_MANAGER.add_event(new Event({ func: () => { if (this.HUD_tag) this.HUD_tag.states.visible = false; return true; } }));
    if (func) G.E_MANAGER.add_event(new Event({ func }));
    G.E_MANAGER.add_event(new Event({ trigger: 'after', delay: 0.7, func: () => { this.remove(); return true; } }));
  }

  juice_up(scale?: number, rot?: number) {
    if (this.tag_sprite) this.tag_sprite.juice_up(scale, rot);
  }

  generate_UI(_size = 0.8): [any, any] {
    const tag_sprite: any = new Sprite(0, 0, _size, _size, G.ASSET_ATLAS.tags, this.hide_ability ? G.tag_undiscovered.pos : this.pos);
    tag_sprite.T.scale = 1;
    const tab = { n: G.UIT.C, config: { align: 'cm', ref_table: this, group: this.tally }, nodes: [
      { n: G.UIT.O, config: { w: _size, h: _size, colour: G.C.BLUE, object: tag_sprite, focus_with_object: true } },
    ] };
    tag_sprite.define_draw_steps([{ shader: 'dissolve', shadow_height: 0.05 }, { shader: 'dissolve' }]);
    tag_sprite.float = true;
    tag_sprite.states.hover.can = true;
    tag_sprite.states.drag.can = false;
    tag_sprite.states.collide.can = true;
    tag_sprite.config = { tag: this, force_focus: true };
    tag_sprite.hover = (_self: any) => {
      _self = _self ?? tag_sprite;
      if (!G.CONTROLLER.dragging.target || G.CONTROLLER.using_touch) {
        if (!_self.hovering && _self.states.visible) {
          _self.hovering = true;
          if (_self === tag_sprite) {
            _self.hover_tilt = 3;
            _self.juice_up(0.05, 0.02);
            play_sound('paper1', Math.random() * 0.1 + 0.55, 0.42);
            play_sound('tarot2', Math.random() * 0.1 + 0.55, 0.09);
          }
          this.get_uibox_table(tag_sprite);
          _self.config.h_popup = card_h_popup(_self);
          _self.config.h_popup_config = { align: 'cl', offset: { x: -0.1, y: 0 }, parent: _self };
          Node.prototype.hover.call(_self);
        }
      }
    };
    tag_sprite.stop_hover = (_self: any) => {
      _self = _self ?? tag_sprite;
      _self.hovering = false;
      Node.prototype.stop_hover.call(_self);
      _self.hover_tilt = 0;
    };
    tag_sprite.juice_up();
    this.tag_sprite = tag_sprite;
    return [tab, tag_sprite];
  }

  get_uibox_table(tag_sprite?: any) {
    tag_sprite = tag_sprite ?? this.tag_sprite;
    let loc_vars: any[] = [];
    const c = this.config;
    switch (this.name) {
      case 'Investment Tag': loc_vars = [c.dollars]; break;
      case 'Handy Tag': loc_vars = [c.dollars_per_hand, c.dollars_per_hand * (G.GAME.hands_played ?? 0)]; break;
      case 'Garbage Tag': loc_vars = [c.dollars_per_discard, c.dollars_per_discard * (G.GAME.unused_discards ?? 0)]; break;
      case 'Juggle Tag': loc_vars = [c.h_size]; break;
      case 'Top-up Tag': loc_vars = [c.spawn_jokers]; break;
      case 'Skip Tag': loc_vars = [c.skip_bonus, c.skip_bonus * ((G.GAME.skips ?? 0) + 1)]; break;
      case 'Orbital Tag':
        loc_vars = [this.ability.orbital_hand === '[' + localize('k_poker_hand') + ']' ? this.ability.orbital_hand : localize(this.ability.orbital_hand, 'poker_hands'), c.levels];
        break;
      case 'Economy Tag': loc_vars = [c.max]; break;
      default: break;
    }
    tag_sprite.ability_UIBox_table = generate_card_ui(G.P_TAGS[this.key], null, loc_vars, this.hide_ability ? 'Undiscovered' : 'Tag', null, this.hide_ability);
    return tag_sprite;
  }

  remove_from_game() {
    array_remove(G.GAME.tags, this);
  }

  remove() {
    this.remove_from_game();
    const tags: any[] = G.HUD_tags ?? [];
    const i = tags.indexOf(this.HUD_tag);
    if (i >= 0) {
      if (tags[i + 1]) {
        if (i === 0) tags[i + 1].set_alignment({ type: 'bri', offset: { x: 0.7, y: 0 }, xy_bond: 'Weak', major: G.ROOM_ATTACH });
        else tags[i + 1].set_role({ xy_bond: 'Weak', major: tags[i - 1] });
      }
      tags.splice(i, 1);
    }
    this.HUD_tag?.remove();
  }
}

/** add_tag (UI_definitions.lua): shows a tag in the HUD's tag column */
export function add_tag(_tag: Tag) {
  G.HUD_tags = G.HUD_tags ?? [];
  const [ui] = _tag.generate_UI();
  const first = G.HUD_tags[0];
  G.HUD_tags.push(new UIBox({
    definition: { n: G.UIT.ROOT, config: { align: 'cm', padding: 0.05, colour: G.C.CLEAR }, nodes: [ui] },
    config: {
      align: first ? 'tm' : 'bri',
      offset: first ? { x: 0, y: 0 } : { x: 0.7, y: 0 },
      major: first ? G.HUD_tags[G.HUD_tags.length - 1] : G.ROOM_ATTACH,
    },
  }));
  G.GAME.tags.push(_tag);
  _tag.HUD_tag = G.HUD_tags[G.HUD_tags.length - 1];
}

/** the colour of a tag's '+' when it triggers (Tag:apply_to_run's yep calls) */
export function tag_colour(name: string) {
  const C = G.C;
  switch (name) {
    case 'Investment Tag': return C.GOLD;
    case 'Top-up Tag': case 'Charm Tag': return C.PURPLE;
    case 'Skip Tag': case 'Garbage Tag': case 'Handy Tag': case 'Economy Tag': case 'Orbital Tag': return C.MONEY;
    case 'Meteor Tag': return C.SECONDARY_SET.Planet;
    case 'Ethereal Tag': case 'Standard Tag': case 'Buffoon Tag': return C.SECONDARY_SET.Spectral;
    case 'Boss Tag': case 'Uncommon Tag': case 'D6 Tag': return C.GREEN;
    case 'Voucher Tag': return C.SECONDARY_SET.Voucher;
    case 'Double Tag': case 'Juggle Tag': return C.BLUE;
    case 'Rare Tag': return C.RED;
    case 'Foil Tag': case 'Holographic Tag': case 'Polychrome Tag': case 'Negative Tag': return C.DARK_EDITION;
    case 'Coupon Tag': return C.GREEN;
    default: return C.GREEN;
  }
}

/**
 * Brings the HUD's tags in line with the API's list: a tag that is gone
 * triggered (its '+' shows, then it leaves), a tag that is new is added.
 * With `types`, only tags of those kinds (Tag:apply_to_run's context type:
 * 'eval', 'shop_start'...) can trigger, and none is added.
 */
export function react_tags(views: { key: string; orbital_hand: string | null }[], func_of?: (tag: Tag) => (() => boolean) | undefined, types?: string[]) {
  const current: Tag[] = [...(G.GAME.tags ?? [])];
  const left = [...views];
  const kept = new Set<Tag>();
  for (const t of current) {
    const i = left.findIndex((v) => v.key === t.key);
    if (i >= 0) { kept.add(t); left.splice(i, 1); }
  }
  for (const t of current) {
    if (kept.has(t) || t.triggered) continue;
    if (types && !types.includes(t.config.type)) continue;
    t.triggered = true;
    t.yep('+', tag_colour(t.name), func_of?.(t) ?? (() => true));
  }
  if (!types) for (const v of left) add_tag(new Tag(v.key, false, undefined, v.orbital_hand));
}
