import { DEG, normDeg } from "../geo.ts";

export interface SunPosition {
  /** Apparent elevation above the horizon (with refraction), degrees. */
  elevationDeg: number;
  /** Degrees clockwise from true north. */
  azimuthDeg: number;
}

/**
 * NOAA solar position algorithm (the equations behind NOAA's Solar Calculator and its spreadsheet,
 * after Meeus). Good to ~0.01° for current dates.
 */
export function sunPosition(utcMs: number, latDeg: number, lonDeg: number): SunPosition {
  const jd = utcMs / 86_400_000 + 2_440_587.5;
  const T = (jd - 2_451_545) / 36_525;

  const L0 = normDeg(280.46646 + T * (36000.76983 + T * 0.0003032));
  const M = 357.52911 + T * (35999.05029 - 0.0001537 * T);
  const e = 0.016708634 - T * (0.000042037 + 0.0000001267 * T);
  const C =
    Math.sin(M * DEG) * (1.914602 - T * (0.004817 + 0.000014 * T)) +
    Math.sin(2 * M * DEG) * (0.019993 - 0.000101 * T) +
    Math.sin(3 * M * DEG) * 0.000289;
  const omega = 125.04 - 1934.136 * T;
  const lambda = L0 + C - 0.00569 - 0.00478 * Math.sin(omega * DEG);
  const eps0 = 23 + (26 + (21.448 - T * (46.815 + T * (0.00059 - T * 0.001813))) / 60) / 60;
  const eps = eps0 + 0.00256 * Math.cos(omega * DEG);
  const decl = Math.asin(Math.sin(eps * DEG) * Math.sin(lambda * DEG));

  const y = Math.tan((eps / 2) * DEG) ** 2;
  const eqTimeMin =
    (4 / DEG) *
    (y * Math.sin(2 * L0 * DEG) -
      2 * e * Math.sin(M * DEG) +
      4 * e * y * Math.sin(M * DEG) * Math.cos(2 * L0 * DEG) -
      0.5 * y * y * Math.sin(4 * L0 * DEG) -
      1.25 * e * e * Math.sin(2 * M * DEG));

  const utcMinutes = (((utcMs / 60_000) % 1440) + 1440) % 1440;
  const trueSolarMin = (((utcMinutes + eqTimeMin + 4 * lonDeg) % 1440) + 1440) % 1440;
  const hourAngle = (trueSolarMin / 4 < 0 ? trueSolarMin / 4 + 180 : trueSolarMin / 4 - 180) * DEG;

  const lat = latDeg * DEG;
  const cosZen = Math.sin(lat) * Math.sin(decl) + Math.cos(lat) * Math.cos(decl) * Math.cos(hourAngle);
  const zenith = Math.acos(Math.max(-1, Math.min(1, cosZen)));
  const elevation = 90 - zenith / DEG;
  const azimuth = normDeg(
    Math.atan2(Math.sin(hourAngle), Math.cos(hourAngle) * Math.sin(lat) - Math.tan(decl) * Math.cos(lat)) / DEG + 180,
  );

  return { elevationDeg: elevation + refraction(elevation), azimuthDeg: azimuth };
}

/** NOAA's atmospheric refraction approximation, degrees. */
function refraction(elevDeg: number): number {
  if (elevDeg > 85) return 0;
  const te = Math.tan(elevDeg * DEG);
  let arcsec: number;
  if (elevDeg > 5) arcsec = 58.1 / te - 0.07 / te ** 3 + 0.000086 / te ** 5;
  else if (elevDeg > -0.575) arcsec = 1735 + elevDeg * (-518.2 + elevDeg * (103.4 + elevDeg * (-12.79 + elevDeg * 0.711)));
  else arcsec = -20.772 / te;
  return arcsec / 3600;
}
