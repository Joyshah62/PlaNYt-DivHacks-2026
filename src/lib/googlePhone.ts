import { normalizePhone } from "@/lib/phone";

/** Lets Google share the phone numbers on someone's Google profile (not their account recovery number). */
export const GOOGLE_PHONE_SCOPE = "https://www.googleapis.com/auth/user.phonenumbers.read";

interface PeopleResponse {
  phoneNumbers?: { value?: string; canonicalForm?: string; metadata?: { primary?: boolean } }[];
}

/**
 * The phone number on the person's Google profile, in E.164, or null when
 * there isn't one, they didn't allow it, or the People API isn't enabled.
 */
export async function googlePhone(accessToken: string): Promise<string | null> {
  try {
    const res = await fetch("https://people.googleapis.com/v1/people/me?personFields=phoneNumbers", {
      headers: { authorization: `Bearer ${accessToken}` },
      signal: AbortSignal.timeout(5_000),
    });
    if (!res.ok) {
      console.warn("[auth] Google phone lookup:", res.status, (await res.text()).slice(0, 200));
      return null;
    }
    const { phoneNumbers = [] } = (await res.json()) as PeopleResponse;
    const ordered = [...phoneNumbers].sort((a, b) => Number(!!b.metadata?.primary) - Number(!!a.metadata?.primary));
    for (const p of ordered) {
      const phone = normalizePhone(p.canonicalForm ?? p.value ?? "");
      if (phone) return phone;
    }
    return null;
  } catch (error) {
    console.warn("[auth] Google phone lookup failed:", error instanceof Error ? error.message : error);
    return null;
  }
}
