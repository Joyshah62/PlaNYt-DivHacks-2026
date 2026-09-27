import { randomUUID } from "node:crypto";
import { db } from "@/lib/db";

export type ConversationMessage = { role: "user" | "assistant"; text: string; at: Date };
type Conversation = { _id: string; owner: string; messages: ConversationMessage[]; createdAt: Date; updatedAt: Date };
const collection = () => db.collection<Conversation>("tripConversations");

/** Account scoped for signed-in travelers, browser-id scoped otherwise. */
export const conversationOwner = (userId: string | null, anonymousId: string) =>
  userId ? `user:${userId}` : `browser:${anonymousId}`;

export async function saveConversationTurn(owner: string, id: string | null, userText: string, assistantText: string) {
  const conversationId = id ?? randomUUID();
  const now = new Date();
  const messages: ConversationMessage[] = [
    { role: "user", text: userText.slice(0, 2000), at: now },
    { role: "assistant", text: assistantText.slice(0, 4000), at: new Date(now.getTime() + 1) },
  ];
  await collection().updateOne(
    { _id: conversationId, owner },
    { $setOnInsert: { createdAt: now }, $set: { updatedAt: now }, $push: { messages: { $each: messages, $slice: -200 } } },
    { upsert: true },
  );
  return conversationId;
}

export async function loadConversation(owner: string, id?: string | null) {
  const conversation = await collection().findOne(id ? { _id: id, owner } : { owner }, {
    sort: { updatedAt: -1 }, projection: { messages: 1, _id: 1 },
  });
  if (!conversation) return null;
  return {
    conversationId: conversation._id,
    messages: conversation.messages.map(({ role, text, at }) => ({ role, text, at: at.toISOString() })),
  };
}
