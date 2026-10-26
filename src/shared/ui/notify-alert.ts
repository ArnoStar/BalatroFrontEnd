// notify_alert (common_events.lua) and create_UIBox_notify_alert
// (UI_definitions.lua): the "Unlocked!" notification that slides in from the
// right for a joker, voucher or deck the player has just unlocked.
import { G, UIBox, Sprite, Event, play_sound } from '@/shared/lib/engine';
import { localize } from '@/shared/lib/localization';

function create_UIBox_notify_alert(key: string, type: string) {
  const c = G.P_CENTERS[key];
  const atlas = type === 'Joker' ? G.ASSET_ATLAS.Joker : type === 'Voucher' ? G.ASSET_ATLAS.Voucher
    : type === 'Back' ? G.ASSET_ATLAS.centers : G.ASSET_ATLAS.icons;
  const t_s = new Sprite(0, 0, 1.5 * (atlas.px / atlas.py), 1.5, atlas, c?.pos ?? { x: 3, y: 0 });
  t_s.states.drag.can = false;
  t_s.states.hover.can = false;
  t_s.states.collide.can = false;
  let subtext = type === 'Joker' ? localize('k_joker') : type === 'Voucher' ? localize('k_voucher') : type === 'Back' ? localize('k_deck') : 'ERROR';
  if (key === 'b_challenge') subtext = localize('k_challenges');
  return { n: G.UIT.ROOT, config: { align: 'cl', r: 0.1, padding: 0.06, colour: G.C.UI.TRANSPARENT_DARK }, nodes: [
    { n: G.UIT.R, config: { align: 'cl', padding: 0.2, minw: 20, r: 0.1, colour: G.C.BLACK, outline: 1.5, outline_colour: G.C.GREY }, nodes: [
      { n: G.UIT.R, config: { align: 'cm', r: 0.1 }, nodes: [
        { n: G.UIT.R, config: { align: 'cm', r: 0.1 }, nodes: [{ n: G.UIT.O, config: { object: t_s } }] },
        { n: G.UIT.R, config: { align: 'cm', padding: 0.04 }, nodes: [
          { n: G.UIT.R, config: { align: 'cm', maxw: 3.4 }, nodes: [{ n: G.UIT.T, config: { text: subtext, scale: 0.5, colour: G.C.FILTER, shadow: true } }] },
          { n: G.UIT.R, config: { align: 'cm', maxw: 3.4 }, nodes: [{ n: G.UIT.T, config: { text: localize('k_unlocked_ex'), scale: 0.35, colour: G.C.FILTER, shadow: true } }] },
        ] },
      ] },
    ] },
  ] };
}

export function notify_alert(key: string, type: string) {
  const ev = (cfg: any) => G.E_MANAGER.add_event(new Event({ no_delete: true, pause_force: true, timer: 'UPTIME', ...cfg }), 'achievement');
  ev({
    func: () => {
      if (G.achievement_notification) { G.achievement_notification.remove(); G.achievement_notification = null; }
      G.achievement_notification = new UIBox({
        definition: create_UIBox_notify_alert(key, type),
        config: { align: 'cr', offset: { x: 20, y: 0 }, major: G.ROOM_ATTACH, bond: 'Weak' },
      });
      return true;
    },
  });
  ev({
    trigger: 'after', delay: 0.1,
    func: () => {
      const n = G.achievement_notification;
      if (n) n.alignment.offset.x = G.ROOM.T.x - n.UIRoot.children[0].children[0].T.w - 0.8;
      return true;
    },
  });
  ev({ trigger: 'after', delay: 0.1, func: () => { play_sound('highlight1', undefined, 0.5); play_sound('foil2', 0.5, 0.4); return true; } });
  ev({ trigger: 'after', delay: 3, func: () => { if (G.achievement_notification) G.achievement_notification.alignment.offset.x = 20; return true; } });
  ev({ trigger: 'after', delay: 0.5, func: () => { if (G.achievement_notification) { G.achievement_notification.remove(); G.achievement_notification = null; } return true; } });
}
