// MapLibre's web worker can't be bundled by Next, so serve its prebuilt ES-module worker (and the chunk it imports) from public/.
import { copyFileSync, mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

const dist = path.dirname(createRequire(import.meta.url).resolve("maplibre-gl/dist/maplibre-gl.mjs"));
const out = path.resolve(import.meta.dirname, "../public/maplibre");
mkdirSync(out, { recursive: true });
for (const f of ["maplibre-gl-worker.mjs", "maplibre-gl-shared.mjs"]) copyFileSync(path.join(dist, f), path.join(out, f));
