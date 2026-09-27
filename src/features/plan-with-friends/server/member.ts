import { type IdentityProvider, type SessionUser } from "../identity";
import { accountIdentity } from "../bridge/server";
import { TripError } from "./service";

export function memberIdFor(userId: string): string {
  return `u_${userId.replace(/[^A-Za-z0-9_-]/g, "")}`.slice(0, 40);
}

/** Only an account's own session speaks for it: a request can't claim a signed-in member's id. */
const isAccountMember = (memberId: string | undefined) => !!memberId?.startsWith("u_");

/**
 * Who a request acts as. A signed-in user always acts as themselves. Without
 * a session, a provider that has a sign-in page (Roam accounts) turns the
 * request away; a guest-only provider trusts the saved member id, except one
 * that belongs to an account.
 */
export async function resolveMember(
  request: Request,
  bodyMemberId: string | undefined,
  provider: IdentityProvider = accountIdentity,
): Promise<{ memberId: string | undefined; user: SessionUser | null }> {
  const user = await provider.current(request);
  if (user) return { memberId: memberIdFor(user.userId), user };
  if (provider.loginUrl("/") !== null) throw new TripError(401, "Sign in to take part in this trip.");
  return { memberId: isAccountMember(bodyMemberId) ? undefined : bodyMemberId, user: null };
}

/** The member a change is made as; a request that isn't anyone in particular is told to join first. */
export async function actingMember(request: Request, claimed: string | undefined, provider: IdentityProvider = accountIdentity): Promise<string> {
  const { memberId } = await resolveMember(request, claimed, provider);
  if (!memberId) throw new TripError(403, "Join the trip first.");
  return memberId;
}
