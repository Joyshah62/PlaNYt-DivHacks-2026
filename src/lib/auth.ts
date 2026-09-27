import { betterAuth } from "better-auth";
import { APIError, createAuthMiddleware } from "better-auth/api";
import { mongodbAdapter } from "@better-auth/mongo-adapter";
import { nextCookies } from "better-auth/next-js";
import { PhoneSchema } from "@/lib/phone";
import { db } from "@/lib/db";
import { GOOGLE_PHONE_SCOPE, googlePhone } from "@/lib/googlePhone";

// A known secret would let anyone forge a session, so production must set its own.
const secret = process.env.BETTER_AUTH_SECRET;
if (!secret && process.env.NODE_ENV === "production" && process.env.NEXT_PHASE !== "phase-production-build") {
  throw new Error("BETTER_AUTH_SECRET is not set. Generate one with `openssl rand -hex 32`.");
}

const siteUrl = process.env.BETTER_AUTH_URL || "https://planyt.tech";
const hostOf = (url: string) => {
  try {
    return new URL(url).host;
  } catch {
    return null;
  }
};
/**
 * Where the app may be reached. Sign-in works from any of these, and Google
 * sends people back to the one they came from: a tunnel (ngrok) for testing
 * on a phone, a preview deploy. Anything else is refused ("Invalid origin").
 */
const allowedHosts = [
  hostOf(siteUrl),
  ...(process.env.BETTER_AUTH_ALLOWED_HOSTS ?? "").split(",").map((h) => h.trim()),
  ...(process.env.NODE_ENV === "production" ? [] : ["localhost:3000", "127.0.0.1:3000", "*.ngrok-free.app", "*.ngrok.app", "*.ngrok.io"]),
].filter((h): h is string => !!h);

const googleClientId = process.env.GOOGLE_CLIENT_ID;
const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET;
/** "Continue with Google" shows only when the server has an OAuth client for it. */
export const googleEnabled = !!(googleClientId && googleClientSecret);

export const auth = betterAuth({
  database: mongodbAdapter(db, {
    usePlural: false,
    transaction: false,
  }),
  secret: secret || "dev-secret-change-me",
  baseURL: { allowedHosts: [...new Set(allowedHosts)], fallback: siteUrl, protocol: "auto" },
  // Tunnels and hosts (ngrok, Vercel) say which site and https via x-forwarded-*; only allowedHosts are believed.
  advanced: { trustedProxyHeaders: true },
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
    maxPasswordLength: 128,
  },
  // Google shares the phone number on someone's profile if they allow it (see
  // lib/googlePhone); without one, they add it on the next screen.
  socialProviders: googleEnabled
    ? {
        google: {
          clientId: googleClientId!,
          clientSecret: googleClientSecret!,
          prompt: "select_account",
          ...(process.env.GOOGLE_REQUEST_PHONE !== "false" && { scope: [GOOGLE_PHONE_SCOPE] }),
        },
      }
    : {},
  user: {
    additionalFields: {
      // Where PlaNYt texts the day (see lib/imessage). Stored in E.164, e.g. "+12125550123".
      phoneNumber: { type: "string", required: false, input: true, validator: { input: PhoneSchema } },
      // Their Backboard memory (see lib/memory): set by the server on first use, never by the client.
      memoryId: { type: "string", required: false, input: false },
    },
  },
  databaseHooks: {
    account: {
      create: {
        // A new Google sign-in: take the phone number from their Google profile when there is one.
        after: async (account, ctx) => {
          if (account.providerId !== "google" || !account.accessToken || !ctx) return;
          const phoneNumber = await googlePhone(account.accessToken);
          if (!phoneNumber) return;
          const user = await ctx.context.internalAdapter.findUserById(account.userId);
          if (user && !(user as { phoneNumber?: string | null }).phoneNumber) {
            await ctx.context.internalAdapter.updateUser(account.userId, { phoneNumber });
          }
        },
      },
    },
  },
  hooks: {
    // Optional in the database (a Google account starts without one), required to sign up with email.
    before: createAuthMiddleware(async (ctx) => {
      if (ctx.path === "/sign-up/email" && !String(ctx.body?.phoneNumber ?? "").trim()) {
        throw new APIError("BAD_REQUEST", { message: "Add a phone number so PlaNYt can text you your day." });
      }
    }),
  },
  plugins: [nextCookies()],
});
