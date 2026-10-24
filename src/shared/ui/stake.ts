// get_stake_sprite and get_stake_col (misc_functions.lua).
import { G, Sprite } from '@/shared/lib/engine';

export function get_stake_sprite(_stake?: number, _scale?: number) {
  _stake = _stake || 1;
  _scale = _scale || 1;
  const stake_sprite: any = new Sprite(0, 0, _scale * 1, _scale * 1, G.ASSET_ATLAS.chips, G.P_CENTER_POOLS.Stake[_stake - 1].pos);
  stake_sprite.states.drag.can = false;
  if (_stake === 8) {
    stake_sprite.draw = function (this: any) {
      this.ARGS.send_to_shader = this.ARGS.send_to_shader ?? [];
      this.ARGS.send_to_shader[0] = Math.min(this.VT.r * 3, 1) + G.TIMERS.REAL / 18 + (this.juice ? this.juice.r * 20 : 0) + 1;
      this.ARGS.send_to_shader[1] = G.TIMERS.REAL;
      Sprite.prototype.draw_shader.call(this, 'dissolve');
      Sprite.prototype.draw_shader.call(this, 'voucher', null, this.ARGS.send_to_shader);
    };
  }
  return stake_sprite;
}

export function get_stake_col(_stake: number) {
  G.C.STAKES = G.C.STAKES ?? [G.C.WHITE, G.C.RED, G.C.GREEN, G.C.BLACK, G.C.BLUE, G.C.PURPLE, G.C.ORANGE, G.C.GOLD];
  return G.C.STAKES[_stake - 1];
}
