import { createServer } from "node:http";
import { timingSafeEqual } from "node:crypto";
import type { PlanRequest } from "@/lib/plan/types";
import { normalizeHandle } from "./format";

/**
 * POST /send { handle, request, intro? } — the website's "Text it to me", and a
 * trip room's approved plan (intro: who approved it). Only the
 * PlaNYt server calls this, with the shared token.
 *
 * Locally binds 127.0.0.1. On Render (PORT set), bind 0.0.0.0 so the web
 * service can reach this worker; override with PHONE_BRIDGE_HOST.
 * GET /health is for Render's health check (no auth).
 */
export function startBridge(opts: {
  port: number;
  /** Defaults to 127.0.0.1 locally; 0.0.0.0 when PORT is set (Render). */
  host?: string;
  token: string;
  send: (handle: string, request: PlanRequest, intro?: string) => Promise<void>;
}) {
  const host = opts.host ?? (process.env.PHONE_BRIDGE_HOST || (process.env.PORT ? "0.0.0.0" : "127.0.0.1"));
  const expected = Buffer.from(`Bearer ${opts.token}`);
  const server = createServer(async (req, res) => {
    const reply = (status: number, body: object) => {
      res.writeHead(status, { "content-type": "application/json" }).end(JSON.stringify(body));
    };
    const path = (req.url ?? "/").split("?")[0];
    if (req.method === "GET" && (path === "/health" || path === "/")) {
      return reply(200, { ok: true, service: "roam-imessage" });
    }
    if (req.method !== "POST" || path !== "/send") return reply(404, { error: "Not found." });
    const auth = Buffer.from(req.headers.authorization ?? "");
    if (auth.length !== expected.length || !timingSafeEqual(auth, expected)) return reply(401, { error: "Unauthorized." });

    let raw = "";
    for await (const chunk of req) {
      raw += chunk;
      if (raw.length > 64_000) return reply(413, { error: "Too large." });
    }
    let body: { handle?: unknown; request?: PlanRequest; intro?: unknown };
    try {
      body = JSON.parse(raw);
    } catch {
      return reply(400, { error: "Expected JSON." });
    }
    const handle = typeof body.handle === "string" ? normalizeHandle(body.handle) : null;
    if (!handle) return reply(400, { error: "That doesn't look like a phone number or Apple ID email." });
    if (!body.request?.stops?.length) return reply(400, { error: "There's no plan to send." });
    try {
      await opts.send(handle, body.request, typeof body.intro === "string" ? body.intro.slice(0, 300) : undefined);
      reply(200, { ok: true });
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      // Shared-line projects only message numbers added as project users.
      if (/Target not allowed/i.test(message)) return reply(403, { error: "This number isn't set up to receive texts from PlaNYt yet. Ask the host to add it." });
      console.error("[bridge] send failed:", error);
      reply(502, { error: message || "Couldn't send the text." });
    }
  });
  server.listen(opts.port, host, () => console.log(`[bridge] listening on http://${host}:${opts.port}`));
  return server;
}
