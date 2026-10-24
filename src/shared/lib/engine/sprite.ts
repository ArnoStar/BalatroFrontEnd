// engine/sprite.lua and engine/animatedsprite.lua
import { G } from './globals';
import { love } from '../love';
import type { Quad } from '../love';
import { Moveable } from './moveable';
import { add_to_drawhash, prep_draw, array_remove, each, math_random } from './util';

export interface Atlas { name: string; image: any; px: number; py: number; frames?: number; type?: string }

export interface DrawStep {
  shader: string; shadow_height?: number; send?: any; no_tilt?: boolean; other_obj?: any;
  ms?: number; mr?: number; mx?: number; my?: number;
}

export class Sprite extends Moveable {
  atlas!: Atlas;
  scale!: { x: number; y: number };
  scale_mag!: number;
  zoom!: boolean;
  sprite_pos!: { x: number; y: number };
  sprite_pos_copy!: { x: number; y: number };
  sprite!: Quad;
  image_dims!: [number, number];
  draw_steps?: DrawStep[];
  video?: any;

  constructor(...args: any[]) {
    super();
    if (args.length) this.init_sprite(args[0], args[1], args[2], args[3], args[4], args[5]);
  }

  init_sprite(X: number, Y: number, W: number, H: number, atlas: Atlas, sprite_pos?: any) {
    this.init_moveable(X, Y, W, H);
    this.CT = this.VT;
    this.atlas = atlas;
    this.scale = { x: this.atlas.px, y: this.atlas.py };
    this.scale_mag = Math.min(this.scale.x / W, this.scale.y / H);
    this.zoom = true;
    this.set_sprite_pos(sprite_pos);
    if (Object.getPrototypeOf(this) === Sprite.prototype) G.I.SPRITE.push(this);
  }

  reset() {
    this.atlas = G.ASSET_ATLAS[this.atlas.name];
    this.set_sprite_pos(this.sprite_pos);
  }

  set_sprite_pos(sprite_pos?: any) {
    if (sprite_pos && sprite_pos.v) this.sprite_pos = { x: math_random(sprite_pos.v) - 1, y: sprite_pos.y };
    else this.sprite_pos = sprite_pos ?? { x: 0, y: 0 };
    this.sprite_pos_copy = { x: this.sprite_pos.x, y: this.sprite_pos.y };
    const [iw, ih] = this.atlas.image.getDimensions();
    this.sprite = love.graphics.newQuad(this.sprite_pos.x * this.atlas.px, this.sprite_pos.y * this.atlas.py, this.scale.x, this.scale.y, iw, ih);
    this.image_dims = [iw, ih];
  }

  get_pos_pixel(): number[] {
    this.RETS.get_pos_pixel = this.RETS.get_pos_pixel ?? [];
    const r = this.RETS.get_pos_pixel;
    r[0] = this.sprite_pos.x; r[1] = this.sprite_pos.y; r[2] = this.atlas.px; r[3] = this.atlas.py;
    return r;
  }

  get_image_dims() { return this.image_dims; }

  define_draw_steps(defs: DrawStep[]) {
    this.draw_steps = defs.map((v) => ({
      shader: v.shader ?? 'dissolve', shadow_height: v.shadow_height, send: v.send, no_tilt: v.no_tilt,
      other_obj: v.other_obj, ms: v.ms, mr: v.mr, mx: v.mx, my: v.my,
    }));
  }

  draw_shader(_shader: string, _shadow_height?: number | null, _send?: any, _no_tilt?: boolean | null, other_obj?: any,
    ms?: number, mr?: number, mx?: number, my?: number, custom_shader?: boolean, tilt_shadow?: number) {
    if (G.SETTINGS.reduced_motion) _no_tilt = true;
    const dm = this.role.draw_major ?? this;
    if (_shadow_height) {
      this.VT.y = this.VT.y - dm.shadow_parrallax.y * _shadow_height;
      this.VT.x = this.VT.x - dm.shadow_parrallax.x * _shadow_height;
      this.VT.scale = this.VT.scale * (1 - 0.2 * _shadow_height);
    }
    const name = _shader ?? 'dissolve';
    const S = G.SHADERS[name];
    if (custom_shader) {
      if (_send) {
        for (const v of _send) S.send(v.name, v.val ?? (v.func ? v.func() : undefined) ?? v.ref_table[v.ref_value]);
      }
    } else if (_shader === 'vortex') {
      S.send('vortex_amt', G.TIMERS.REAL - (G.vortex_time ?? 0));
    } else {
      const cursor = [
        dm.tilt_var ? dm.tilt_var.mx * G.CANV_SCALE : G.CONTROLLER.cursor_position.x * G.CANV_SCALE,
        dm.tilt_var ? dm.tilt_var.my * G.CANV_SCALE : G.CONTROLLER.cursor_position.y * G.CANV_SCALE,
      ];
      S.send('mouse_screen_pos', cursor);
      S.send('screen_scale', G.TILESCALE * G.TILESIZE * (dm.mouse_damping ?? 1) * G.CANV_SCALE);
      S.send('hovering', ((_shadow_height && !tilt_shadow) || _no_tilt) ? 0 : (dm.hover_tilt ?? 0) * (tilt_shadow ?? 1));
      S.send('dissolve', Math.abs(dm.dissolve ?? 0));
      S.send('time', (123.33412 * (dm.ID / 1.14212)) % 3000);
      S.send('texture_details', this.get_pos_pixel());
      S.send('image_details', this.get_image_dims());
      S.send('burn_colour_1', dm.dissolve_colours ? dm.dissolve_colours[0] : G.C.CLEAR);
      S.send('burn_colour_2', dm.dissolve_colours ? dm.dissolve_colours[1] : G.C.CLEAR);
      S.send('shadow', !!_shadow_height);
      if (_send) S.send(name, _send);
    }
    love.graphics.setShader(S);
    if (other_obj) this.draw_from(other_obj, ms, mr, mx, my);
    else this.draw_self();
    love.graphics.setShader();
    if (_shadow_height) {
      this.VT.y = this.VT.y + dm.shadow_parrallax.y * _shadow_height;
      this.VT.x = this.VT.x + dm.shadow_parrallax.x * _shadow_height;
      this.VT.scale = this.VT.scale / (1 - 0.2 * _shadow_height);
    }
  }

  draw_self(overlay?: any) {
    if (!this.states.visible) return;
    if (this.sprite_pos.x !== this.sprite_pos_copy.x || this.sprite_pos.y !== this.sprite_pos_copy.y) this.set_sprite_pos(this.sprite_pos);
    prep_draw(this, 1);
    const g = love.graphics;
    g.scale(1 / (this.scale.x / this.VT.w), 1 / (this.scale.y / this.VT.h));
    g.setColor(overlay ?? G.BRUTE_OVERLAY ?? G.C.WHITE);
    g.draw(this.atlas.image, this.sprite, 0, 0, 0, this.VT.w / this.T.w, this.VT.h / this.T.h);
    g.pop();
    add_to_drawhash(this);
    this.draw_boundingrect();
    if (this.shader_tab) g.setShader();
  }

  draw(overlay?: any) {
    if (!this.states.visible) return;
    if (this.draw_steps) {
      for (const v of this.draw_steps) {
        this.draw_shader(v.shader, v.shadow_height, v.send, v.no_tilt, v.other_obj, v.ms, v.mr, v.mx, v.my, !!v.send);
      }
    } else {
      this.draw_self(overlay);
    }
    add_to_drawhash(this);
    each(this.children, (v, k) => { if (k !== 'h_popup') v.draw(); });
    add_to_drawhash(this);
    this.draw_boundingrect();
  }

  draw_from(other_obj: any, ms?: number, mr?: number, mx?: number, my?: number) {
    prep_draw(other_obj, 1 + (ms ?? 0), mr ?? 0, { x: mx ?? 0, y: my ?? 0 });
    const g = love.graphics;
    g.scale(1 / (other_obj.scale_mag ?? other_obj.VT.scale));
    g.setColor(G.BRUTE_OVERLAY ?? G.C.WHITE);
    g.draw(this.atlas.image, this.sprite, -(other_obj.T.w / 2 - other_obj.VT.w / 2) * 10, 0, 0,
      other_obj.VT.w / other_obj.T.w, other_obj.VT.h / other_obj.T.h);
    this.draw_boundingrect();
    g.pop();
  }

  remove() {
    array_remove(G.ANIMATIONS, this);
    array_remove(G.I.SPRITE, this);
    super.remove();
  }
}

export class AnimatedSprite extends Sprite {
  animation!: any;
  current_animation!: any;
  frame_offset!: number;
  offset_seconds!: number;
  float?: boolean;

  constructor(...args: any[]) {
    super();
    if (args.length) this.init_animated_sprite(args[0], args[1], args[2], args[3], args[4], args[5]);
  }

  init_animated_sprite(X: number, Y: number, W: number, H: number, atlas: Atlas, sprite_pos?: any) {
    this.init_sprite(X, Y, W, H, atlas, sprite_pos);
    this.offset = { x: 0, y: 0 };
    G.ANIMATIONS.push(this);
    if (Object.getPrototypeOf(this) === AnimatedSprite.prototype) G.I.SPRITE.push(this);
  }

  rescale() {
    this.scale_mag = Math.min(this.scale.x / this.T.w, this.scale.y / this.T.h);
  }

  reset() {
    this.atlas = G.ANIMATION_ATLAS[this.atlas.name];
    this.set_sprite_pos({ x: this.animation.x, y: this.animation.y });
  }

  set_sprite_pos(sprite_pos?: any) {
    this.animation = {
      x: sprite_pos?.x ?? 0, y: sprite_pos?.y ?? 0,
      frames: this.atlas.frames, current: 0, w: this.scale.x, h: this.scale.y,
    };
    this.frame_offset = 0;
    this.current_animation = { current: 0, frames: this.animation.frames, w: this.animation.w, h: this.animation.h };
    const [iw, ih] = this.atlas.image.getDimensions();
    this.image_dims = [iw, ih];
    this.sprite = love.graphics.newQuad(0, this.animation.h * this.animation.y, this.animation.w, this.animation.h, iw, ih);
    this.offset_seconds = G.TIMERS.REAL;
    // sprite_pos as used by Sprite:draw_self's change check
    this.sprite_pos = { x: this.animation.x, y: this.animation.y };
    this.sprite_pos_copy = { x: this.animation.x, y: this.animation.y };
  }

  get_pos_pixel(): number[] {
    this.RETS.get_pos_pixel = this.RETS.get_pos_pixel ?? [];
    const r = this.RETS.get_pos_pixel;
    r[0] = this.current_animation.current; r[1] = this.animation.y; r[2] = this.animation.w; r[3] = this.animation.h;
    return r;
  }

  draw_self() {
    if (!this.states.visible) return;
    prep_draw(this, 1);
    const g = love.graphics;
    g.scale(1 / this.scale_mag);
    g.setColor(G.C.WHITE);
    g.draw(this.atlas.image, this.sprite, 0, 0, 0, this.VT.w / this.T.w, this.VT.h / this.T.h);
    g.pop();
  }

  animate() {
    const new_frame = Math.floor(G.ANIMATION_FPS * (G.TIMERS.REAL - this.offset_seconds)) % this.current_animation.frames;
    if (new_frame !== this.current_animation.current) {
      this.current_animation.current = new_frame;
      this.frame_offset = Math.floor(this.animation.w * this.current_animation.current);
      this.sprite.setViewport(this.frame_offset, this.animation.h * this.animation.y, this.animation.w, this.animation.h);
    }
    if (this.float) {
      this.T.r = 0.02 * Math.sin(2 * G.TIMERS.REAL + this.T.x);
      this.offset.y = -(1 + 0.3 * Math.sin(0.666 * G.TIMERS.REAL + this.T.y)) * this.shadow_parrallax.y;
      this.offset.x = -(0.7 + 0.2 * Math.sin(0.666 * G.TIMERS.REAL + this.T.x)) * this.shadow_parrallax.x;
    }
  }

  remove() {
    // as in the game: `table.remove(t, k)` with an undefined k drops the last
    // entry (another animation stops), then Sprite:remove drops this one
    if (G.ANIMATIONS.includes(this)) G.ANIMATIONS.pop();
    if (G.I.SPRITE.includes(this)) G.I.SPRITE.pop();
    super.remove();
  }
}
