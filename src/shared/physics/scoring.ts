export const LANDING_POINTS = 100;
export const PRECISION_MAX = 50;
export const SLINGSHOT_POINTS = 10;
export const ASSIST_POINTS = 15;
export const ACE_BONUS = 60;
export const TWO_STAGE_BONUS = 30;
/** Landing at or above this speed earns no precision bonus. */
export const PRECISION_ZERO_SPEED = 500;

export type RunSummary = {
  landed: boolean;
  /** 1..3 */
  stagesUsed: number;
  landingSpeed: number | null;
  /** Other players' debris pieces used on the landing stage. */
  slingshots: number;
};

export type ScoreBreakdown = {
  landing: number;
  precision: number;
  slingshots: number;
  stageBonus: number;
  total: number;
};

export function precisionBonus(landingSpeed: number): number {
  const t = 1 - landingSpeed / PRECISION_ZERO_SPEED;
  const c = t < 0 ? 0 : t > 1 ? 1 : t;
  return Math.round(PRECISION_MAX * c);
}

export function scoreRun(run: RunSummary): ScoreBreakdown {
  if (!run.landed) {
    return { landing: 0, precision: 0, slingshots: 0, stageBonus: 0, total: 0 };
  }
  const landing = LANDING_POINTS;
  const precision =
    run.landingSpeed === null ? 0 : precisionBonus(run.landingSpeed);
  const slingshots = SLINGSHOT_POINTS * run.slingshots;
  const stageBonus =
    run.stagesUsed === 1
      ? ACE_BONUS
      : run.stagesUsed === 2
        ? TWO_STAGE_BONUS
        : 0;
  return {
    landing,
    precision,
    slingshots,
    stageBonus,
    total: landing + precision + slingshots + stageBonus,
  };
}

/**
 * Best pilot short key for a Redis sorted set (higher is better):
 * fewer stages first, then next precision. Non-landers are not ranked.
 */
export function pilotRank(stagesUsed: number, precision: number): number {
  return (4 - stagesUsed) * 1000 + precision;
}
