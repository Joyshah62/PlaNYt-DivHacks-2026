import { beforeEach, describe, expect, it, vi } from "vitest";

const getSession = vi.fn();
const updateUser = vi.fn(async () => ({}));
vi.mock("@/lib/auth", () => ({ auth: { api: { getSession }, $context: Promise.resolve({ internalAdapter: { updateUser } }) } }));
const memoryFor = vi.fn();
vi.mock("./backboard", async (original) => ({ ...(await original<typeof import("./backboard")>()), memoryFor }));
const { travelerMemory } = await import("./traveler");

const KEPT = "f9326f62-08a9-40ee-8b39-4af387c8a157";
const NEW = "6afcbf4f-2b9c-47b7-bb09-32736f9eb0b0";
const THREAD = "118a5d23-3416-4c9f-993e-4d2f39ec9fcf";
const req = new Request("http://localhost/api/trip-chat");
const user = (memoryId?: string) => ({ user: { id: "u1", email: "a@example.com", memoryId } });

beforeEach(() => {
  vi.clearAllMocks();
});

describe("whose memory a request uses", () => {
  it("uses the account's memory, ignoring any id the client sends", async () => {
    getSession.mockResolvedValueOnce(user(KEPT));
    expect(await travelerMemory(req, THREAD)).toEqual({ memoryId: KEPT, onAccount: true });
    expect(memoryFor).not.toHaveBeenCalled();
  });

  it("starts an account's memory on first use and keeps it on the user", async () => {
    getSession.mockResolvedValueOnce(user());
    memoryFor.mockResolvedValueOnce(NEW);
    expect(await travelerMemory(req, THREAD)).toEqual({ memoryId: NEW, onAccount: true });
    expect(memoryFor).toHaveBeenCalledWith(null, expect.stringContaining("u1"));
    expect(updateUser).toHaveBeenCalledWith("u1", { memoryId: NEW });
  });

  it("lets a request without a session (a text thread) bring its own", async () => {
    getSession.mockResolvedValueOnce(null);
    memoryFor.mockResolvedValueOnce(THREAD);
    expect(await travelerMemory(req, THREAD)).toEqual({ memoryId: THREAD, onAccount: false });
    expect(memoryFor).toHaveBeenCalledWith(THREAD);
    expect(updateUser).not.toHaveBeenCalled();
  });
});
