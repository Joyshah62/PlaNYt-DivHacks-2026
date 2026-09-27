import { identity as activeIdentity, type IdentityProvider, type SessionUser } from "../identity";

export function memberIdFor(userId: string): string {
  return `u_${userId.replace(/[^A-Za-z0-9_-]/g, "")}`.slice(0, 40);
}

/** A signed-in user always acts as themselves; guests are whoever their saved member id says. */
export async function resolveMember(
  request: Request,
  bodyMemberId: string | undefined,
  provider: IdentityProvider = activeIdentity,
): Promise<{ memberId: string | undefined; user: SessionUser | null }> {
  const user = await provider.current(request);
  return user ? { memberId: memberIdFor(user.userId), user } : { memberId: bodyMemberId, user: null };
}
