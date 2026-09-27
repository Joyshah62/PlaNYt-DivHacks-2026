import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";

export async function getSession() {
  const requestHeaders = await headers();
  return auth.api.getSession({
    headers: requestHeaders,
  });
}

/** Only a path on this site, so a crafted ?next= can't send someone elsewhere after signing in. */
export function safeNext(next: unknown): string {
  const path = Array.isArray(next) ? next[0] : next;
  return typeof path === "string" && path.startsWith("/") && !path.startsWith("//") && !path.startsWith("/\\") ? path : "/plan";
}

/**
 * The signed-in traveler, with a phone number on file. Anyone else goes to
 * /login, and comes back to `next` (with its ?q= prompt or ?plan= link) after.
 */
export async function requireTraveler(next: string) {
  const session = await getSession();
  if (!session?.user.phoneNumber) redirect(`/login?next=${encodeURIComponent(next)}`);
  return session;
}
