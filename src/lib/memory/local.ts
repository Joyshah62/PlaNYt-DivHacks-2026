/** This device's memory id (see ./backboard), so Roam remembers the traveler from one trip to the next. */

const STORAGE_KEY = "roam.memory";

export function loadMemoryId(): string | null {
  try {
    return window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

/** Keeps the id the server sent back, if any. */
export function storeMemoryId(id: unknown) {
  if (typeof id !== "string" || !id) return;
  try {
    window.localStorage.setItem(STORAGE_KEY, id);
  } catch {
    // Private mode: Roam just won't remember next time.
  }
}
