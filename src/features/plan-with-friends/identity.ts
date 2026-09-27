/**
 * Who is using the trip room. The app runs on PlaNYt accounts: see
 * `accountIdentity` in bridge/server, which server/member.ts uses, and the
 * trip pages, which require sign-in. `guestIdentity` is the no-login mode
 * (and what the tests use).
 */
export interface SessionUser {
  userId: string;
  name: string;
  photoUrl: string | null;
}

export interface IdentityProvider {
  /** Server side: the signed-in user for this request, or null for a guest. */
  current(request: Request): Promise<SessionUser | null>;
  /** Where to send someone to sign in, or null when sign-in isn't required. */
  loginUrl(returnTo: string): string | null;
}

export const guestIdentity: IdentityProvider = {
  current: async () => null,
  loginUrl: () => null,
};
