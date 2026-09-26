import { chat, ChatInput } from "@/lib/discover/chat";

export async function POST(req: Request) {
  let body: unknown;
  try { body = await req.json(); }
  catch { return Response.json({ error: "Expected a JSON body." }, { status: 400 }); }
  const parsed = ChatInput.safeParse(body);
  if (!parsed.success) return Response.json({ error: "Please refresh your trip and try that request again." }, { status: 400 });
  try { return Response.json(await chat(parsed.data)); }
  catch (error) {
    console.error("[trip-chat]", error instanceof Error ? error.message : "Failed");
    return Response.json({ error: "Couldn't complete that request. Your trip hasn't changed. Please try again." }, { status: 503 });
  }
}
