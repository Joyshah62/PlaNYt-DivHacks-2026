// Builds src/lib/plan/crowd-data.json: typical riders per hour at every subway
// station complex, by weekday and hour, from MTA Subway Hourly Ridership.
//
//   node scripts/build-crowd-data.mjs [weeks=5]
//
// Takes the last N complete Sunday-Saturday weeks and keeps the median per
// slot, so a single holiday week does not skew the typical day. Each week is one
// request (~5 s); a longer range in one query times out on the public API.

import { writeFile } from "node:fs/promises";

const DATASET = "https://data.ny.gov/resource/5wq4-mkjj.json";
const OUT = new URL("../src/lib/plan/crowd-data.json", import.meta.url);
const WEEKS = Number(process.argv[2] ?? 5);

async function query(params) {
  const url = `${DATASET}?${new URLSearchParams({ $limit: "200000", ...params })}`;
  for (let attempt = 0; attempt < 3; attempt++) {
    const res = await fetch(url, { signal: AbortSignal.timeout(120_000) });
    if (res.ok) return res.json();
    console.warn(`  ${res.status}, retrying`);
    await new Promise((r) => setTimeout(r, 3000));
  }
  throw new Error(`MTA query failed: ${url}`);
}

const day = (d) => d.toISOString().slice(0, 10);

const [{ latest }] = await query({ $select: "max(transit_timestamp) as latest" });
// Timestamps are local NYC time with no zone; treat them as UTC dates throughout.
const end = new Date(`${latest.slice(0, 10)}T00:00:00Z`);
// Back up to the last Saturday that is fully covered.
if (!latest.startsWith(day(end)) || latest.slice(11, 13) !== "23") end.setUTCDate(end.getUTCDate() - 1);
while (end.getUTCDay() !== 6) end.setUTCDate(end.getUTCDate() - 1);

/** samples[stationId][dow*24+hour] = riders in each week */
const samples = new Map();
const weeks = [];
for (let w = 0; w < WEEKS; w++) {
  const last = new Date(end);
  last.setUTCDate(end.getUTCDate() - 7 * w);
  const first = new Date(last);
  first.setUTCDate(last.getUTCDate() - 6);
  weeks.push(`${day(first)}..${day(last)}`);
  console.log(`week ${day(first)} .. ${day(last)}`);
  const rows = await query({
    $select: "station_complex_id,transit_timestamp,sum(ridership) as r",
    $where: `transit_mode='subway' AND transit_timestamp between '${day(first)}T00:00:00' and '${day(last)}T23:00:00'`,
    $group: "station_complex_id,transit_timestamp",
  });
  for (const row of rows) {
    const t = new Date(`${row.transit_timestamp.slice(0, 19)}Z`);
    const slot = t.getUTCDay() * 24 + t.getUTCHours();
    if (!samples.has(row.station_complex_id)) samples.set(row.station_complex_id, Array.from({ length: 168 }, () => []));
    samples.get(row.station_complex_id)[slot].push(Number(row.r));
  }
}

console.log("stations");
const meta = await query({
  $select: "station_complex_id,station_complex,borough,latitude,longitude",
  $where: `transit_mode='subway' AND transit_timestamp between '${day(end)}T12:00:00' and '${day(end)}T12:00:00'`,
  $group: "station_complex_id,station_complex,borough,latitude,longitude",
});

function median(values, weeksSeen) {
  // A missing week means no riders were recorded in that hour, not unknown.
  const all = [...values, ...Array(Math.max(0, weeksSeen - values.length)).fill(0)].sort((a, b) => a - b);
  const mid = Math.floor(all.length / 2);
  return all.length % 2 ? all[mid] : (all[mid - 1] + all[mid]) / 2;
}

const stations = [];
const seen = new Set();
for (const m of meta) {
  if (seen.has(m.station_complex_id)) continue;
  const slots = samples.get(m.station_complex_id);
  if (!slots) continue;
  seen.add(m.station_complex_id);
  stations.push({
    id: m.station_complex_id,
    name: m.station_complex,
    borough: m.borough,
    lat: Number(Number(m.latitude).toFixed(5)),
    lon: Number(Number(m.longitude).toFixed(5)),
    riders: slots.map((s) => Math.round(median(s, WEEKS))),
  });
}
stations.sort((a, b) => Number(a.id) - Number(b.id));

await writeFile(
  OUT,
  JSON.stringify({ source: "MTA Subway Hourly Ridership (data.ny.gov 5wq4-mkjj)", weeks, stations }) + "\n",
);
console.log(`wrote ${stations.length} stations`);
