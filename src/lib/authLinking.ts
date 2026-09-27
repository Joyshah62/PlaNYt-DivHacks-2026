type Adapter = {
  findUserById: (id: string) => Promise<{ emailVerified?: boolean } | null>;
  findAccounts: (userId: string) => Promise<{ id: string; providerId: string }[]>;
  deleteAccount: (id: string) => Promise<void>;
  deleteUserSessions: (userId: string) => Promise<void>;
};

/**
 * Google just joined an existing account whose email was never verified. Google proves the email is
 * theirs, but the password on that account might have been set by whoever registered it first. So
 * the unverified password goes and every other session signs out; from now on they sign in with
 * Google. Runs before Google marks the email verified, and before the new session is made.
 */
export async function secureLinkedAccount(userId: string, adapter: Adapter) {
  const user = await adapter.findUserById(userId);
  if (!user || user.emailVerified) return;
  const passwords = (await adapter.findAccounts(userId)).filter((a) => a.providerId === "credential");
  if (!passwords.length) return;
  for (const p of passwords) await adapter.deleteAccount(p.id);
  await adapter.deleteUserSessions(userId);
}
