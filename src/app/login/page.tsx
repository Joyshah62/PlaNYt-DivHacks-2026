import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthScreen } from "@/components/auth/AuthScreen";
import { edFonts } from "@/components/editorial/fonts";
import { googleEnabled } from "@/lib/auth";
import { BRAND } from "@/lib/plan/display";
import { getSession, safeNext } from "@/lib/session";
import "./auth.css";

export const metadata: Metadata = {
  title: `Sign in · ${BRAND.name}`,
};

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const { next, mode, error } = await searchParams;
  const target = safeNext(next);
  const session = await getSession();
  // Signed in with a phone on file: nothing to do here.
  if (session?.user.phoneNumber) redirect(target);
  return (
    <div className={`ed ${edFonts}`}>
      <AuthScreen
        next={target}
        googleEnabled={googleEnabled}
        // Signed in (with Google) but no phone yet: just that step.
        needsPhone={session ? { name: session.user.name, email: session.user.email } : null}
        initialMode={mode === "signup" ? "signup" : "signin"}
        oauthError={typeof error === "string" ? error : null}
      />
    </div>
  );
}
