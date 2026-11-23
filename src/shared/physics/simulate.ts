import {
  ARENA_MARGIN,
  BEACON_CAPTURE_RADIUS,
  BEACON_MU,
  BEACON_SOFTENING,
  DEBRIS_MU_MAX,
  DEBRIS_SOFTENING,
  DT,
  MAX_STEPS,
  PLANET_SOFTENING,
  WORLD_H,
  WORLD_W,
  WRECK_EDGE_INSET,
  WRECk_SURFACE_GAP,
} from './constants.ts';
import { clampLaunch } from './launch.ts';
import type { Debris, Field, StageResult, Vec } from './types.ts';

export function debrisMu(d: Debris): number {
  const s = d.strength < 0 ? 0 : d.strength > 1 ? 1 : d.strength;
  return DEBRIS_MU_MAX * s;
}

/**
 * Simulate one stage. Pure deterministic: only + - * / and Math.sqrt
 * This means client and server produce bit-identical paths for the same inputs.
 *
 * Integrator: semi-implicit (symplectic) Euler at a fixed DT.
 */
export function simulateStage(
  field: Field,
  debris: readonly Debris[],
  start: Vec,
  launch: Vec,
  maxSteps: number = MAX_STEPS
): StageResult {
  const v0 = clampLaunch(launch);
  let x = start.x;
  let y = start.y;
  let vx = v0.x;
  let vy = v0.y;

  const path: number[] = [x, y];
  const planets = field.planets;
  const bx = field.beacon.x;
  const by = field.beacon.y;

  const n = debris.length;
  const dX = new Float64Array(n);
  const dY = new Float64Array(n);
  const dMu = new Float64Array(n);
  const dDv = new Float64Array(n);

  for (let i = 0; i < n; i++) {
    const d = debris[i];
    if (!d) continue;
    dX[i] = d.x;
    dY[i] = d.y;
    dMu[i] = debrisMu(d);
  }

  const epsP = PLANET_SOFTENING * PLANET_SOFTENING;
  const epsB = BEACON_SOFTENING * BEACON_SOFTENING;
  const epsD = DEBRIS_SOFTENING * DEBRIS_SOFTENING;
  const capR2 = BEACON_CAPTURE_RADIUS * BEACON_CAPTURE_RADIUS;
  const minX = -ARENA_MARGIN;
  const maxX = WORLD_H + ARENA_MARGIN;
  const minY = -ARENA_MARGIN;
  const maxY = WORLD_H + ARENA_MARGIN;

  const finish = (
    outcome: StageResult['outcome'],
    steps: number,
    next: Vec,
    wreck: Vec | null,
    landingSpeed: number | null
  ): StageResult => {
    const debrisDv: Record<string, number> = {};
    for (let i = 0; i < n; i++) {
      const d = debris[i];
      const dv = dDv[i] ?? 0;
      if (d && dv > 0) debrisDv[d.id] = dv;
    }
    return { outcome, path, steps, next, wreck, landingSpeed, debrisDv };
  };

  // Last in arena-point, used to place debris for a lost stage.
  let lastInX = x;
  let lastInY = y;

  for (let step = 1; step <= maxSteps; step++) {
    let ax = 0;
    let ay = 0;

    for (const p of planets) {
      const dx = p.x - x;
      const dy = p.y - y;
      const r2 = dx * dx + dy * dy + epsP;
      const k = p.mu / (r2 * Math.sqrt(r2));
      ax += dx * k;
      ay += dy * k;
    }

    {
      const dx = bx - x;
      const dy = by - y;
      const r2 = dx * dx + dy * dy + epsB;
      const k = BEACON_MU / (r2 * Math.sqrt(r2));
      ax += dx * k;
      ay += dy * k;
    }

    for (let i = 0; i < n; i++) {
      const mu = dMu[i] ?? 0;
      if (mu === 0) continue;
      const dx = (dX[i] ?? 0) - x;
      const dy = (dY[i] ?? 0) - y;
      const d2 = dx * dx + dy * dy;
      const r2 = d2 + epsD;
      const k = mu / (r2 * Math.sqrt(r2));
      ax += dx * k;
      ay += dy * k;
      // |a| * dt = k * |d| * dt
      dDv[i] = (dDv[i] ?? 0) + k * Math.sqrt(d2) * DT;
    }

    vx += ax * DT;
    vy += ay * DT;
    x += vx * DT;
    y += vy * DT;
    path.push(x, y);

    // Beacon capture
    {
      const dx = x - bx;
      const dy = y - by;
      if (dx * dx + dy * dy <= capR2) {
        return finish(
          'landed',
          step,
          { x: bx, y: by },
          null,
          Math.sqrt(vx * vx + vy * vy)
        );
      }
    }

    // Planet collision: stop on the surface.
    for (const p of planets) {
      const dx = x - p.x;
      const dy = y - p.y;
      const d2 = dx * dx + dy * dy;
      if (d2 < p.r * p.r) {
        const d = Math.sqrt(d2);
        const ux = d > 1e-9 ? dx / d : 0;
        const uy = d > 1e-9 ? dy / d : -1;
        const surf = {
          x: p.x + ux * (p.r + WRECk_SURFACE_GAP),
          y: p.y + uy * (p.r + WRECk_SURFACE_GAP),
        };
        return finish('crashed', step, surf, { x: surf.x, y: surf.y }, null);
      }
    }

    if (x < minX || x > maxX || y < minY || y > maxY) {
      const wreck = {
        x: clamp(lastInX, WRECK_EDGE_INSET, WORLD_W - WRECK_EDGE_INSET),
        y: clamp(lastInY, WRECK_EDGE_INSET, WORLD_H - WRECK_EDGE_INSET),
      };
      return finish('lost', step, { x: start.x, y: start.y }, wreck, null);
    }
    if (x >= 0 && x <= WORLD_W && y >= 0 && y <= WORLD_H) {
      lastInX = x;
      lastInY = y;
    }
  }
  return finish('timeout', maxSteps, { x, y }, { x, y }, null);
}

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

/** Closest approch of a path to a point (for bots and analytics). */
export function minDistanceTo(path: readonly number[], p: Vec): number {
  let best = Infinity;
  for (let i = 0; i + 1 < path.length; i += 2) {
    const dx = (path[i] ?? 0) - p.x;
    const dy = (path[i + 1] ?? 0) - p.y;
    const d2 = dx * dx + dy * dy;
    if (d2 < best) best = d2;
  }
  return Math.sqrt(best);
}
