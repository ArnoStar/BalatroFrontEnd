// Before the game starts: with sign-in on (the API's /health says
// auth: "required"), a player without a session goes to the portal's sign-in
// page and comes back here. Without sign-in (development, the frame-by-frame
// tools) nothing changes.
import { G } from '@/shared/lib/engine';
import { api, access_token, display_name, go_to_sign_in } from '@/shared/api';

export async function ensure_signed_in() {
  let required = false;
  try {
    required = (await api.health()).auth === 'required';
  } catch {
    return; // the API is down: the game shows its errors as before
  }
  if (required && !(await access_token())) go_to_sign_in();
}

/** the main menu's PROFILE button shows the account's display name */
export function name_profile() {
  const name = display_name();
  const p = G.PROFILES?.[(G.SETTINGS.profile ?? 1) - 1];
  if (name && p) p.name = name;
}
