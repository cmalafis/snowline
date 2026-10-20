import { readFile, writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import proj4 from "proj4";
import type { LonLat } from "@snowline/core";

/**
 * NLCD 2021 Tree Canopy Cover (USFS/MRLC, public domain): percent tree canopy per 30 m cell, CONUS Albers.
 * Served by MRLC's GeoServer as an uncompressed 8-bit tiled GeoTIFF.
 */
const WCS = "https://www.mrlc.gov/geoserver/mrlc_download/wcs";
const COVERAGE = "mrlc_download__nlcd_tcc_conus_2021_v2021-4";
const ALBERS = "+proj=aea +lat_0=23 +lon_0=-96 +lat_1=29.5 +lat_2=45.5 +x_0=0 +y_0=0 +datum=NAD83 +units=m +no_defs";
const toAlbers = proj4("EPSG:4326", ALBERS);

export class CanopyGrid {
  constructor(
    readonly width: number,
    readonly height: number,
    readonly originX: number,
    readonly originY: number,
    readonly cell: number,
    readonly data: Uint8Array,
  ) {}

  /** Canopy percent in the cell at a point, or null outside the grid / no data. */
  at(p: LonLat): number | null {
    const [x, y] = toAlbers.forward(p) as [number, number];
    return this.cellValue(Math.floor((x - this.originX) / this.cell), Math.floor((this.originY - y) / this.cell));
  }

  /** Mean canopy percent within `radiusM` of a point: the trees around a run, not just on it. */
  around(p: LonLat, radiusM: number): number | null {
    const [x, y] = toAlbers.forward(p) as [number, number];
    const c0 = Math.floor((x - this.originX) / this.cell);
    const r0 = Math.floor((this.originY - y) / this.cell);
    const k = Math.max(1, Math.round(radiusM / this.cell));
    let sum = 0;
    let n = 0;
    for (let dr = -k; dr <= k; dr++)
      for (let dc = -k; dc <= k; dc++) {
        if (dr * dr + dc * dc > k * k) continue;
        const v = this.cellValue(c0 + dc, r0 + dr);
        if (v !== null) (sum += v), n++;
      }
    return n ? sum / n : null;
  }

  private cellValue(c: number, r: number): number | null {
    if (c < 0 || r < 0 || c >= this.width || r >= this.height) return null;
    const v = this.data[r * this.width + c]!;
    return v <= 100 ? v : null; // 254/255 are no-data codes
  }
}

/**
 * Minimal reader for uncompressed 8-bit single-band GeoTIFFs, tiled or striped, either byte order. Returns the
 * top-left corner and cell size from the GeoTIFF tiepoint and pixel-scale tags.
 */
export function readUint8Tiff(buf: Buffer): { width: number; height: number; data: Uint8Array; originX: number; originY: number; cell: number } {
  const le = buf.toString("ascii", 0, 2) === "II";
  const u16 = (o: number) => (le ? buf.readUInt16LE(o) : buf.readUInt16BE(o));
  const u32 = (o: number) => (le ? buf.readUInt32LE(o) : buf.readUInt32BE(o));
  const f64 = (o: number) => (le ? buf.readDoubleLE(o) : buf.readDoubleBE(o));
  if (u16(2) !== 42) throw new Error("Not a classic TIFF");
  const ifd = u32(4);
  const tags = new Map<number, number[]>();
  for (let i = 0; i < u16(ifd); i++) {
    const e = ifd + 2 + i * 12;
    const [tag, type, count] = [u16(e), u16(e + 2), u32(e + 4)];
    const size = type === 3 ? 2 : type === 4 ? 4 : type === 12 ? 8 : 0;
    if (!size) continue;
    const off = size * count <= 4 ? e + 8 : u32(e + 8);
    const read = (k: number) => (type === 3 ? u16(off + k * 2) : type === 4 ? u32(off + k * 4) : f64(off + k * 8));
    tags.set(tag, Array.from({ length: count }, (_, k) => read(k)));
  }
  const one = (t: number) => tags.get(t)?.[0];
  const width = one(256)!;
  const height = one(257)!;
  if ((one(258) ?? 8) !== 8 || (one(259) ?? 1) !== 1 || (one(277) ?? 1) !== 1) throw new Error("Expected an uncompressed 8-bit single-band TIFF");
  const data = new Uint8Array(width * height);
  const tw = one(322);
  if (tw) {
    const th = one(323)!;
    const offsets = tags.get(324)!;
    const across = Math.ceil(width / tw);
    offsets.forEach((off, t) => {
      const tx = (t % across) * tw;
      const ty = Math.floor(t / across) * th;
      for (let r = 0; r < th && ty + r < height; r++)
        for (let c = 0; c < tw && tx + c < width; c++) data[(ty + r) * width + tx + c] = buf[off + r * tw + c]!;
    });
  } else {
    const rowsPerStrip = one(278) ?? height;
    tags.get(273)!.forEach((off, s) => {
      const start = s * rowsPerStrip * width;
      data.set(buf.subarray(off, off + Math.min(rowsPerStrip * width, width * height - start)), start);
    });
  }
  // Georeferencing: ModelTransformation (34264, a 4x4 matrix, x = m0*i + m3, y = m5*j + m7), or
  // ModelTiepoint (33922, raster (i, j) -> model (x, y)) with ModelPixelScale (33550).
  const m = tags.get(34264);
  if (m) return { width, height, data, originX: m[3]!, originY: m[7]!, cell: m[0]! };
  const tie = tags.get(33922);
  const scale = tags.get(33550);
  if (!tie || !scale) throw new Error("GeoTIFF has no georeferencing");
  return { width, height, data, originX: tie[3]! - tie[0]! * scale[0]!, originY: tie[4]! + tie[1]! * scale[1]!, cell: scale[0]! };
}

/** Canopy grid covering a lon/lat bbox [west, south, east, north], cached at `cacheFile`. Null if unavailable. */
export async function loadCanopy(bbox: [number, number, number, number], cacheFile: string): Promise<CanopyGrid | null> {
  const [w, s, e, n] = bbox;
  const corners = [[w, s], [e, s], [w, n], [e, n]].map((p) => toAlbers.forward(p) as [number, number]);
  const cell = 30;
  // Snap to the 30 m grid so cached and fresh requests line up.
  const minX = Math.floor(Math.min(...corners.map((p) => p[0])) / cell) * cell;
  const maxX = Math.ceil(Math.max(...corners.map((p) => p[0])) / cell) * cell;
  const minY = Math.floor(Math.min(...corners.map((p) => p[1])) / cell) * cell;
  const maxY = Math.ceil(Math.max(...corners.map((p) => p[1])) / cell) * cell;
  let buf: Buffer;
  if (existsSync(cacheFile)) buf = await readFile(cacheFile);
  else {
    const params = new URLSearchParams({ service: "WCS", version: "2.0.1", request: "GetCoverage", coverageId: COVERAGE, format: "image/geotiff" });
    params.append("subset", `X(${minX},${maxX})`);
    params.append("subset", `Y(${minY},${maxY})`);
    try {
      const res = await fetch(`${WCS}?${params}`, { signal: AbortSignal.timeout(120_000) });
      if (!res.ok || !(res.headers.get("content-type") ?? "").includes("tiff")) throw new Error(`MRLC ${res.status}`);
      buf = Buffer.from(await res.arrayBuffer());
      await mkdir(path.dirname(cacheFile), { recursive: true });
      await writeFile(cacheFile, buf);
    } catch (err) {
      console.warn(`  tree canopy unavailable (${(err as Error).message}); scoring falls back to run types`);
      return null;
    }
  }
  const t = readUint8Tiff(buf);
  return new CanopyGrid(t.width, t.height, t.originX, t.originY, t.cell, t.data);
}
