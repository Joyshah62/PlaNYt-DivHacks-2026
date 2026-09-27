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
      <textarea
        id="home-prompt"
        rows={2}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
            e.preventDefault();
            e.currentTarget.form?.requestSubmit();
          }
        }}
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
