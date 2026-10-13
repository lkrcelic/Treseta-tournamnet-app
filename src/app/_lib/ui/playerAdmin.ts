// "Uredi osobne podatke" (admin, desktop, handoff §6 "Admin controls", design 13j): the form's fields, what Spremi
// sends and what is wrong with it before it is sent. Framework free so it can be unit tested.
import {ADMIN_PLAYER_FIELDS, AdminPlayerField, AdminPlayerUpdateRequest, AdminPlayerUpdateValidation, BIRTH_DATE_ERROR, PlayerView} from "@/app/_interfaces/player";
import {normalizePhone} from "@/app/_lib/phone";
import {normalizeUsername} from "@/app/_lib/validation/username";

// The fields as typed: text for the inputs ("" = empty; the birth date as the date input gives it, YYYY-MM-DD) and
// the two switches
export type PlayerDraft = {
  first_name: string;
  last_name: string;
  username: string;
  email: string;
  phone: string;
  birth_date: string;
  smoker: boolean;
  is_admin: boolean;
};

// The form as it opens: the player's details as an admin sees them (every key is there for an admin)
export function playerDraft(p: PlayerView): PlayerDraft {
  return {
    first_name: p.first_name ?? "",
    last_name: p.last_name ?? "",
    username: p.username ?? "",
    email: p.email ?? "",
    phone: p.phone ?? "",
    birth_date: p.birth_date ?? "",
    smoker: p.smoker === true,
    is_admin: p.is_admin === true,
  };
}

// The phone as the server would store it, to tell a real change from the same number typed another way
// ("091 234 5678" is the stored "+385 91 234 5678")
const samePhone = (typed: string, stored: string) => (normalizePhone(typed) ?? typed.trim()) === (normalizePhone(stored) ?? stored.trim());

/**
 * What Spremi sends: only the fields that differ from the form as it opened (`from`), so a field the admin didn't
 * touch is never sent (an old username that breaks today's rules stays as it is). An empty phone or birth date is
 * null (removes it). Spaces around the names, the username and the email don't count as a change.
 */
export function draftChanges(from: PlayerDraft, to: PlayerDraft): AdminPlayerUpdateRequest {
  const changes: AdminPlayerUpdateRequest = {};
  if (to.first_name.trim() !== from.first_name.trim()) changes.first_name = to.first_name;
  if (to.last_name.trim() !== from.last_name.trim()) changes.last_name = to.last_name;
  if (normalizeUsername(to.username) !== normalizeUsername(from.username)) changes.username = to.username;
  if (to.email.trim() !== from.email.trim()) changes.email = to.email;
  if (!samePhone(to.phone, from.phone)) changes.phone = to.phone.trim() ? to.phone : null;
  if (to.birth_date !== from.birth_date) changes.birth_date = to.birth_date || null;
  if (to.smoker !== from.smoker) changes.smoker = to.smoker;
  if (to.is_admin !== from.is_admin) changes.is_admin = to.is_admin;
  return changes;
}

export const hasChanges = (changes: AdminPlayerUpdateRequest) => Object.keys(changes).length > 0;

/**
 * What is wrong with the changes, per field, with the server's own words (the same rules as
 * PATCH /api/admin/players/[id]): checked before Spremi sends anything. Whether a username or an email is taken only
 * the server knows (its 409 comes back the same way, playerFieldErrors).
 *
 * birthDateIncomplete: the date input holds a date that isn't whole ("dd.01.1993.", or no such day). The input then
 * gives "" as its value, which would remove the stored date: that is an error, not a removal. Only a date input
 * emptied of every part removes it.
 */
export function draftErrors(
  changes: AdminPlayerUpdateRequest,
  {birthDateIncomplete = false}: {birthDateIncomplete?: boolean} = {}
): Partial<Record<AdminPlayerField, string>> {
  const errors: Partial<Record<AdminPlayerField, string>> = {};
  if (hasChanges(changes)) {
    const result = AdminPlayerUpdateValidation.safeParse(changes);
    for (const issue of result.success ? [] : result.error.issues) {
      const field = issue.path[0];
      if (ADMIN_PLAYER_FIELDS.includes(field as AdminPlayerField)) errors[field as AdminPlayerField] ??= issue.message;
    }
  }
  if (birthDateIncomplete) errors.birth_date = BIRTH_DATE_ERROR;
  return errors;
}

// The first field of the panel with a message, for the focus
export function firstErrorField(errors: Partial<Record<AdminPlayerField, string>>): AdminPlayerField | null {
  return ADMIN_PLAYER_FIELDS.find((f) => errors[f]) ?? null;
}
