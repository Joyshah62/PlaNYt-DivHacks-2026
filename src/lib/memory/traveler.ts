import { auth } from "@/lib/auth";
import { isMemoryId, memoryFor } from "./backboard";

/**
 * Whose memory a request uses. A signed-in traveler has one memory on their
 * account, the same on every device; it's created on first use and kept on
 * their user record, and the client never sees or sends it. Requests without
 * a session (the iMessage bot, which plans for its text threads) bring their
 * own id, and get it back to keep.
 */
export async function travelerMemory(req: Request, sent: unknown): Promise<{ memoryId: string | null; onAccount: boolean }> {
  const session = await auth.api.getSession({ headers: req.headers }).catch(() => null);
  if (!session) return { memoryId: await memoryFor(sent), onAccount: false };
  const kept = session.user.memoryId;
  if (isMemoryId(kept)) return { memoryId: kept, onAccount: true };
  const memoryId = await memoryFor(null, `Roam user ${session.user.id} (${session.user.email})`);
  if (memoryId) {
    const ctx = await auth.$context;
    await ctx.internalAdapter.updateUser(session.user.id, { memoryId }).catch((error: unknown) => {
      console.warn("[memory] couldn't save the memory on the account:", error instanceof Error ? error.message : error);
    });
  }
  return { memoryId, onAccount: true };
}
