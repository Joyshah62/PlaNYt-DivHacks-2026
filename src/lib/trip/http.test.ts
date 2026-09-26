import { describe, expect, it, vi } from "vitest";
import { readBody, respond, tripId } from "./http";
import { JoinBody } from "./schema";
import { TripError } from "./service";

const post = (body: string) => new Request("http://test/api", { method: "POST", body });

describe("respond", () => {
  it("returns the work's result as JSON", async () => {
    const res = await respond(async () => ({ ok: true }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });

  it("maps a TripError to its status and message", async () => {
    const res = await respond(async () => {
      throw new TripError(409, "This plan is locked.");
    });
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: "This plan is locked." });
  });

  it("hides unexpected failures behind a 503", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const res = await respond(async () => {
      throw new Error("database exploded");
    });
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ error: "Trips are unavailable right now." });
    spy.mockRestore();
  });
});

describe("readBody", () => {
  it("rejects bodies that aren't JSON", async () => {
    await expect(readBody(post("not json"), JoinBody)).rejects.toMatchObject({ status: 400 });
  });

  it("returns the schema's first message on bad input", async () => {
    await expect(readBody(post(JSON.stringify({ name: "x".repeat(31) })), JoinBody)).rejects.toMatchObject({
      status: 400,
      message: "Keep your name under 30 characters.",
    });
  });

  it("returns parsed, trimmed data", async () => {
    expect(await readBody(post(JSON.stringify({ name: "  Rishi " })), JoinBody)).toEqual({ name: "Rishi" });
  });
});

describe("tripId", () => {
  it("accepts 10-character ids and 404s anything else", () => {
    expect(tripId("abcDEF12_-")).toBe("abcDEF12_-");
    expect(() => tripId("../etc")).toThrow(TripError);
  });
});
