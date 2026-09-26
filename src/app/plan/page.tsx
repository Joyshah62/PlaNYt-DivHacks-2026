import type { Metadata } from "next";
import { PlannerView } from "@/components/plan/PlannerView";
import { BRAND } from "@/lib/plan/display";

export const metadata: Metadata = { title: `Plan your day · ${BRAND.name} ${BRAND.suffix}` };

export default async function PlanPage({ searchParams }: PageProps<"/plan">) {
  const { q, plan } = await searchParams;
  const prompt = (Array.isArray(q) ? q[0] : q)?.trim().slice(0, 1500) || null;
  const code = (Array.isArray(plan) ? plan[0] : plan)?.slice(0, 4000) || null;
  // Keyed by the prompt so arriving with a new one starts a fresh planner. A plan
  // link is not in the key: the planner rewrites it in place after every plan.
  return <PlannerView key={prompt ?? ""} initialPrompt={prompt} initialPlan={code} />;
}
