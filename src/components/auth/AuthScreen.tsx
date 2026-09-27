"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Bookmark, Loader2, MessageSquareText, Sparkles } from "lucide-react";
import { AmbientMapLazy } from "@/components/map/LazyMaps";
import { Segmented } from "@/components/ui/segmented";
import { authClient } from "@/lib/auth-client";
import { normalizePhone } from "@/lib/phone";
import { BRAND } from "@/lib/plan/display";
import { cn } from "@/lib/utils";

type Mode = "signin" | "signup";

const PERKS = [
  { icon: Bookmark, title: "Your days, kept", body: "Plans and preferences follow your account." },
  { icon: MessageSquareText, title: "Your day by text", body: "Roam texts you the plan, and when it's time to head to each stop." },
  { icon: Sparkles, title: "Plans that know you", body: "Vegetarian, a stroller, hate crowds: say it once." },
];

/** Better Auth's OAuth error codes, said plainly. */
function oauthMessage(code: string): string {
  if (code === "access_denied") return "Google sign-in was cancelled. Try again, or use your email.";
  return "Google sign-in didn't work. Try again, or use your email.";
}

export function AuthScreen({
  next,
  googleEnabled,
  needsPhone,
  initialMode,
  oauthError,
}: {
  /** Where to go once signed in: a path on this site, with its query. */
  next: string;
  googleEnabled: boolean;
  /** Signed in, but without a phone number yet. */
  needsPhone: { name: string; email: string } | null;
  initialMode: Mode;
  oauthError: string | null;
}) {
  return (
    <div className="relative isolate flex min-h-dvh flex-col lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,34rem)]">
      {/* The landing page's map, washed toward the page so the text stays crisp. */}
      <div className="absolute inset-0 -z-20 lg:relative lg:inset-auto lg:z-auto lg:order-none">
        <div className="absolute inset-0">
          <AmbientMapLazy className="size-full" />
        </div>
        <div aria-hidden className="absolute inset-0 bg-gradient-to-b from-background/95 via-background/90 to-background lg:bg-gradient-to-r lg:from-background lg:via-background/85 lg:to-background/10" />
        <div className="relative hidden h-full flex-col justify-between p-10 lg:flex">
          <Brand />
          <div className="max-w-md">
            <h2 className="font-display text-6xl leading-[0.95] tracking-tight text-balance">
              See New York, <em className="text-brand">not</em> the crowds.
            </h2>
            <ul className="mt-8 space-y-4">
              {PERKS.map(({ icon: Icon, title, body }) => (
                <li key={title} className="flex gap-3">
                  <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-brand-soft text-brand">
                    <Icon className="size-4" aria-hidden />
                  </span>
                  <span>
                    <span className="block text-sm font-semibold">{title}</span>
                    <span className="block text-sm text-muted-foreground">{body}</span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
          <p className="text-xs text-muted-foreground">Crowd levels from MTA subway ridership · maps from OpenStreetMap</p>
        </div>
      </div>

      <main className="flex flex-1 flex-col px-5 py-6 sm:px-8 lg:justify-center lg:border-l lg:border-border lg:bg-background lg:py-10">
        <div className="lg:hidden">
          <Brand />
        </div>
        <div className="animate-rise mx-auto my-auto w-full max-w-sm py-8">
          {needsPhone ? (
            <PhoneStep next={next} who={needsPhone} />
          ) : (
            <SignIn next={next} googleEnabled={googleEnabled} initialMode={initialMode} oauthError={oauthError} />
          )}
        </div>
      </main>
    </div>
  );
}

function Brand() {
  return (
    <Link href="/" className="flex w-fit items-center gap-2 text-[15px] font-semibold tracking-tight">
      <span aria-hidden className="grid size-8 place-items-center rounded-lg bg-foreground font-display text-xl text-background">
        {BRAND.name[0]}
      </span>
      {BRAND.name} <span className="-ml-1 font-display text-lg font-normal text-muted-foreground italic">{BRAND.suffix}</span>
    </Link>
  );
}

function SignIn({ next, googleEnabled, initialMode, oauthError }: { next: string; googleEnabled: boolean; initialMode: Mode; oauthError: string | null }) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>(initialMode);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState<"email" | "google" | null>(null);
  const [error, setError] = useState<string | null>(oauthError ? oauthMessage(oauthError) : null);
  const [phoneTouched, setPhoneTouched] = useState(false);
  const phoneOk = normalizePhone(phone) !== null;
  const signup = mode === "signup";

  async function google() {
    setError(null);
    setBusy("google");
    // Back through /login, which asks for a phone number if Google didn't share one.
    const back = `/login?next=${encodeURIComponent(next)}`;
    const { error } = await authClient.signIn.social({ provider: "google", callbackURL: back, errorCallbackURL: back });
    if (error) {
      setError(error.message || "Google sign-in didn't work. Try again, or use your email.");
      setBusy(null);
    }
  }

  async function submit() {
    setError(null);
    if (signup && !phoneOk) {
      setPhoneTouched(true);
      return;
    }
    setBusy("email");
    const { error } = signup
      ? await authClient.signUp.email({ name: name.trim(), email: email.trim(), password, phoneNumber: phone })
      : await authClient.signIn.email({ email: email.trim(), password });
    if (error) {
      setError(error.message || (signup ? "Couldn't create your account." : "Couldn't sign you in."));
      setBusy(null);
      return;
    }
    router.push(next);
    router.refresh();
  }

  return (
    <>
      <h1 className="font-display text-4xl leading-none tracking-tight">{signup ? "Plan your first day." : "Welcome back."}</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        {signup ? "An account keeps your plans, and lets Roam text you your day." : "Sign in to pick up where you left off."}
      </p>

      <Segmented
        label="Sign in or create an account"
        value={mode}
        onChange={(m: Mode) => {
          setMode(m);
          setError(null);
        }}
        options={[
          { value: "signin", label: "Sign in" },
          { value: "signup", label: "Create account" },
        ]}
        className="mt-6 grid w-full grid-cols-2"
      />

      {googleEnabled && (
        <>
          <button
            type="button"
            onClick={() => void google()}
            disabled={busy !== null}
            className="mt-5 flex h-11 w-full items-center justify-center gap-2.5 rounded-full border border-border bg-card text-sm font-medium shadow-sm transition hover:border-foreground/25 hover:bg-muted disabled:opacity-60"
          >
            {busy === "google" ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <GoogleMark />}
            Continue with Google
          </button>
          <div className="my-5 flex items-center gap-3 text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
            <span className="h-px flex-1 bg-border" /> or with email <span className="h-px flex-1 bg-border" />
          </div>
        </>
      )}

      <form
        className={cn("space-y-3.5", !googleEnabled && "mt-6")}
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        {signup && <Field label="Name" value={name} onChange={setName} autoComplete="name" placeholder="Alex Rivera" required />}
        <Field label="Email" type="email" value={email} onChange={setEmail} autoComplete="email" placeholder="you@example.com" required />
        {signup && (
          <Field
            label="Phone number"
            type="tel"
            value={phone}
            onChange={(v) => {
              setPhone(v);
              setError(null);
            }}
            onBlur={() => setPhoneTouched(true)}
            autoComplete="tel"
            placeholder="(212) 555-0123"
            required
            invalid={phoneTouched && !phoneOk}
            hint={phoneTouched && !phoneOk ? "Enter a valid number. Outside the US, start with + and the country code." : "Roam texts your day here. We never share it."}
          />
        )}
        <Field
          label="Password"
          type="password"
          value={password}
          onChange={setPassword}
          autoComplete={signup ? "new-password" : "current-password"}
          placeholder={signup ? "At least 8 characters" : "Your password"}
          minLength={signup ? 8 : undefined}
          required
        />

        {error && (
          <p role="alert" className="rounded-xl bg-sev-c-soft px-3 py-2 text-sm text-sev-c">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={busy !== null}
          className="flex h-11 w-full items-center justify-center gap-2 rounded-full bg-foreground text-sm font-medium text-background transition hover:bg-foreground/85 disabled:opacity-60"
        >
          {busy === "email" ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
          {signup ? "Create account" : "Sign in"}
          {busy !== "email" && <ArrowRight className="size-4" aria-hidden />}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-muted-foreground">
        {signup ? "Already have an account? " : "New to Roam? "}
        <button type="button" onClick={() => setMode(signup ? "signin" : "signup")} className="font-medium text-foreground underline-offset-4 hover:underline">
          {signup ? "Sign in" : "Create an account"}
        </button>
      </p>
    </>
  );
}

/** Signed in with Google, which didn't share a phone number: the one thing left to ask. */
function PhoneStep({ next, who }: { next: string; who: { name: string; email: string } }) {
  const router = useRouter();
  const [phone, setPhone] = useState("");
  const [touched, setTouched] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ok = normalizePhone(phone) !== null;
  const first = who.name.trim().split(/\s+/)[0];

  async function save() {
    setTouched(true);
    if (!ok) return;
    setBusy(true);
    setError(null);
    const { error } = await authClient.updateUser({ phoneNumber: phone });
    if (error) {
      setError(error.message || "Couldn't save your number. Try again.");
      setBusy(false);
      return;
    }
    router.push(next);
    router.refresh();
  }

  return (
    <>
      <p className="text-xs font-semibold tracking-[0.15em] text-brand uppercase">One more thing</p>
      <h1 className="mt-2 font-display text-4xl leading-none tracking-tight">{first ? `Hi ${first}, what's your number?` : "What's your number?"}</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Roam texts you your day and a heads-up when it&apos;s time to go. Google didn&apos;t share a number for {who.email}.
      </p>
      <form
        className="mt-6 space-y-3.5"
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
      >
        <Field
          label="Phone number"
          type="tel"
          value={phone}
          onChange={(v) => {
            setPhone(v);
            setError(null);
          }}
          onBlur={() => setTouched(true)}
          autoComplete="tel"
          placeholder="(212) 555-0123"
          required
          autoFocus
          invalid={touched && !ok}
          hint={touched && !ok ? "Enter a valid number. Outside the US, start with + and the country code." : "We never share it."}
        />
        {error && (
          <p role="alert" className="rounded-xl bg-sev-c-soft px-3 py-2 text-sm text-sev-c">
            {error}
          </p>
        )}
        <button
          type="submit"
          disabled={busy}
          className="flex h-11 w-full items-center justify-center gap-2 rounded-full bg-foreground text-sm font-medium text-background transition hover:bg-foreground/85 disabled:opacity-60"
        >
          {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
          Continue to the planner
          {!busy && <ArrowRight className="size-4" aria-hidden />}
        </button>
      </form>
      <p className="mt-6 text-center text-sm text-muted-foreground">
        Not you?{" "}
        <button
          type="button"
          onClick={async () => {
            await authClient.signOut();
            router.refresh();
          }}
          className="font-medium text-foreground underline-offset-4 hover:underline"
        >
          Use another account
        </button>
      </p>
    </>
  );
}

function Field({
  label,
  hint,
  invalid,
  onChange,
  ...input
}: Omit<React.ComponentProps<"input">, "onChange"> & { label: string; hint?: string; invalid?: boolean; onChange: (value: string) => void }) {
  const id = `field-${label.toLowerCase().replace(/\s+/g, "-")}`;
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-xs font-medium text-muted-foreground">
        {label}
      </label>
      <input
        id={id}
        {...input}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={invalid || undefined}
        aria-describedby={hint ? `${id}-hint` : undefined}
        className="h-11 w-full rounded-xl border border-border bg-card px-3.5 text-[15px] outline-none transition placeholder:text-muted-foreground/70 focus:border-brand focus:ring-4 focus:ring-brand/10 aria-invalid:border-sev-c aria-invalid:ring-sev-c/10"
      />
      {hint && (
        <p id={`${id}-hint`} className={cn("mt-1.5 text-[11px]", invalid ? "text-sev-c" : "text-muted-foreground")}>
          {hint}
        </p>
      )}
    </div>
  );
}

/** Google's "G", as its sign-in guidelines ask. */
function GoogleMark() {
  return (
    <svg viewBox="0 0 48 48" className="size-4" aria-hidden>
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </svg>
  );
}
