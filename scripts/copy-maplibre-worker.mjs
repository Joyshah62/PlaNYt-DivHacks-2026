// MapLibre v6 builds its worker URL at runtime, which bundlers cannot follow.
// Serve the worker (and the shared chunk it imports) as static files instead;
// NeighborhoodMap points setWorkerUrl() at them. Runs on install and build so
// the copy always matches the installed version.
import { copyFileSync, mkdirSync } from "node:fs";

const from = "node_modules/maplibre-gl/dist";
const to = "public/maplibre";
mkdirSync(to, { recursive: true });
for (const file of ["maplibre-gl-worker.mjs", "maplibre-gl-shared.mjs"]) {
  copyFileSync(`${from}/${file}`, `${to}/${file}`);
}
