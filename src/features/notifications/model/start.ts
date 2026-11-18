// Notifications for a signed-in player: the bell and the pop-ups, fed by the
// social service's event stream (features/notifications).
import { social_api } from '@/shared/api';
import { show_bell } from '../ui/bell';
import { start_inbox } from './inbox';

export async function start_notifications() {
  if (!(await social_api.signed_in())) return; // (the social service is for players with an account)
  show_bell();
  start_inbox();
}
