"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent } from "react";

export function HomePrompt() {
  const router = useRouter();
  const [text, setText] = useState("");
  const [pending, startTransition] = useTransition();

  function submit(e: FormEvent) {
    e.preventDefault();
    const q = text.trim();
    if (!q) return;
    startTransition(() => router.push(`/plan?q=${encodeURIComponent(q)}`));
  }

  return (
    <form className="ed-prompt" role="search" onSubmit={submit}>
      <label className="sr-only" htmlFor="home-prompt">Describe your day in New York</label>
      <input
        id="home-prompt"
        value={text}
        onChange={(e) => setText(e.target.value)}
        maxLength={1500}
        autoComplete="off"
        placeholder="A Saturday with the Met, a skyline view and pizza…"
      />
      <button type="submit" className="ed-btn" disabled={pending || !text.trim()}>
        {pending ? "Planning…" : "Plan →"}
      </button>
    </form>
  );
}
