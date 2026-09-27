import { createAuthClient } from "better-auth/react";
import { inferAdditionalFields } from "better-auth/client/plugins";
import type { auth } from "@/lib/auth";

export const authClient = createAuthClient({
  // In the browser, the site the page came from: a fixed URL fails ("Failed to fetch")
  // whenever the app is opened at another address (127.0.0.1, a LAN IP, a preview deploy).
  baseURL: typeof window === "undefined" ? process.env.NEXT_PUBLIC_APP_URL || "https://planyt.tech" : window.location.origin,
  // Knows about the user's phoneNumber, for sign-up and updateUser.
  plugins: [inferAdditionalFields<typeof auth>()],
});
