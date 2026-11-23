import {
  MAX_LAUNCH_SPEED,
  MIN_LAUNCH_SPEED,
  STAGES_PER_DAY,
} from './constants';
import { addDebris, decayDebris, placeWreck, usedDebris } from './debris';
import { generateField } from './field';
import { EPITAPHS } from '../epitaphs';
import { pick, range, rngFromString, type Rng } from './rng';
import { scoreRun } from './scoring';
import { minDistanceTo, simulateStage } from './simulate';
import type { Archetype, Debris, Field, Vec } from './types';

/**
 * A bot "player". `candidates` = how many full shots it previews before
 * commiting (a stand-in for skill); `noise` = aim error as a fraction of
 * max speed, applied after choosing.
 */
export type BotProfile = { candidates: number; noise: number };

/** Mixed population: a few sharp players, mostly casual ones. Calibrate against real play. */
export const DEFAULT_POPULATION: readonly BotProfile[] = [
  { candidates: 32, noise: 0.004 },
  { candidates: 16, noise: 0.008 },
  { candidates: 10, noise: 0.012 },
  { candidates: 6, noise: 0.016 },
  { candidates: 4, noise: 0.02 },
];

function randomLaunch(rng: Rng): Vec {
  for (;;) {
    const x = range(rng, -MAX_LAUNCH_SPEED, MAX_LAUNCH_SPEED);
    const y = range(rng, -MAX_LAUNCH_SPEED, MAX_LAUNCH_SPEED);
    const l2 = x * x + y * y;
    if (
      l2 <= MAX_LAUNCH_SPEED * MAX_LAUNCH_SPEED &&
      l2 >= MIN_LAUNCH_SPEED * MIN_LAUNCH_SPEED
    ) {
      return { x, y };
    }
  }
}

function gaussian(rng: Rng): number {
  // Irwin-Hall approximation: no log/trig needed.
  return rng() + rng() + rng() + rng() + rng() + rng() - 3;
}

export function botChooseLaunch(
  field: Field,
  debris: readonly Debris[],
  start: Vec,
  rng: Rng,
  profile: BotProfile
): Vec {
  let best = randomLaunch(rng);
  let bestScore = Infinity;
  for (let i = 0; i < profile.candidates; i++) {
    const v = randomLaunch(rng);
    const res = simulateStage(field, debris, start, v);
    const score =
      res.outcome === 'landed' ? -1 : minDistanceTo(res.path, field.beacon);
    if (score < bestScore) {
      bestScore = score;
      best = v;
    }
  }
  const s = profile.noise * MAX_LAUNCH_SPEED;
  return { x: best.x + gaussian(rng) * s, y: best.y + gaussian(rng) * s };
}

export type RunResult = {
  landed: boolean;
  stagesUsed: number;
  score: number;
  usedDebrisIds: string[];
  debris: Debris[];
};

/** Play one bot's whole day (up to 3 stages) agaist the evolving debris field. */
export function playBotRun(
  field: Field,
  debrisIn: readonly Debris[],
  rng: Rng,
  profile: BotProfile,
  owner: string,
  frozen: boolean
): RunResult {
  let debris = debrisIn.slice();
  let start: Vec = field.launcher;
  for (let stage = 1; stage <= STAGES_PER_DAY; stage++) {
    debris = decayDebris(debris, frozen);
    const v = botChooseLaunch(field, debris, start, rng, profile);
    const res = simulateStage(field, debris, start, v);
    if (res.outcome === 'landed') {
      const used = usedDebris(res, debris, owner);
      const score = scoreRun({
        landed: true,
        stagesUsed: stage,
        landingSpeed: res.landingSpeed,
        slingshots: used.length,
      }).total;
      return {
        landed: true,
        stagesUsed: stage,
        score,
        usedDebrisIds: used,
        debris,
      };
    }
    if (res.wreck) {
      const at = placeWreck(field, res.wreck);
      if (at) {
        debris = addDebris(debris, {
          id: `${owner}:${stage}`,
          x: at.x,
          y: at.y,
          owner,
          epitaph: pick(rng, EPITAPHS),
          strength: 1,
        });
      }
    }
    start = res.next;
  }
  return {
    landed: false,
    stagesUsed: STAGES_PER_DAY,
    score: 0,
    usedDebrisIds: [],
    debris,
  };
}

export type DayStats = {
  players: number;
  aces: number;
  landings: number;
  fails: number;
  landingsUsingDebris: number;
  finalDebris: number;
  assistsByOwner: Map<string, number>;
};

export function simulateDay(
  field: Field,
  players: number,
  seed: string,
  population: readonly BotProfile[] = DEFAULT_POPULATION,
  frozen = false
): DayStats {
  const rng = rngFromString(`${seed}:bots`);
  let debris: Debris[] = [];
  const stats: DayStats = {
    players,
    aces: 0,
    landings: 0,
    fails: 0,
    landingsUsingDebris: 0,
    finalDebris: 0,
    assistsByOwner: new Map(),
  };

  const owners = new Map<string, string>();
  for (let i = 0; i < players; i++) {
    const profile = population[i % population.length];
    if (!profile) continue;
    const owner = `bot_${i}`;
    const run = playBotRun(field, debris, rng, profile, owner, frozen);
    debris = run.debris;
    for (const d of debris) owners.set(d.id, d.owner);
    if (run.landed) {
      stats.landings++;
      if (run.stagesUsed === 1) stats.aces++;
      if (run.usedDebrisIds.length > 0) stats.landingsUsingDebris++;
      for (const id of run.usedDebrisIds) {
        const o = owners.get(id);
        if (o)
          stats.assistsByOwner.set(o, (stats.assistsByOwner.get(o) ?? 0) + 1);
      }
    } else {
      stats.fails++;
    }
  }
  stats.finalDebris = debris.length;
  return stats;
}

export type Verdict = {
  ok: boolean;
  reason: string;
  aceRate: number;
  landRate: number;
};

/** Accept a field if it's neither unsolvable nor trival for the bot population */
export function judgeField(stats: DayStats): Verdict {
  const aceRate = stats.aces / stats.players;
  const landRate = stats.landings / stats.players;
  if (landRate < 0.3)
    return { ok: false, reason: 'too hard', aceRate, landRate };
  if (aceRate > 0.35)
    return { ok: false, reason: 'too eazy', aceRate, landRate };
  if (landRate > 0.85)
    return { ok: false, reason: 'too eazy', aceRate, landRate };
  return { ok: true, reason: 'ok', aceRate, landRate };
}

/** Regenerate with suffixed seeds until a field passes. Deterministic for a given seed. */
export function generateValidatedField(
  seed: string,
  archetype: Archetype,
  botsPerCheck = 60,
  maxAttempts = 12
): { field: Field; stats: DayStats; attempts: number } {
  let fallback: { field: Field; stats: DayStats } | null = null;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const field = generateField(
      attempt === 0 ? seed : `${seed}#${attempt}`,
      archetype
    );
    const stats = simulateDay(field, botsPerCheck, field.seed);
    if (judgeField(stats).ok) return { field, stats, attempts: attempt + 1 };
    if (!fallback || stats.landings > fallback.stats.landings)
      fallback = { field, stats };
  }
  if (!fallback) throw new Error('unreachable');
  return { ...fallback, attempts: maxAttempts };
}
