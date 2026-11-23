import {
  DEBRIS_DECAY_PER_LAUNCH,
  DEBRIS_MIN_STRENGTH,
  DEBRIS_USED_DV,
  MAX_DEBRIS,
  NO_WRECK_BEACON,
  NO_WRECK_LAUNCHER,
  WORLD_H,
  WORLD_W,
  WRECK_EDGE_INSET,
  WRECk_SURFACE_GAP,
} from './constants.ts';
import type { Debris, Field, StageResult, Vec } from './types.ts';

function pushOutOf(p: Vec, c: Vec, radius: number): Vec {
  const dx = p.x - c.x;
  const dy = p.y - c.y;
  const d2 = dx * dx + dy * dy;
  if (d2 >= radius * radius) return p;
  const d = Math.sqrt(d2);
  // Exactly on the center: push straight down (towards the launcher side).
  const ux = d > 1e-9 ? dx / d : 0;
  const uy = d > 1e-9 ? dy / d : 1;
  return { x: c.x + ux * radius, y: c.y + uy * radius };
}

function inside(p: Vec, c: Vec, radius: number): boolean {
  const dx = p.x - c.x;
  const dy = p.y - c.y;
  return dx * dx + dy * dy < radius * radius;
}

/**
 * Apply the no-wreck rules to a raw wreck point.
 * Wreck inside a no-wreck zone are pushed out to its edge, so a near miss
 * still leaves something behind. Returns null if no legal spot exists
 * (e.g. the pushed point lands inside a planet).
 */
export function placeWreck(field: Field, raw: Vec): Vec | null {
  let p = pushOutOf(raw, field.beacon, NO_WRECK_BEACON);
  p = pushOutOf(p, field.launcher, NO_WRECK_LAUNCHER);
  p = {
    x: Math.min(Math.max(p.x, WRECK_EDGE_INSET), WORLD_W - WRECK_EDGE_INSET),
    y: Math.min(Math.max(p.y, WRECK_EDGE_INSET), WORLD_H - WRECK_EDGE_INSET),
  };
  if (inside(p, field.beacon, NO_WRECK_BEACON - 0.5)) return null;
  if (inside(p, field.launcher, NO_WRECK_LAUNCHER - 0.5)) return null;
  for (const pl of field.planets) {
    if (inside(p, pl, pl.r + WRECk_SURFACE_GAP - 0.5)) return null;
  }
  return p;
}

/**
 * Traffic-based fading: call once per launch, before simulating it.
 * Graveyard Sunday passes `frozen = true`.
 */

export function decayDebris(
  debris: readonly Debris[],
  frozen: boolean
): Debris[] {
  if (frozen) return debris.slice();
  const out: Debris[] = [];
  for (const d of debris) {
    const strength = d.strength * DEBRIS_DECAY_PER_LAUNCH;
    if (strength >= DEBRIS_MIN_STRENGTH) out.push({ ...d, strength });
  }
  return out;
}

/** Add a wreck, evicting the weakest pieces if we're over MAX_DEBRIS. */
export function addDebris(debris: readonly Debris[], piece: Debris): Debris[] {
  const out = [...debris, piece];
  if (out.length <= MAX_DEBRIS) return out;
  out.sort((a, b) => b.strength - a.strength);
  return out.slice(0, MAX_DEBRIS);
}

/**
 * Debris ids that meaningfully bent this stage's path, strongest first.
 * Piece owned by `excludeOwner` are skipped (no self-assists).
 */
export function usedDebris(
  stage: StageResult,
  debris: readonly Debris[],
  excludeOwner: string | null
): string[] {
  const owners = new Map<string, string>();
  for (const d of debris) owners.set(d.id, d.owner);
  return Object.entries(stage.debrisDv)
    .filter(
      ([id, dv]) => dv >= DEBRIS_USED_DV && owners.get(id) !== excludeOwner
    )
    .sort((a, b) => b[1] - a[1])
    .map(([id]) => id);
}
