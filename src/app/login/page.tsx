"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { authClient } from "@/lib/auth-client";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("demo@roamnyc.app");
  const [password, setPassword] = useState("password123");
  const [name, setName] = useState("Demo user");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function signUp() {
    setError(null);
    setLoading(true);
    try {
      const result = await authClient.signUp.email({
        email,
        password,
        name,
      });

      if (result.error) {
        throw new Error(result.error.message || "Sign up failed");
      }

      router.push("/plan");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to create account");
    } finally {
      setLoading(false);
    }
  }

  async function signIn() {
    setError(null);
    setLoading(true);
    try {
      const result = await authClient.signIn.email({
        email,
        password,
      });

      if (result.error) {
        throw new Error(result.error.message || "Sign in failed");
      }

      router.push("/plan");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to sign in");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top,_rgba(78,102,255,0.2),transparent_48%),linear-gradient(180deg,#070b17,#0f172a)] px-4">
      <div className="w-full max-w-md rounded-3xl border border-border bg-card p-6 shadow-2xl">
        <div className="mb-6">
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-brand">
            Roam NYC
          </p>
          <h1 className="mt-3 font-display text-4xl">Welcome back</h1>
        </div>

        <div className="space-y-4">
          <label className="block text-sm">
            <span className="mb-1.5 block text-muted-foreground">Name</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-xl border border-border bg-background px-3 py-2.5 outline-none ring-0 placeholder:text-muted-foreground focus:border-brand"
              placeholder="Your name"
            />
          </label>

          <label className="block text-sm">
            <span className="mb-1.5 block text-muted-foreground">Email</span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-xl border border-border bg-background px-3 py-2.5 outline-none ring-0 placeholder:text-muted-foreground focus:border-brand"
              placeholder="email@example.com"
            />
          </label>

          <label className="block text-sm">
            <span className="mb-1.5 block text-muted-foreground">Password</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-xl border border-border bg-background px-3 py-2.5 outline-none ring-0 placeholder:text-muted-foreground focus:border-brand"
              placeholder="Password"
            />
          </label>

          {error && (
            <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">
              {error}
            </div>
          )}

          <div className="grid gap-3 pt-2 sm:grid-cols-2">
            <button
              type="button"
              onClick={signIn}
              disabled={loading}
              className="rounded-xl bg-foreground px-4 py-2.5 font-medium text-background transition hover:opacity-95 disabled:opacity-60"
            >
              {loading ? "Signing in..." : "Sign in"}
            </button>
            <button
              type="button"
              onClick={signUp}
              disabled={loading}
              className="rounded-xl border border-border bg-card px-4 py-2.5 font-medium transition hover:bg-muted disabled:opacity-60"
            >
              Create account
            </button>
          </div>
        </div>

        <p className="mt-6 text-center text-sm text-muted-foreground">
          Want to explore first?{" "}
          <Link
            href="/"
            className="font-medium text-foreground underline-offset-4 hover:underline"
          >
            Back home
          </Link>
        </p>
      </div>
    </main>
  );
}
