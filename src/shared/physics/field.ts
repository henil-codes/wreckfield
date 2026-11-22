import {
  NO_WRECK_BEACON,
  NO_WRECK_LAUNCHER,
  PLANET_MU_PER_R2,
  WORLD_H,
  WORLD_W,
} from './constants';
import { intRange, pick, range, rngFromString, type Rng } from './rng';
import type { Archetype, Field, Planet, Vec } from './types';

export const ARCHETYPES: readonly Archetype[] = [
  'gate',
  'slingshot',
  'binary',
  'maze',
];

const EDGE_PAD = 50;
const PLANET_GAP = 50;

function planet(x: number, y: number, r: number): Planet {
  return { x, y, r, mu: PLANET_MU_PER_R2 * r * r };
}

function dist(a: Vec, b: Vec): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}

/** Can planet `p` be added without breaking layout rules? */
export function planetFits(
  p: Planet,
  others: readonly Planet[],
  launcher: Vec,
  beacon: Vec
): boolean {
  if (p.x - p.r < EDGE_PAD || p.x + p.r > WORLD_W - EDGE_PAD) return false;
  if (p.y - p.r < EDGE_PAD || p.y + p.r > WORLD_H - EDGE_PAD) return false;
  if (dist(p, launcher) < NO_WRECK_LAUNCHER + p.r + 40) return false;
  if (dist(p, beacon) < NO_WRECK_BEACON + p.r + 20) return false;
  for (const o of others) {
    if (dist(p, o) < p.r + o.r + PLANET_GAP) return false;
  }
  return true;
}

function addRandomPlanets(
  rng: Rng,
  planets: Planet[],
  count: number,
  rMin: number,
  rMax: number,
  launcher: Vec,
  beacon: Vec
): boolean {
  let added = 0;
  for (let attempt = 0; attempt < 400 && added < count; attempt++) {
    const r = range(rng, rMin, rMax);
    const p = planet(
      range(rng, r, WORLD_W - r),
      range(rng, 300, WORLD_H - 300),
      r
    );
    if (planetFits(p, planets, launcher, beacon)) {
      planets.push(p);
      added++;
    }
  }
  return added === count;
}

function tryPlace(
  planets: Planet[],
  p: Planet,
  launcher: Vec,
  beacon: Vec
): boolean {
  if (!planetFits(p, planets, launcher, beacon)) return false;
  planets.push(p);
  return true;
}

function buildPlanets(
  rng: Rng,
  archeType: Archetype,
  launcher: Vec,
  beacon: Vec
): Planet[] | null {
  const planets: Planet[] = [];
  // Unit vector launcher -> beacon and its perpendicular.
  const lx = beacon.x - launcher.x;
  const ly = beacon.y - launcher.y;
  const len = Math.sqrt(lx * lx + ly * ly);
  const ux = lx / len;
  const uy = ly / len;
  const px = -uy;
  const py = ux;

  switch (archeType) {
    case 'slingshot': {
      // One big body roughly on the direct line: you must curve around it.
      const t = range(rng, 0.42, 0.58);
      const off = range(rng, -50, 50);
      const r = range(rng, 85, 105);
      const big = planet(
        launcher.x + lx * t + px * off,
        launcher.y + ly * t + py * off,
        r
      );
      if (!tryPlace(planets, big, launcher, beacon)) return null;
      if (
        !addRandomPlanets(
          rng,
          planets,
          intRange(rng, 2, 3),
          32,
          50,
          launcher,
          beacon
        )
      )
        return null;
      return planets;
    }
    case 'gate': {
      // Two bodies flanking a gap across the launcher -> beacon line.
      const t = range(rng, 0.45, 0.6);
      const cx = launcher.x + lx * t;
      const cy = launcher.y + ly * t;
      const gap = range(rng, 120, 170);
      const r1 = range(rng, 55, 72);
      const r2 = range(rng, 55, 72);
      const a = planet(cx + px * (gap / 2 + r1), cy + py * (gap / 2 + r1), r1);
      const b = planet(cx - px * (gap / 2 + r2), cy - py * (gap / 2 + r2), r2);
      if (!tryPlace(planets, a, launcher, beacon)) return null;
      // The gate pair is deliberately closer than PLANET_GAP allows elsewhere.
      if (b.x - b.r < EDGE_PAD || b.x + b.r > WORLD_W - EDGE_PAD) return null;
      planets.push(b);
      if (
        !addRandomPlanets(
          rng,
          planets,
          intRange(rng, 1, 2),
          30,
          46,
          launcher,
          beacon
        )
      )
        return null;
      return planets;
    }
    case 'binary': {
      // A tight pair (static for now; orbiting binaries are the Wed-Thu twist).
      const t = range(rng, 0.4, 0.6);
      const off = range(rng, -120, 120);
      const cx = launcher.x + lx * t + px * off;
      const cy = launcher.y + ly * t + py * off;
      const r1 = range(rng, 45, 62);
      const r2 = range(rng, 45, 62);
      const sep = r1 + r2 + range(rng, 60, 100);
      // Random pair axis without trig: random vector, normalized.
      let ax = range(rng, -1, 1);
      let ay = range(rng, -1, 1);
      const al = Math.sqrt(ax * ax + ay * ay) || 1;
      ax /= al;
      ay /= al;
      const a = planet(cx + ax * sep * 0.5, cy + ay * sep * 0.5, r1);
      const b = planet(cx - ax * sep * 0.5, cy - ay * sep * 0.5, r2);
      if (!tryPlace(planets, a, launcher, beacon)) return null;
      if (!planetFits(b, [], launcher, beacon)) return null;
      planets.push(b);
      if (
        !addRandomPlanets(
          rng,
          planets,
          intRange(rng, 1, 2),
          30,
          46,
          launcher,
          beacon
        )
      )
        return null;
      return planets;
    }
    case 'maze': {
      if (
        !addRandomPlanets(
          rng,
          planets,
          intRange(rng, 5, 6),
          32,
          52,
          launcher,
          beacon
        )
      )
        return null;
      return planets;
    }
  }
}

/**
 * Deterministic field from a seed string (e.g. `${subredditId}:${yyyy-mm-dd}`).
 * Layout valid only; use `generateValidatedField` (bot.ts) for playability.
 */
export function generateField(seed: string, archetype?: Archetype): Field {
  const rng = rngFromString(seed);
  const arch = archetype ?? pick(rng, ARCHETYPES);
  for (let attempt = 0; attempt < 200; attempt++) {
    const launcher = { x: range(rng, 380, 620), y: WORLD_H - 110 };
    const beacon = { x: range(rng, 180, 820), y: range(rng, 150, 260) };
    const planets = buildPlanets(rng, arch, launcher, beacon);
    if (planets) return { seed, archetype: arch, launcher, beacon, planets };
  }
  throw new Error(`Could not lay out a ${arch} field for seed ${seed} `);
}


