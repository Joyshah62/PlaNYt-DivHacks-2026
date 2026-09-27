import { createServer } from "node:http";
import { timingSafeEqual } from "node:crypto";
import type { PlanRequest } from "@/lib/plan/types";
import { normalizeHandle } from "./format";

/**
 * POST /send { handle, request } — the website's "Text it to me". Only the
 * Roam server calls this, with the shared token; it listens on localhost only.
 */
export function startBridge(opts: {
  port: number;
  token: string;
  send: (handle: string, request: PlanRequest) => Promise<void>;
}) {
  const expected = Buffer.from(`Bearer ${opts.token}`);
  const server = createServer(async (req, res) => {
    const reply = (status: number, body: object) => {
      res.writeHead(status, { "content-type": "application/json" }).end(JSON.stringify(body));
    };
    if (req.method !== "POST" || req.url !== "/send") return reply(404, { error: "Not found." });
    const auth = Buffer.from(req.headers.authorization ?? "");
    if (auth.length !== expected.length || !timingSafeEqual(auth, expected)) return reply(401, { error: "Unauthorized." });

    let raw = "";
    for await (const chunk of req) {
      raw += chunk;
      if (raw.length > 64_000) return reply(413, { error: "Too large." });
    }
    let body: { handle?: unknown; request?: PlanRequest };
    try {
      body = JSON.parse(raw);
    } catch {
      return reply(400, { error: "Expected JSON." });
    }
    const handle = typeof body.handle === "string" ? normalizeHandle(body.handle) : null;
    if (!handle) return reply(400, { error: "That doesn't look like a phone number or Apple ID email." });
    if (!body.request?.stops?.length) return reply(400, { error: "There's no plan to send." });
    try {
      await opts.send(handle, body.request);
      reply(200, { ok: true });
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      // Shared-line projects only message numbers added as project users.
      if (/Target not allowed/i.test(message)) return reply(403, { error: "This number isn't set up to receive texts from Roam yet. Ask the host to add it." });
      console.error("[bridge] send failed:", error);
      reply(502, { error: message || "Couldn't send the text." });
    }
  });
  server.listen(opts.port, "127.0.0.1", () => console.log(`[bridge] listening on http://127.0.0.1:${opts.port}`));
  return server;
}
