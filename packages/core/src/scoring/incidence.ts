import { DEG } from "../geo.ts";
import type { SunPosition } from "./solar.ts";

/**
 * Cosine of the angle between the sun and the slope's normal:
 * cos i = cos(s)·sin(e) + sin(s)·cos(e)·cos(az_sun − aspect), clamped at zero.
 * 1 means the sun hits the slope square on; 0 means the slope is in its own shadow (or the sun is down).
 */
export function incidence(sun: SunPosition, aspectDeg: number, pitchDeg: number): number {
  if (sun.elevationDeg <= 0) return 0;
  const s = pitchDeg * DEG;
  const e = sun.elevationDeg * DEG;
  return Math.max(0, Math.cos(s) * Math.sin(e) + Math.sin(s) * Math.cos(e) * Math.cos((sun.azimuthDeg - aspectDeg) * DEG));
}

/** Clear-sky direct normal irradiance, W/m² (Meinel model with Laue's altitude correction). */
export function clearSkyDni(sunElevationDeg: number, altitudeM: number): number {
  if (sunElevationDeg <= 0) return 0;
  const am = 1 / (Math.sin(sunElevationDeg * DEG) + 0.50572 * (sunElevationDeg + 6.07995) ** -1.6364);
  const h = altitudeM / 1000;
  return 1353 * ((1 - 0.14 * h) * 0.7 ** (am ** 0.678) + 0.14 * h);
}

/** Direct and diffuse irradiance, from the forecast if it has them, else clear sky scaled by cloud cover. */
export function irradiance(
  sun: SunPosition,
  altitudeM: number,
  cloudCover: number,
  forecast?: { directNormal?: number; diffuse?: number },
): { dni: number; diffuse: number } {
  if (sun.elevationDeg <= 0) return { dni: 0, diffuse: 0 };
  if (forecast?.directNormal !== undefined && forecast.diffuse !== undefined) return { dni: forecast.directNormal, diffuse: forecast.diffuse };
  const c = Math.max(0, Math.min(1, cloudCover / 100));
  const clear = clearSkyDni(sun.elevationDeg, altitudeM);
  return {
    dni: clear * (1 - c) ** 1.5,
    diffuse: clear * Math.sin(sun.elevationDeg * DEG) * (0.08 + 0.25 * c),
  };
}

/** Radiation absorbed by a slope, normalised so a slope square to a clear high-altitude sun is ~1. */
export function slopeRadiation(sun: SunPosition, aspectDeg: number, pitchDeg: number, irr: { dni: number; diffuse: number }): number {
  const skyView = (1 + Math.cos(pitchDeg * DEG)) / 2;
  return (irr.dni * incidence(sun, aspectDeg, pitchDeg) + irr.diffuse * skyView) / 1000;
}
