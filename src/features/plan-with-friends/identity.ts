/**
 * Who is using the trip room. Guests today; when the app gets login, implement
 * IdentityProvider for it and assign it to `identity` below. Nothing else changes.
 */
export interface SessionUser {
  userId: string;
  name: string;
  photoUrl: string | null;
}

export interface IdentityProvider {
  /** Server side: the signed-in user for this request, or null for a guest. */
  current(request: Request): Promise<SessionUser | null>;
  /** Client side: where to send someone to sign in, or null when sign-in isn't required. */
  loginUrl(returnTo: string): string | null;
}

export const guestIdentity: IdentityProvider = {
  current: async () => null,
  loginUrl: () => null,
};

export const identity: IdentityProvider = guestIdentity;
