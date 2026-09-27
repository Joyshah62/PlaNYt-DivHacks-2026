/** Gemini through Google's compatible chat API: tool calls and structured answers. */
export const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-3.5-flash-lite";
/**
 * What a stalled or rate-limited request retries on: GEMINI_FALLBACK_MODEL when set, else a lighter
 * Flash-Lite. Quotas are per model, so another model is often free when the main one is busy.
 */
export const GEMINI_FALLBACK_MODEL = process.env.GEMINI_FALLBACK_MODEL || "gemini-3.1-flash-lite";
export const GEMINI_ASSISTANT_MODEL = GEMINI_MODEL;
export const geminiKey = () => process.env.GEMINI_API_KEY || null;

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
  const key = geminiKey();
  if (!key) throw new GeminiError("GEMINI_API_KEY is not set.", 401);
  const model = opts.model ?? GEMINI_MODEL;
  const signal = AbortSignal.timeout(opts.timeoutMs ?? 20_000);
  const send = async (effort: boolean): Promise<Response> => {
    try {
      return await fetch("https://generativelanguage.googleapis.com/v1beta/openai/chat/completions", {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${key}` },
        body: JSON.stringify({
          model,
          messages: opts.messages,
          ...(opts.tools?.length && { tools: opts.tools, tool_choice: "auto" }),
          ...(effort && { reasoning_effort: opts.effort }),
          ...(opts.schema && { response_format: { type: "json_schema", json_schema: { name: opts.schema.name, schema: opts.schema.schema } } }),
        }),
        signal,
      });
    } catch (error) {
      // A timeout keeps its name, so callers can tell a stall from a refusal.
      if (error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError")) throw error;
      throw new GeminiError(error instanceof Error ? error.message : "Couldn't reach Gemini.");
    }
  };
  // Only some reasoning models take an effort; the others are remembered below and asked without one.
  const effort = !!opts.effort && !NO_EFFORT.has(model);
  let res = await send(effort);
  if (!res.ok && effort && res.status === 400) {
    const why = await res.text();
    if (!/reasoning_?effort/i.test(why)) throw new GeminiError(`Gemini ${res.status}: ${why.slice(0, 300)}`, res.status);
    NO_EFFORT.add(model);
    res = await send(false);
  }
  if (!res.ok) throw new GeminiError(`Gemini ${res.status}: ${(await res.text()).slice(0, 300)}`, res.status);
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
  const reply = await geminiChat({ messages, schema, timeoutMs: opts.timeoutMs ?? 20_000, effort: opts.effort, model: opts.model }).catch((error) => {
    if (!transient(error)) throw error;
    console.warn(`[gemini] ${opts.model ?? GEMINI_MODEL} stalled, retrying Gemini:`, error instanceof Error ? error.message : error);
    return geminiChat({ messages, schema, timeoutMs: 25_000, model: GEMINI_FALLBACK_MODEL });
  });
  try {
    return JSON.parse(reply.text ?? "null");
  } catch {
    return null;
  }
}
