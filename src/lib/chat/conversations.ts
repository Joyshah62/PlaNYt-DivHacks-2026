import { randomUUID } from "node:crypto";
import { db } from "@/lib/db";

export type ConversationMessage = { role: "user" | "assistant"; text: string; at: Date };
/** The trip a conversation was about: its name, and the plan code that reopens it. */
export type ConversationTrip = { title: string; code: string };
type Conversation = { _id: string; owner: string; messages: ConversationMessage[]; trip?: ConversationTrip; createdAt: Date; updatedAt: Date };
const collection = () => db.collection<Conversation>("tripConversations");

/** Account scoped for signed-in travelers, browser-id scoped otherwise. */
export const conversationOwner = (userId: string | null, anonymousId: string) =>
  userId ? `user:${userId}` : `browser:${anonymousId}`;

export async function saveConversationTurn(owner: string, id: string | null, userText: string, assistantText: string, trip?: ConversationTrip) {
  const conversationId = id ?? randomUUID();
  const now = new Date();
  const messages: ConversationMessage[] = [
    { role: "user", text: userText.slice(0, 2000), at: now },
    { role: "assistant", text: assistantText.slice(0, 4000), at: new Date(now.getTime() + 1) },
  ];
  await collection().updateOne(
    { _id: conversationId, owner },
    // The latest trip wins: a conversation that applied a change is about the day it changed to.
    { $setOnInsert: { createdAt: now }, $set: { updatedAt: now, ...(trip && { trip }) }, $push: { messages: { $each: messages, $slice: -200 } } },
    { upsert: true },
  );
  return conversationId;
}

export async function loadConversation(owner: string, id?: string | null) {
  const conversation = await collection().findOne(id ? { _id: id, owner } : { owner }, {
    sort: { updatedAt: -1 }, projection: { messages: 1, _id: 1, trip: 1 },
  });
  if (!conversation) return null;
  return {
    conversationId: conversation._id,
    trip: conversation.trip ?? null,
    messages: conversation.messages.map(({ role, text, at }) => ({ role, text, at: at.toISOString() })),
  };
}

export type ConversationSummary = {
  conversationId: string;
  /** The traveler's first message, as a name for the conversation. */
  title: string;
  trip: ConversationTrip | null;
  messages: number;
  updatedAt: string;
};

/** An account's conversations with their latest messages, most recent first: the trips page's transcripts. */
export async function recentConversations(owner: string, limit = 30, messages = 40) {
  const list = await collection().find({ owner }, { projection: { messages: { $slice: -messages }, trip: 1, updatedAt: 1 } })
    .sort({ updatedAt: -1 }).limit(limit).toArray();
  return list.map((c) => ({
    conversationId: c._id,
    trip: c.trip ?? null,
    updatedAt: c.updatedAt,
    messages: c.messages.map(({ role, text }) => ({ role, text })),
  }));
}

/** An account's conversations, most recent first, without their messages. */
export async function listConversations(owner: string, limit = 30): Promise<ConversationSummary[]> {
  const list = await collection().aggregate<{ _id: string; first?: string; trip?: ConversationTrip; count: number; updatedAt: Date }>([
    { $match: { owner } },
    { $sort: { updatedAt: -1 } },
    { $limit: limit },
    { $project: { first: { $arrayElemAt: ["$messages.text", 0] }, trip: 1, count: { $size: "$messages" }, updatedAt: 1 } },
  ]).toArray();
  return list.map((c) => ({
    conversationId: c._id,
    title: (c.first ?? "Conversation").slice(0, 120),
    trip: c.trip ?? null,
    messages: c.count,
    updatedAt: c.updatedAt.toISOString(),
  }));
}
