/** Gemini through Google's compatible chat API: tool calls and structured answers. */
export const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-3.5-flash-lite";
/**
 * What a stalled or rate-limited request retries on: GEMINI_FALLBACK_MODEL when set, else a lighter
 * Flash-Lite. Quotas are per model, so another model is often free when the main one is busy.
 */
export const GEMINI_FALLBACK_MODEL = process.env.GEMINI_FALLBACK_MODEL || "gemini-3.1-flash-lite";
export const GEMINI_ASSISTANT_MODEL = GEMINI_MODEL;
export const geminiKey = () => process.env.GEMINI_API_KEY || null;
/**
 * The last resort, when both Gemini models fail: Grok, through xAI's compatible API, only with
 * GROK_API_KEY set. A non-reasoning model, since it answers in about a second; a reasoning one
 * can take longer than the whole retry allows.
 */
export const GROK_MODEL = process.env.GROK_FALLBACK_MODEL || "grok-4.20-0309-non-reasoning";
export const grokKey = () => process.env.GROK_API_KEY || null;
const isGrok = (model: string) => model.startsWith("grok");

/** The models tried, in order, after the first one stalls or is busy. */
export function fallbackModels(first: string = GEMINI_MODEL): string[] {
  const chain = [GEMINI_FALLBACK_MODEL, ...(grokKey() ? [GROK_MODEL] : [])];
  return chain.filter((m, i) => m !== first && chain.indexOf(m) === i);
}

export type GeminiMessage =
  | { role: "system" | "user"; content: string }
  | { role: "assistant"; content: string | null; tool_calls?: GeminiToolCall[] }
  | { role: "tool"; tool_call_id: string; content: string };

export interface GeminiToolCall {
  id: string;
  type: "function";
  function: { name: string; arguments: string };
}

export interface GeminiTool {
  type: "function";
  function: { name: string; description: string; parameters: Record<string, unknown> };
}

/** A failed call, with the HTTP status when there was one (429: busy, 401/403: bad key). */
export class GeminiError extends Error {
  constructor(message: string, readonly status: number | null = null) {
    super(message);
    this.name = "GeminiError";
  }
}

/** A stall, a rate limit or a server-side failure, worth another try (on another model); a bad key or a bad request isn't. */
export function transient(error: unknown): boolean {
  if (error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError")) return true;
  return error instanceof GeminiError && (error.status === null || error.status === 429 || error.status >= 500);
}

/**
 * Runs `call` on the first model, then on each fallback in turn while failures are transient
 * (a stall, a rate limit, a server error). The last failure is what's thrown.
 */
export async function withFallbacks<T>(call: (model: string | undefined, attempt: number) => Promise<T>, label = "gemini", first: string = GEMINI_MODEL): Promise<T> {
  try {
    return await call(undefined, 0);
  } catch (error) {
    if (!transient(error)) throw error;
    let last = error;
    let failed = first;
    for (const [i, model] of fallbackModels(first).entries()) {
      console.warn(`[${label}] ${failed} failed, retrying on ${model}:`, last instanceof Error ? last.message : last);
      try {
        return await call(model, i + 1);
      } catch (next) {
        if (!transient(next)) throw next;
        last = next;
        failed = model;
      }
    }
    throw last;
  }
}

export interface GeminiReply {
  /** The assistant message as sent, to put back into the conversation. */
  message: Extract<GeminiMessage, { role: "assistant" }>;
  text: string | null;
  calls: { id: string; name: string; args: unknown }[];
}

/** Remember endpoints that reject the optional reasoning parameter. */
const NO_EFFORT = new Set<string>();

export async function geminiChat(opts: {
  messages: GeminiMessage[];
  tools?: GeminiTool[];
  /** A JSON Schema the answer must follow. */
  schema?: { name: string; schema: Record<string, unknown> };
  /** "low" thinks less and answers sooner, for reading a request rather than reasoning about it. */
  effort?: "low" | "high";
  timeoutMs?: number;
  /** Another model than GEMINI_MODEL, e.g. the fallback. */
  model?: string;
}): Promise<GeminiReply> {
  const model = opts.model ?? GEMINI_MODEL;
  const grok = isGrok(model);
  const key = grok ? grokKey() : geminiKey();
  if (!key) throw new GeminiError(`${grok ? "GROK_API_KEY" : "GEMINI_API_KEY"} is not set.`, 401);
  const provider = grok ? "Grok" : "Gemini";
  // Gemini signs its tool calls (extra_content); that's Gemini's own field, so another provider gets them without it.
  const messages = grok
    ? opts.messages.map((m) => m.role === "assistant" && m.tool_calls
      ? { ...m, tool_calls: m.tool_calls.map(({ id, type, function: fn }) => ({ id, type, function: fn })) }
      : m)
    : opts.messages;
  const signal = AbortSignal.timeout(opts.timeoutMs ?? 20_000);
  const send = async (effort: boolean): Promise<Response> => {
    try {
      return await fetch(grok ? "https://api.x.ai/v1/chat/completions" : "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions", {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${key}` },
        body: JSON.stringify({
          model,
          messages,
          ...(opts.tools?.length && { tools: opts.tools, tool_choice: "auto" }),
          ...(effort && { reasoning_effort: opts.effort }),
          ...(opts.schema && { response_format: { type: "json_schema", json_schema: { name: opts.schema.name, schema: opts.schema.schema } } }),
        }),
        signal,
      });
    } catch (error) {
      // A timeout keeps its name, so callers can tell a stall from a refusal.
      if (error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError")) throw error;
      throw new GeminiError(error instanceof Error ? error.message : `Couldn't reach ${provider}.`);
    }
  };
  // Only some reasoning models take an effort; the others are remembered below and asked without one.
  const effort = !!opts.effort && !grok && !NO_EFFORT.has(model);
  let res = await send(effort);
  if (!res.ok && effort && res.status === 400) {
    const why = await res.text();
    if (!/reasoning_?effort/i.test(why)) throw new GeminiError(`${provider} ${res.status}: ${why.slice(0, 300)}`, res.status);
    NO_EFFORT.add(model);
    res = await send(false);
  }
  if (!res.ok) throw new GeminiError(`${provider} ${res.status}: ${(await res.text()).slice(0, 300)}`, res.status);
  const body = (await res.json()) as { choices?: { message?: { content?: string | null; tool_calls?: GeminiToolCall[] } }[] };
  const m = body.choices?.[0]?.message ?? {};
  const calls = (m.tool_calls ?? []).map((c) => {
    let args: unknown = {};
    try {
      args = JSON.parse(c.function.arguments || "{}");
    } catch {
      // A malformed call reads as no arguments; the tool's own validation says what's missing.
    }
    return { id: c.id, name: c.function.name, args };
  });
  return {
    message: { role: "assistant", content: m.content ?? null, ...(m.tool_calls?.length && { tool_calls: m.tool_calls }) },
    text: m.content?.trim() || null,
    calls,
  };
}

/** One answer shaped by `schema`, parsed; null when the reply isn't JSON. */
export async function geminiJson(system: string, user: string, schema: { name: string; schema: Record<string, unknown> }, opts: { timeoutMs?: number; effort?: "low" | "high"; model?: string } = {}): Promise<unknown> {
  const messages: GeminiMessage[] = [{ role: "system", content: system }, { role: "user", content: user }];
  // A retry gets longer (the model was busy, not broken) and its model's default reasoning.
  const reply = await withFallbacks(
    (model) => model
      ? geminiChat({ messages, schema, timeoutMs: 25_000, model })
      : geminiChat({ messages, schema, timeoutMs: opts.timeoutMs ?? 20_000, effort: opts.effort, model: opts.model }),
    "gemini",
    opts.model ?? GEMINI_MODEL,
  );
  try {
    return JSON.parse(reply.text ?? "null");
  } catch {
    return null;
  }
}
