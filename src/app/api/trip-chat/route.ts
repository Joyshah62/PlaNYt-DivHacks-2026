import { after } from "next/server";
import { chat, ChatError, ChatInput } from "@/lib/discover/chat";
import { remember } from "@/lib/memory/backboard";
import { travelerMemory } from "@/lib/memory/traveler";
import { progressResponse, type Progress } from "@/lib/progress";
import { guardrail } from "@/lib/discover/scope";
import { auth } from "@/lib/auth";
import { conversationOwner, listConversations, loadConversation, saveConversationTurn } from "@/lib/chat/conversations";
import { encodePlan, planTitle } from "@/lib/plan/share";
import { randomUUID } from "node:crypto";

export async function GET(req: Request) {
  const session = await auth.api.getSession({ headers: req.headers }).catch(() => null);
  const params = new URL(req.url).searchParams;
  // ?list=1: the account's past conversations, for the chat's history and the trips page.
  if (params.has("list")) {
    if (!session) return Response.json({ conversations: [] });
    return Response.json({ conversations: await listConversations(conversationOwner(session.user.id, "")) });
  }
  const requestedId = params.get("conversationId");
  if (requestedId && !/^[0-9a-f-]{36}$/i.test(requestedId)) return Response.json({ error: "Invalid conversation." }, { status: 400 });
  if (!session && !requestedId) return Response.json({ conversation: null });
  const owner = conversationOwner(session?.user.id ?? null, requestedId ?? "");
  const conversation = await loadConversation(owner, requestedId);
  return Response.json({ conversation });
}

export async function POST(req: Request) {
  return progressResponse(req, (progress) => respond(req, progress));
}

async function respond(req: Request, progress: Progress) {
  progress("Reading your message…");
  let body: unknown;
  try { body = await req.json(); }
  catch { return Response.json({ error: "Expected a JSON body." }, { status: 400 }); }
  const parsed = ChatInput.safeParse(body);
  if (!parsed.success) {
    // Which field, not what was in it: enough to find a client sending something out of bounds.
    console.warn("[trip-chat] invalid request:", parsed.error.issues.slice(0, 3).map((i) => `${i.path.join(".")} ${i.code}`).join("; "));
    return Response.json({ error: "Please refresh your trip and try that request again." }, { status: 400 });
  }
  const session = await auth.api.getSession({ headers: req.headers }).catch(() => null);
  const conversationId = parsed.data.conversationId ?? randomUUID();
  const owner = conversationOwner(session?.user.id ?? null, conversationId);
  const trip = { title: planTitle(parsed.data.request), code: encodePlan(parsed.data.request) };
  const blocked = guardrail(parsed.data.message);
  if (blocked) {
    await saveConversationTurn(owner, conversationId, parsed.data.message, blocked, trip);
    return Response.json({ message: blocked, choices: [], conversationId });
  }
  try {
    progress("Loading your trip…");
    const { memoryId, onAccount } = await travelerMemory(req, parsed.data.memoryId);
    const reply = await chat({ ...parsed.data, memoryId }, progress);
    await saveConversationTurn(owner, conversationId, parsed.data.message, reply.message, trip);
    // Their own words, not a button's; kept after the reply goes out, since it takes a few seconds.
    if (!parsed.data.action) after(() => remember(memoryId, parsed.data.message));
    // An account's memory stays on the server; only a text thread keeps its own id.
    return Response.json({ ...reply, conversationId, ...(memoryId && !onAccount && { memoryId }) });
  }
  catch (error) {
    console.error("[trip-chat]", error instanceof Error ? error.message : "Failed");
    // Reasons written for the traveler go through; anything else stays generic.
    if (error instanceof ChatError) return Response.json({ error: `${error.message} Your trip hasn't changed.` }, { status: 422 });
    return Response.json({ error: "Couldn't complete that request. Your trip hasn't changed. Please try again." }, { status: 503 });
  }
}
