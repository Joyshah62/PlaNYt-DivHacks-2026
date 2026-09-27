import { after } from "next/server";
import { chat, ChatError, ChatInput } from "@/lib/discover/chat";
import { memoryFor, remember } from "@/lib/memory/backboard";

export async function POST(req: Request) {
  let body: unknown;
  try { body = await req.json(); }
  catch { return Response.json({ error: "Expected a JSON body." }, { status: 400 }); }
  const parsed = ChatInput.safeParse(body);
  if (!parsed.success) return Response.json({ error: "Please refresh your trip and try that request again." }, { status: 400 });
  try {
    const memoryId = await memoryFor(parsed.data.memoryId);
    const reply = await chat({ ...parsed.data, memoryId });
    // Their own words, not a button's; kept after the reply goes out, since it takes a few seconds.
    if (!parsed.data.action) after(() => remember(memoryId, parsed.data.message));
    return Response.json({ ...reply, ...(memoryId && { memoryId }) });
  }
  catch (error) {
    console.error("[trip-chat]", error instanceof Error ? error.message : "Failed");
    // Reasons written for the traveler go through; anything else stays generic.
    if (error instanceof ChatError) return Response.json({ error: `${error.message} Your trip hasn't changed.` }, { status: 422 });
    return Response.json({ error: "Couldn't complete that request. Your trip hasn't changed. Please try again." }, { status: 503 });
  }
}
