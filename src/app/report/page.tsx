import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ReportView } from "@/components/report/ReportView";
import { decodePreferences } from "@/lib/preferences";

export async function generateMetadata({ searchParams }: PageProps<"/report">): Promise<Metadata> {
  const { address } = await searchParams;
  const query = (Array.isArray(address) ? address[0] : address)?.trim();
  return { title: query ? `${query} · RentCheck NYC` : "RentCheck NYC" };
}

export default async function ReportPage({ searchParams }: PageProps<"/report">) {
  const { address, p, to } = await searchParams;
  const query = (Array.isArray(address) ? address[0] : address)?.trim();

  if (!query) redirect("/");

  const preferences = decodePreferences({ p, to });

  // Keyed by address and priorities so a new search remounts with clean state
  // rather than resetting it inside an effect.
  return <ReportView key={`${query}|${p ?? ""}|${to ?? ""}`} address={query} preferences={preferences} />;
}
