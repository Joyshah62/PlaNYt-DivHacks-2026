import { buildReport } from "@/lib/nyc/analyze";
import { AddressNotFoundError, resolveAddress } from "@/lib/nyc/geosearch";
import {
  fetchBuilding,
  fetchOpenViolations,
  fetchProblemsByCategory,
  fetchProblemsLast12Months,
  fetchSeriousOpenViolations,
  fetchViolationClassCounts,
  fetchViolationsByCategory,
} from "@/lib/nyc/queries";
import type { BuildingReport } from "@/lib/nyc/types";

/**
 * A tiny in-memory cache. Not for scale - it keeps repeat searches instant and
 * stops development hammering NYC Open Data.
 */
const cache = new Map<string, { report: BuildingReport; at: number }>();
const CACHE_TTL_MS = 10 * 60 * 1000;

export async function GET(request: Request) {
  const address = new URL(request.url).searchParams.get("address")?.trim();

  if (!address) {
    return Response.json(
      { error: "Enter an NYC address to check a building." },
      { status: 400 },
    );
  }

  const cached = cache.get(address.toLowerCase());
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) {
    return Response.json(cached.report);
  }

  let resolved;
  try {
    resolved = await resolveAddress(address);
  } catch (error) {
    if (error instanceof AddressNotFoundError) {
      return Response.json(
        {
          error: "We couldn't find that NYC address.",
          hint: "Try including the borough, for example “123 Bedford Ave, Brooklyn”.",
        },
        { status: 404 },
      );
    }
    console.error("[building-report] address lookup failed:", error);
    return Response.json(
      { error: "Address lookup is temporarily unavailable. Please try again." },
      { status: 503 },
    );
  }

  // Every query reports its own success, emptiness, and timing, so a single
  // failed dataset degrades the report instead of taking it down - and is
  // never mistaken for a building with nothing on record.
  const [
    building,
    violationClasses,
    violationCategories,
    problemCategories,
    problemsRecent,
    openViolations,
    seriousOpenViolations,
  ] = await Promise.all([
    fetchBuilding(resolved.bbl),
    fetchViolationClassCounts(resolved.bin),
    fetchViolationsByCategory(resolved.bin),
    fetchProblemsByCategory(resolved.bin),
    fetchProblemsLast12Months(resolved.bin),
    fetchOpenViolations(resolved.bin),
    fetchSeriousOpenViolations(resolved.bin),
  ]);

  const report = buildReport({
    address: resolved,
    now: new Date(),
    building,
    violationClasses,
    violationCategories,
    problemCategories,
    problemsRecent,
    openViolations,
    seriousOpenViolations,
  });

  cache.set(address.toLowerCase(), { report, at: Date.now() });
  return Response.json(report);
}
