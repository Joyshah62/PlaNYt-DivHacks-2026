/**
 * xAI's Grok through its OpenAI-compatible chat API (https://docs.x.ai):
 * tool calls for the trip chat, JSON-schema answers for reading requests.
 * Off unless GROK_API_KEY (or XAI_API_KEY) is set.
 */

export const GROK_MODEL = process.env.GROK_MODEL || "grok-4.7";
/** A fast, non-reasoning model for when the main one stalls: an answer beats a timeout. */
export const GROK_FALLBACK_MODEL = process.env.GROK_FALLBACK_MODEL || "grok-4.20-0309-non-reasoning";


export const grokKey = () => process.env.GROK_API_KEY || process.env.XAI_API_KEY || null;

export type GrokMessage =
  | { role: "system" | "user"; content: string }
  | { role: "assistant"; content: string | null; tool_calls?: GrokToolCall[] }
  | { role: "tool"; tool_call_id: string; content: string };

export interface GrokToolCall {
  id: string;
  type: "function";
  function: { name: string; arguments: string };
}

export interface GrokTool {
  type: "function";
  function: { name: string; description: string; parameters: Record<string, unknown> };
}

/** A failed call, with the HTTP status when there was one (429: busy, 401/403: bad key). */
export class GrokError extends Error {
  constructor(message: string, readonly status: number | null = null) {
    super(message);
    this.name = "GrokError";
  }
}

/** A stall or a server-side failure, worth another try; a bad key or a bad request isn't. */
export function transient(error: unknown): boolean {
  if (error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError")) return true;
  return error instanceof GrokError && (error.status === null || error.status >= 500);
}

export interface GrokReply {
  /** The assistant message as sent, to put back into the conversation. */
  message: Extract<GrokMessage, { role: "assistant" }>;
  text: string | null;
  calls: { id: string; name: string; args: unknown }[];
}

export async function grokChat(opts: {
  messages: GrokMessage[];
  tools?: GrokTool[];
  /** A JSON Schema the answer must follow. */
  schema?: { name: string; schema: Record<string, unknown> };
  /** "low" thinks less and answers sooner, for reading a request rather than reasoning about it. */
  effort?: "low" | "high";
  timeoutMs?: number;
  /** Another model than GROK_MODEL, e.g. the fallback. */
  model?: string;
}): Promise<GrokReply> {
  const key = grokKey();
  if (!key) throw new GrokError("GROK_API_KEY is not set.", 401);
  let res: Response;
  try {
    res = await fetch("https://api.x.ai/v1/chat/completions", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model: opts.model ?? GROK_MODEL,
        messages: opts.messages,
        ...(opts.tools?.length && { tools: opts.tools, tool_choice: "auto" }),
        // Only reasoning models take an effort.
        ...(opts.effort && !opts.model && { reasoning_effort: opts.effort }),
        ...(opts.schema && { response_format: { type: "json_schema", json_schema: { name: opts.schema.name, schema: opts.schema.schema } } }),
      }),
      signal: AbortSignal.timeout(opts.timeoutMs ?? 20_000),
    });
  } catch (error) {
    // A timeout keeps its name, so callers can tell a stall from a refusal.
    if (error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError")) throw error;
    throw new GrokError(error instanceof Error ? error.message : "Couldn't reach Grok.");
  }
  if (!res.ok) throw new GrokError(`Grok ${res.status}: ${(await res.text()).slice(0, 300)}`, res.status);
  const body = (await res.json()) as { choices?: { message?: { content?: string | null; tool_calls?: GrokToolCall[] } }[] };
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
export async function grokJson(system: string, user: string, schema: { name: string; schema: Record<string, unknown> }, opts: { timeoutMs?: number; effort?: "low" | "high" } = {}): Promise<unknown> {
  const messages: GrokMessage[] = [{ role: "system", content: system }, { role: "user", content: user }];
  const reply = await grokChat({ messages, schema, timeoutMs: opts.timeoutMs ?? 20_000, effort: opts.effort }).catch((error) => {
    if (!transient(error)) throw error;
    console.warn("[grok] stalled, answering with the fast model:", error instanceof Error ? error.message : error);
    return grokChat({ messages, schema, timeoutMs: 20_000, model: GROK_FALLBACK_MODEL });
  });
  try {
    return JSON.parse(reply.text ?? "null");
  } catch {
    return null;
  }
}
