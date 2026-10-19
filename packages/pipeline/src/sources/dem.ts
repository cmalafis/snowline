import { readFile, writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fromArrayBuffer } from "geotiff";
import proj4 from "proj4";
import { normDeg, bearingDeg, type LonLat } from "@snowline/core";

/** WGS84 UTM zone for a longitude; EPSG:326xx (north) or 327xx (south). */
export function utmEpsg(lon: number, lat: number): number {
  const zone = Math.floor((lon + 180) / 6) + 1;
  return (lat >= 0 ? 32600 : 32700) + zone;
}

export function utmProjection(epsg: number) {
  const zone = epsg % 100;
  const south = epsg >= 32700;
  const def = `+proj=utm +zone=${zone} ${south ? "+south " : ""}+datum=WGS84 +units=m +no_defs`;
  const p = proj4("EPSG:4326", def);
  return {
    toXY: ([lon, lat]: LonLat): [number, number] => p.forward([lon, lat]) as [number, number],
    toLonLat: ([x, y]: [number, number]): LonLat => p.inverse([x, y]) as LonLat,
  };
}
export type Projection = ReturnType<typeof utmProjection>;

/** A north-up elevation grid in a projected CRS. Row 0 is the northern edge. Values are metres. */
export class Raster {
  constructor(
    readonly width: number,
    readonly height: number,
    /** Projected coordinates of the top-left corner of the top-left cell. */
    readonly originX: number,
    readonly originY: number,
    readonly cellSize: number,
    readonly data: Float32Array,
    readonly source: "3dep" | "open-meteo",
  ) {}

  private at(col: number, row: number): number {
    const c = Math.min(this.width - 1, Math.max(0, col));
    const r = Math.min(this.height - 1, Math.max(0, row));
    return this.data[r * this.width + c]!;
  }

  /** Fractional cell coordinates of a projected point, relative to cell centres. */
  private cell(x: number, y: number): [number, number] {
    return [(x - this.originX) / this.cellSize - 0.5, (this.originY - y) / this.cellSize - 0.5];
  }

  contains(x: number, y: number): boolean {
    const [c, r] = this.cell(x, y);
    return c >= 1 && r >= 1 && c <= this.width - 2 && r <= this.height - 2;
  }

  private bilinear(f: (c: number, r: number) => number, x: number, y: number): number {
    const [c, r] = this.cell(x, y);
    const c0 = Math.floor(c);
    const r0 = Math.floor(r);
    const tc = c - c0;
    const tr = r - r0;
    return (
      f(c0, r0) * (1 - tc) * (1 - tr) + f(c0 + 1, r0) * tc * (1 - tr) + f(c0, r0 + 1) * (1 - tc) * tr + f(c0 + 1, r0 + 1) * tc * tr
    );
  }

  elevation(x: number, y: number): number {
    return this.bilinear((c, r) => this.at(c, r), x, y);
  }

  /** Horn's 3x3 gradient at a cell: [dz/dEast, dz/dNorth] in grid axes. */
  private hornCell(col: number, row: number): [number, number] {
    const z = (dc: number, dr: number) => this.at(col + dc, row + dr);
    const dzdx = (z(1, -1) + 2 * z(1, 0) + z(1, 1) - (z(-1, -1) + 2 * z(-1, 0) + z(-1, 1))) / (8 * this.cellSize);
    const dzdy = (z(-1, -1) + 2 * z(0, -1) + z(1, -1) - (z(-1, 1) + 2 * z(0, 1) + z(1, 1))) / (8 * this.cellSize);
    return [dzdx, dzdy];
  }

  /** Gradient at a projected point, interpolating the gradient components (not the angles) between cells. */
  gradient(x: number, y: number): [number, number] {
    return [this.bilinear((c, r) => this.hornCell(c, r)[0], x, y), this.bilinear((c, r) => this.hornCell(c, r)[1], x, y)];
  }

  /** Box-filtered copy, so single-cell bumps (cat tracks, road cuts, lift towers) don't dominate the gradient. */
  smoothed(radiusM: number): Raster {
    const r = Math.max(0, Math.round(radiusM / this.cellSize));
    if (r === 0) return this;
    const { width: w, height: h } = this;
    const tmp = new Float32Array(w * h);
    const out = new Float32Array(w * h);
    for (let row = 0; row < h; row++)
      for (let col = 0; col < w; col++) {
        let s = 0;
        for (let d = -r; d <= r; d++) s += this.at(col + d, row);
        tmp[row * w + col] = s / (2 * r + 1);
      }
    for (let row = 0; row < h; row++)
      for (let col = 0; col < w; col++) {
        let s = 0;
        for (let d = -r; d <= r; d++) s += tmp[Math.min(h - 1, Math.max(0, row + d)) * w + col]!;
        out[row * w + col] = s / (2 * r + 1);
      }
    return new Raster(w, h, this.originX, this.originY, this.cellSize, out, this.source);
  }
}

/** Pitch and true-north aspect of the terrain at a lon/lat. */
export function slopeAt(dem: Raster, proj: Projection, p: LonLat): { pitchDeg: number; aspectDeg: number; elevationM: number } {
  const [x, y] = proj.toXY(p);
  const [dzdx, dzdy] = dem.gradient(x, y);
  const pitchDeg = (Math.atan(Math.hypot(dzdx, dzdy)) * 180) / Math.PI;
  // Downhill is the negative gradient. Step along it in grid space and measure the bearing on the ellipsoid,
  // which folds in UTM grid convergence (about 1° at Steamboat).
  const len = Math.hypot(dzdx, dzdy) || 1;
  const step = 20;
  const downhill = proj.toLonLat([x - (dzdx / len) * step, y - (dzdy / len) * step]);
  return { pitchDeg, aspectDeg: normDeg(bearingDeg(p, downhill)), elevationM: dem.elevation(x, y) };
}

export interface DemRequest {
  /** Projected bbox [minX, minY, maxX, maxY] in `epsg`. */
  bbox: [number, number, number, number];
  epsg: number;
  cellSize: number;
  cacheFile: string;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function withRetry<T>(fn: () => Promise<T>, attempts: number): Promise<T> {
  for (let i = 1; ; i++) {
    try {
      return await fn();
    } catch (err) {
      if (i >= attempts) throw err;
      await sleep(3000 * i);
    }
  }
}

const THREEDEP = "https://elevation.nationalmap.gov/arcgis/rest/services/3DEPElevation/ImageServer/exportImage";

async function fetch3dep(req: DemRequest): Promise<ArrayBuffer> {
  const [minX, minY, maxX, maxY] = req.bbox;
  const w = Math.round((maxX - minX) / req.cellSize);
  const h = Math.round((maxY - minY) / req.cellSize);
  if (w > 8000 || h > 8000) throw new Error(`DEM request too large (${w}x${h}); shrink the bbox or raise cellSize`);
  const params = new URLSearchParams({
    bbox: req.bbox.join(","),
    bboxSR: String(req.epsg),
    imageSR: String(req.epsg),
    size: `${w},${h}`,
    format: "tiff",
    pixelType: "F32",
    interpolation: "RSP_BilinearInterpolation",
    f: "image",
  });
  const res = await fetch(`${THREEDEP}?${params}`, { signal: AbortSignal.timeout(180_000) });
  const type = res.headers.get("content-type") ?? "";
  if (!res.ok || !type.includes("tiff")) throw new Error(`3DEP ${res.status} ${type}: ${(await res.text()).slice(0, 200)}`);
  return res.arrayBuffer();
}

async function parseTiff(buf: ArrayBuffer): Promise<Raster> {
  const tiff = await fromArrayBuffer(buf);
  const img = await tiff.getImage();
  const [originX, originY] = img.getOrigin() as [number, number];
  const [resX, resY] = img.getResolution() as [number, number];
  if (Math.abs(Math.abs(resX) - Math.abs(resY)) > 1e-6 || resY > 0) throw new Error("Expected a north-up DEM with square cells");
  const [band] = (await img.readRasters()) as unknown as Float32Array[];
  const data = Float32Array.from(band!);
  const noData = Number(img.getGDALNoData() ?? NaN);
  const bad = data.filter((v) => v === noData || v < -1000 || !Number.isFinite(v)).length;
  if (bad > data.length * 0.01) throw new Error(`DEM has ${bad} no-data cells`);
  return new Raster(img.getWidth(), img.getHeight(), originX, originY, Math.abs(resX), data, "3dep");
}

/** Coarse fallback: sample Open-Meteo's ~90 m Copernicus DEM on a grid. */
async function fetchOpenMeteoGrid(req: DemRequest, proj: Projection): Promise<Raster> {
  const cell = Math.max(req.cellSize, 90);
  const [minX, minY, maxX, maxY] = req.bbox;
  const w = Math.ceil((maxX - minX) / cell);
  const h = Math.ceil((maxY - minY) / cell);
  const pts: LonLat[] = [];
  for (let r = 0; r < h; r++) for (let c = 0; c < w; c++) pts.push(proj.toLonLat([minX + (c + 0.5) * cell, maxY - (r + 0.5) * cell]));
  const data = new Float32Array(w * h);
  for (let i = 0; i < pts.length; i += 100) {
    const chunk = pts.slice(i, i + 100);
    const url = `https://api.open-meteo.com/v1/elevation?latitude=${chunk.map((p) => p[1].toFixed(5)).join(",")}&longitude=${chunk.map((p) => p[0].toFixed(5)).join(",")}`;
    let res = await fetch(url);
    for (let attempt = 1; res.status === 429 && attempt <= 5; attempt++) {
      await sleep(5000 * attempt);
      res = await fetch(url);
    }
    if (!res.ok) throw new Error(`Open-Meteo elevation ${res.status}`);
    const { elevation } = (await res.json()) as { elevation: number[] };
    elevation.forEach((e, j) => (data[i + j] = e));
  }
  return new Raster(w, h, minX, maxY, cell, data, "open-meteo");
}

export async function loadDem(req: DemRequest, proj: Projection): Promise<Raster> {
  if (existsSync(req.cacheFile)) {
    const buf = await readFile(req.cacheFile);
    return parseTiff(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));
  }
  try {
    const buf = await withRetry(() => fetch3dep(req), 3);
    const dem = await parseTiff(buf);
    await mkdir(path.dirname(req.cacheFile), { recursive: true });
    await writeFile(req.cacheFile, Buffer.from(buf));
    return dem;
  } catch (err) {
    console.warn(`  3DEP unavailable (${(err as Error).message}${(err as any).cause ? ": " + (err as any).cause : ""}); falling back to Open-Meteo ~90 m elevation`);
    return fetchOpenMeteoGrid(req, proj);
  }
}
