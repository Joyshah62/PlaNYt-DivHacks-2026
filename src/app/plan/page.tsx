import "./planner.css";
import { edFonts } from "@/components/editorial/fonts";
import type { Metadata } from "next";
import { PlannerView } from "@/components/plan/PlannerView";
import { BRAND } from "@/lib/plan/display";
import { requireTraveler } from "@/lib/session";

export const metadata: Metadata = {
  title: `Plan your day · ${BRAND.name}`,
};

export default async function PlanPage({ searchParams }: PageProps<"/plan">) {
  const { q, plan, chat } = await searchParams;
  const prompt = (Array.isArray(q) ? q[0] : q)?.trim().slice(0, 1500) || null;
  const code = (Array.isArray(plan) ? plan[0] : plan)?.slice(0, 4000) || null;
  const chatId = [Array.isArray(chat) ? chat[0] : chat].find((id) => id && /^[0-9a-f-]{36}$/i.test(id)) ?? null;
  // Signing in comes back here with the same prompt or shared plan.
  const query = new URLSearchParams({ ...(prompt && { q: prompt }), ...(code && { plan: code }), ...(chatId && { chat: chatId }) }).toString();
  const session = await requireTraveler(`/plan${query ? `?${query}` : ""}`);

  // Keyed by the prompt so arriving with a new one starts a fresh planner. A plan
  // link is not in the key: the planner rewrites it in place after every plan.
  return <div className={`ed ${edFonts}`}><PlannerView key={prompt ?? ""} initialPrompt={prompt} initialPlan={code} initialChat={chatId} account={{ name: session.user.name, email: session.user.email, phoneNumber: session.user.phoneNumber ?? null }} /></div>;
}
