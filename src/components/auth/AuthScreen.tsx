"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Loader2 } from "lucide-react";
import { AppBar } from "@/components/editorial/AppBar";
import { arrowKeys } from "@/components/plan/arrowKeys";
import { authClient } from "@/lib/auth-client";
import { LoginMap } from "./LoginMap";
import { normalizePhone } from "@/lib/phone";

type Mode = "signin" | "signup";

const PERKS = [
  { title: "Your days, kept", body: "Plans and preferences follow your account." },
  { title: "Your day by text", body: "PlaNYt texts you the plan, and when it's time to head to each stop." },
  { title: "Plans that know you", body: "Vegetarian, a stroller, hate crowds: say it once." },
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
    <div className="ed-app au">
      {/* The plate: the city, captioned, with what an account is for. Desktop only. */}
      <div className="au-plate">
        <p className="au-caption ed-mono">
          <span>Plate I · Statue of Liberty, live</span>
          <span>Crowds from MTA subway ridership</span>
        </p>
        <div className="au-frame">
          <LoginMap />
        </div>
        {/* Under the plate, not over it: the statue and Google's credit stay in view. */}
        <div className="au-legend">
          <p className="au-legend-title">
            See New York, <em>not</em> the crowds.
          </p>
          <ol className="au-perks">
            {PERKS.map((p, i) => (
              <li key={p.title}>
                <span className="ed-bullet">{i + 1}</span>
                <span>
                  <b>{p.title}</b>
                  <span className="ed-small ed-muted">{p.body}</span>
                </span>
              </li>
            ))}
          </ol>
        </div>
      </div>

      <div className="au-col ed-paper">
        <AppBar>
          <Link href="/" className="ed-navlink ed-mono">
            ← Home
          </Link>
        </AppBar>
        <main className="au-form animate-rise">
          {needsPhone ? (
            <PhoneStep next={next} who={needsPhone} />
          ) : (
            <SignIn next={next} googleEnabled={googleEnabled} initialMode={initialMode} oauthError={oauthError} />
          )}
        </main>
      </div>
    </div>
  );
}

function SignIn({ next, googleEnabled, initialMode, oauthError }: { next: string; googleEnabled: boolean; initialMode: Mode; oauthError: string | null }) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>(initialMode);
  const [modeSwitched, setModeSwitched] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState<"email" | "google" | null>(null);
  const [error, setError] = useState<string | null>(oauthError ? oauthMessage(oauthError) : null);
  const [phoneTouched, setPhoneTouched] = useState(false);
  const phoneOk = normalizePhone(phone) !== null;
  const signup = mode === "signup";

  function changeMode(nextMode: Mode) {
    if (nextMode === mode) return;
    setMode(nextMode);
    setError(null);
    setModeSwitched(true);
  }

  async function google() {
    setError(null);
    setBusy("google");
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
    <div className={modeSwitched ? "au-mode-panel au-mode-panel--switch" : "au-mode-panel"} data-mode={mode}>
      <p className="ed-mono ed-kicker">{signup ? "Create an account" : "Sign in"}</p>
      <h1 className="ed-title">
        {signup ? <>Plan your <em>first day.</em></> : <>Welcome <em>back.</em></>}
      </h1>
      <p className="ed-dek">
        {signup ? "An account keeps your plans, and lets PlaNYt text you your day." : "Sign in to pick up where you left off."}
      </p>

      <div role="radiogroup" aria-label="Sign in or create an account" className="ed-tabs au-mode" onKeyDown={(e) => arrowKeys(e, "[role=\"radio\"]", false)}>
        {(["signin", "signup"] as Mode[]).map((m) => (
          <button
            key={m}
            type="button"
            role="radio"
            aria-checked={mode === m}
            className="ed-tab"
            onClick={() => changeMode(m)}
          >
            {m === "signin" ? "Sign in" : "Create account"}
          </button>
        ))}
      </div>

      {googleEnabled && (
        <>
          <button
            type="button"
            onClick={() => void google()}
            disabled={busy !== null}
            className="ed-btn ed-btn--ghost ed-btn--block"
          >
            {busy === "google" ? <Loader2 className="size-5 animate-spin" aria-hidden /> : <GoogleMark />}
            Continue with Google
          </button>
          <div className="au-or">
            <span>or with email</span>
          </div>
        </>
      )}

      <form
        className="au-fields"
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        {signup && (
          <Field
            label="Name"
            value={name}
            onChange={setName}
            autoComplete="name"
            placeholder="Alex Rivera"
            required
          />
        )}
        <Field
          label="Email"
          type="email"
          value={email}
          onChange={setEmail}
          autoComplete="email"
          placeholder="you@example.com"
          required
        />
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
            hint={
              phoneTouched && !phoneOk
                ? "Enter a valid number. Outside the US, start with + and the country code."
                : "PlaNYt texts your day here. We never share it."
            }
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

        {error && <p role="alert" className="ed-alert">{error}</p>}

        <button type="submit" disabled={busy !== null} className="ed-btn ed-btn--block">
          {busy === "email" ? <Loader2 className="size-5 animate-spin" aria-hidden /> : null}
          {signup ? "Create account" : "Sign in"}
          {busy !== "email" && <ArrowRight className="size-4" aria-hidden />}
        </button>
      </form>

      <p className="au-switch ed-small ed-muted">
        {signup ? "Already have an account? " : "New to PlaNYt? "}
        <button
          type="button"
          onClick={() => changeMode(signup ? "signin" : "signup")}
          className="ed-link"
        >
          {signup ? "Sign in" : "Create an account"}
        </button>
      </p>
      <p className="ed-small ed-muted">
        How we handle your data: <Link href="/privacy" className="ed-link">privacy policy</Link>.
      </p>
    </div>
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
      <p className="ed-mono ed-kicker">One more thing</p>
      <h1 className="ed-title">{first ? <>Hi {first}, <em>what&apos;s your number?</em></> : <>What&apos;s your <em>number?</em></>}</h1>
      <p className="ed-dek">
        PlaNYt texts you your day and a heads-up when it&apos;s time to go. Google didn&apos;t share a number for {who.email}.
      </p>
      <form
        className="au-fields"
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
        {error && <p role="alert" className="ed-alert">{error}</p>}
        <button type="submit" disabled={busy} className="ed-btn ed-btn--block">
          {busy ? <Loader2 className="size-5 animate-spin" aria-hidden /> : null}
          Continue to the planner
          {!busy && <ArrowRight className="size-4" aria-hidden />}
        </button>
      </form>
      <p className="au-switch ed-small ed-muted">
        Not you?{" "}
        <button
          type="button"
          onClick={async () => {
            await authClient.signOut();
            router.refresh();
          }}
          className="ed-link"
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
    <div className="ed-field">
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        {...input}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={invalid || undefined}
        aria-describedby={hint ? `${id}-hint` : undefined}
      />
      {hint && (
        <p id={`${id}-hint`} className={invalid ? "ed-hint bad" : "ed-hint"}>
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
