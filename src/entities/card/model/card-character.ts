// card_character.lua: Jimbo, the joker who talks (game over, win, tutorial).
import { G, Moveable, Node, Particles, UIBox, Event, play_sound, add_to_drawhash, remove_all, array_remove, math_random } from '@/shared/lib/engine';
import { localize } from '@/shared/lib/localization';
import { Card } from './card';

/** G.UIDEF.speech_bubble (UI_definitions.lua) */
export function speech_bubble(text_key?: string, loc_vars?: any) {
  const text: any[] = [];
  if (loc_vars && loc_vars.quip) localize({ type: 'quips', key: text_key ?? 'lq_1', vars: loc_vars ?? {}, nodes: text });
  else localize({ type: 'tutorial', key: text_key ?? 'sb_1', vars: loc_vars ?? {}, nodes: text });
  const row = text.map((v) => ({ n: G.UIT.R, config: { align: 'cl' }, nodes: v }));
  return { n: G.UIT.ROOT, config: { align: 'cm', minh: 1, r: 0.3, padding: 0.07, minw: 1, colour: G.C.JOKER_GREY, shadow: true }, nodes: [
    { n: G.UIT.C, config: { align: 'cm', minh: 1, r: 0.2, padding: 0.1, minw: 1, colour: G.C.WHITE }, nodes: [
      { n: G.UIT.C, config: { align: 'cm', minh: 1, r: 0.2, padding: 0.03, minw: 1, colour: G.C.WHITE }, nodes: row },
    ] },
  ] };
}

export class Card_Character extends Moveable {
  talking?: boolean;
  last_said?: number;
  highlight?: any;

  constructor(args: { x?: number; y?: number; w?: number; h?: number; center?: any } = {}) {
    super(args.x ?? 1, args.y ?? 1, args.w ?? G.CARD_W * 1.1, args.h ?? G.CARD_H * 1.1);
    this.states.collide.can = false;
    this.children = {};
    this.config = { args };
    const card: any = new Card(this.T.x, this.T.y, G.CARD_W, G.CARD_H, G.P_CARDS.empty, args.center ?? G.P_CENTERS.j_joker, { bypass_discovery_center: true });
    this.children.card = card;
    card.states.visible = false;
    card.start_materialize([G.C.BLUE, G.C.WHITE, G.C.RED]);
    card.set_alignment({ major: this, type: 'cm', offset: { x: 0, y: 0 } });
    card.jimbo = this;
    card.states.collide.can = true;
    card.states.focus.can = false;
    card.states.hover.can = true;
    card.states.drag.can = false;
    card.hover = Node.prototype.hover;
    this.children.particles = new Particles(0, 0, 0, 0, {
      timer: 0.03, scale: 0.3, speed: 1.2, lifespan: 2, attach: this, colours: [G.C.RED, G.C.BLUE, G.C.ORANGE], fill: true,
    });
    this.children.particles.static_rotation = true;
    this.children.particles.set_role({ role_type: 'Minor', xy_bond: 'Weak', r_bond: 'Strong', major: this });
    if (Object.getPrototypeOf(this) === Card_Character.prototype) G.I.CARD.push(this);
  }

  hard_set_VT() {
    this.align_to_major();
    super.hard_set_VT();
    this.align();
    this.children.card.hard_set_VT();
  }

  align() {
    const card = this.children.card;
    if (card) {
      card.T.x = this.T.x + (this.T.w - card.T.w) / 2;
      card.T.y = this.T.y + (this.T.h - card.T.h) / 2;
    }
  }

  add_speech_bubble(text_key: string, align?: string, loc_vars?: any) {
    if (this.children.speech_bubble) this.children.speech_bubble.remove();
    this.config.speech_bubble_align = { align: align ?? 'bm', offset: { x: 0, y: 0 }, parent: this };
    this.children.speech_bubble = new UIBox({ definition: speech_bubble(text_key, loc_vars), config: this.config.speech_bubble_align });
    this.children.speech_bubble.set_role({ role_type: 'Minor', xy_bond: 'Weak', r_bond: 'Strong', major: this });
    this.children.speech_bubble.states.visible = false;
  }

  remove_speech_bubble() {
    if (this.children.speech_bubble) { this.children.speech_bubble.remove(); this.children.speech_bubble = null; }
  }

  say_stuff(n: number, not_first?: boolean) {
    this.talking = true;
    if (!not_first) {
      G.E_MANAGER.add_event(new Event({
        trigger: 'after', delay: 0.1,
        func: () => {
          if (this.children.speech_bubble) this.children.speech_bubble.states.visible = true;
          this.say_stuff(n, true);
          return true;
        },
      }));
    } else {
      if (n <= 0) { this.talking = false; return; }
      let new_said = math_random(1, 11);
      while (new_said === this.last_said) new_said = math_random(1, 11);
      this.last_said = new_said;
      play_sound('voice' + math_random(1, 11), G.SPEEDFACTOR * (Math.random() * 0.2 + 1), 0.5);
      this.children.card.juice_up();
      G.E_MANAGER.add_event(new Event({
        trigger: 'after', blockable: false, blocking: false, delay: 0.13,
        func: () => { this.say_stuff(n - 1, true); return true; },
      }), 'tutorial');
    }
  }

  draw() {
    if (this.children.particles) this.children.particles.draw();
    if (this.children.speech_bubble) this.children.speech_bubble.draw();
    if (this.children.button && !this.talking) this.children.button.draw();
    if (this.children.card) this.children.card.draw();
    add_to_drawhash(this);
    this.draw_boundingrect();
  }

  remove() {
    G.jimboed = null;
    remove_all(this.children);
    array_remove(G.I.CARD, this);
    super.remove();
  }
}
