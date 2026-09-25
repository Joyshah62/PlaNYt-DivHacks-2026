import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { SiteHeader } from "@/components/SiteHeader";
import { PreferencesForm } from "@/components/preferences/PreferencesForm";
import { decodePreferences } from "@/lib/preferences";

export const metadata: Metadata = {
  title: "Your priorities · RentCheck NYC",
};

export default async function PreferencesPage({ searchParams }: PageProps<"/preferences">) {
  const { address, p, to } = await searchParams;
  const query = (Array.isArray(address) ? address[0] : address)?.trim();
  if (!query) redirect("/");

  return (
    <>
      <SiteHeader search={false} />
      <main className="flex-1">
        {/* Keyed so a different address starts from a clean form. */}
        <PreferencesForm key={query} address={query} initial={decodePreferences({ p, to })} />
      </main>
    </>
  );
}
