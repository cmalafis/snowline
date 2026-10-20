import type { Difficulty, RunType } from "../types.ts";

/** Every threshold the scoring model uses. Tune here, not in score.ts. */
export interface ScoringConfig {
  stepHours: number;
  /** Day window the energy integration covers. */
  dayStartHour: number;
  dayEndHour: number;
  lapseFPer1000Ft: number;

  // Softening energy: radiation counts fully above `sunFullF`, not at all below `sunMinF`.
  sunMinF: number;
  sunFullF: number;
  /**
   * Heat exchanged with the air, per °F away from `meltF`, per hour: warm air softens snow even in the shade
   * (why low base-area terrain goes first in spring), cold air takes energy back. Energy never drops below zero.
   */
  meltF: number;
  airRatePerF: number;
  /** Absorbed radiation above this counts as "in the sun". */
  inSunThreshold: number;

  /**
   * A slope refreezes only if it melted yesterday: yesterday's high and last night's low at its elevation, plus
   * enough sun over a full day (today's total energy stands in for yesterday's) that its surface went wet.
   */
  refreeze: {
    yesterdayHighAboveF: number;
    overnightLowBelowF: number;
    cancelledBySnowIn: number;
    minDailyEnergy: number;
  };
  /** Energy (normalised kWh/m²) at which each surface stage begins after a refreeze. */
  surface: { softening: number; prime: number; heavy: number; slush: number };
  /** Without a refreeze: heavy when warmer than this and energy above `heavy`. */
  winterHeavyF: number;

  /**
   * Powder: bonus scales with new snow up to `fullIn`, decays with tracking. Snow falling during the day refills
   * tracks (`refillHoursPerIn` hours of tracking erased per inch), and off-piste keeps `settledShare` of older storm snow.
   */
  powder: {
    minIn: number;
    fullIn: number;
    maxBonus: number;
    trackRateGroomer: number;
    trackRateOpen: number;
    trackRateTree: number;
    maxDecay: number;
    refillHoursPerIn: number;
    settledShare: number;
  };
  /** New snow is counted from this hour (the overnight report); snow after it accumulates during the day. */
  snowReportHour: number;
  /** Penalty while rain is falling on a run, and the rate (in/hr) that counts. */
  rain: { minInPerHour: number; penalty: number };
  flatLightCloud: number;
  wind: { breezyGustMph: number; holdGustMph: number };
  coldF: number;

  /** Relative skier traffic, 0..1.5, by difficulty and run type. */
  traffic: { byDifficulty: Record<Difficulty, number>; byType: Record<RunType, number> };
  labels: { prime: number; good: number; fair: number };
}

export const DEFAULT_SCORING: ScoringConfig = {
  stepHours: 0.25,
  dayStartHour: 5,
  dayEndHour: 17.5,
  lapseFPer1000Ft: 3.5,

  sunMinF: 15,
  sunFullF: 26,
  meltF: 32,
  airRatePerF: 0.02,
  inSunThreshold: 0.25,

  // Calibrated against Steamboat's aspect order and Crested Butte's published spring timing
  // (packages/pipeline/test/calibration.test.ts).
  refreeze: { yesterdayHighAboveF: 34, overnightLowBelowF: 28, cancelledBySnowIn: 3, minDailyEnergy: 2.3 },
  surface: { softening: 0.52, prime: 1.04, heavy: 2.32, slush: 3.36 },
  winterHeavyF: 34,

  powder: {
    minIn: 4,
    fullIn: 14,
    maxBonus: 40,
    trackRateGroomer: 0.2,
    trackRateOpen: 0.12,
    trackRateTree: 0.06,
    maxDecay: 0.85,
    refillHoursPerIn: 0.5,
    settledShare: 0.35,
  },
  snowReportHour: 8,
  rain: { minInPerHour: 0.01, penalty: 22 },
  flatLightCloud: 80,
  wind: { breezyGustMph: 25, holdGustMph: 35 },
  coldF: 10,

  traffic: {
    byDifficulty: { novice: 1.2, easy: 1.2, intermediate: 1.0, advanced: 0.7, expert: 0.45, freeride: 0.3, extreme: 0.3, unknown: 0.8 },
    byType: { groomer: 1.0, bump: 0.8, tree: 0.5, bowl: 0.6 },
  },
  labels: { prime: 80, good: 65, fair: 50 },
};
