/**
 * Copying and sharing a link from a tap. Phones only allow either during the
 * tap itself, so call these straight from a click handler, never after a fetch.
 */

/** The phone's own share sheet (Messages, WhatsApp, Copy…), where there is one. */
export function canShareNatively(): boolean {
  return typeof navigator !== "undefined" && typeof navigator.share === "function" && window.matchMedia("(pointer: coarse)").matches;
}

/** "shared", "cancelled" (they closed the sheet) or "failed". */
export async function shareNatively(title: string, url: string): Promise<"shared" | "cancelled" | "failed"> {
  try {
    await navigator.share({ title, url });
    return "shared";
  } catch (e) {
    return e instanceof DOMException && e.name === "AbortError" ? "cancelled" : "failed";
  }
}

/** Puts `text` on the clipboard; false when the browser won't. */
export async function copyText(text: string): Promise<boolean> {
  // The Clipboard API exists only on https (and localhost), not on a LAN address while testing.
  if (navigator.clipboard && window.isSecureContext) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // Denied; the older way below may still work.
    }
  }
  const field = document.createElement("textarea");
  field.value = text;
  field.readOnly = true;
  // Off screen, and 16px so iOS doesn't zoom in on it.
  field.style.cssText = "position:fixed;top:0;left:-9999px;font-size:16px;opacity:0";
  document.body.appendChild(field);
  field.select();
  field.setSelectionRange(0, text.length);
  let ok = false;
  try {
    ok = document.execCommand("copy");
  } catch {
    ok = false;
  }
  field.remove();
  return ok;
}
