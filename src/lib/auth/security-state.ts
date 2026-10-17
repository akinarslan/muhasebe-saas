export const STEP_UP_MS = 5 * 60 * 1000;
export function stepUpExpiresAt(
  value: Date | null | undefined,
  now = Date.now(),
) {
  if (!value || value.getTime() > now || now >= value.getTime() + STEP_UP_MS)
    return null;
  return new Date(value.getTime() + STEP_UP_MS);
}
export function invitationState(
  invitation:
    | { acceptedAt: Date | null; revokedAt: Date | null; expiresAt: Date }
    | undefined,
  now = Date.now(),
) {
  if (!invitation) return "NONE";
  if (invitation.acceptedAt) return "ACCEPTED";
  if (invitation.revokedAt) return "CANCELLED";
  if (invitation.expiresAt.getTime() <= now) return "EXPIRED";
  return "PENDING";
}
