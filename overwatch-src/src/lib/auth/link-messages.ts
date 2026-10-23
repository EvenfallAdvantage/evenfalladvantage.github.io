/**
 * Message shown when an invite / reset link can't establish a session.
 * Invite links are single-use and expire (24 h, matching roster_invitations
 * and the Auth email OTP expiry), so invitees must ask an admin to resend
 * rather than use "forgot password" (which only works once an account exists).
 */
export function expiredLinkMessage(isInviteFlow: boolean): string {
  return isInviteFlow
    ? "This invite link has expired or was already used. Ask your company admin to resend your invite."
    : "Reset link expired or invalid. Please request a new one.";
}
