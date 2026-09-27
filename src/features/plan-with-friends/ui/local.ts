export interface TripIdentity {
  memberId: string;
  organizerKey?: string;
}

const EVENT = "roam:trip-identity";
const key = (id: string) => `roam:trip:${id}`;

export function readIdentityRaw(id: string): string {
  try {
    return localStorage.getItem(key(id)) ?? "";
  } catch {
    return "";
  }
}

export function parseIdentity(raw: string): TripIdentity | null {
  if (!raw) return null;
  try {
    const v = JSON.parse(raw) as Partial<TripIdentity>;
    if (typeof v.memberId !== "string") return null;
    return typeof v.organizerKey === "string" ? { memberId: v.memberId, organizerKey: v.organizerKey } : { memberId: v.memberId };
  } catch {
    return null;
  }
}

export function subscribeIdentity(onChange: () => void): () => void {
  window.addEventListener("storage", onChange);
  window.addEventListener(EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(EVENT, onChange);
  };
}

export function storeIdentity(id: string, identity: TripIdentity): boolean {
  try {
    localStorage.setItem(key(id), JSON.stringify(identity));
    window.dispatchEvent(new Event(EVENT));
    return true;
  } catch {
    return false;
  }
}

export function clearIdentity(id: string): void {
  try {
    localStorage.removeItem(key(id));
    window.dispatchEvent(new Event(EVENT));
  } catch {
    /* nothing stored */
  }
}
