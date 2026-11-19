import { MAX_LAUNCH_SPEED, MIN_LAUNCH_SPEED } from './constants';
import type { Vec } from './types';

/**
 * Clamp a launch vector's length to [MIN_LAUNCH_SPEED, MAX_LAUNCH_SPEED]
 * Non-finite input becomes a minimum-speed upward launch.
 * The server must call this on every vector it receives.
 */

export function clampLaunch(v: Vec): Vec {
  if (!Number.isFinite(v.x) || !Number.isFinite(v.y)) {
    return { x: 0, y: -MIN_LAUNCH_SPEED };
  }
  const len2 = v.x * v.x + v.y * v.y;
  if (len2 === 0) return { x: 0, y: -MIN_LAUNCH_SPEED };
  const len = Math.sqrt(len2);
  if (len > MAX_LAUNCH_SPEED) {
    const k = MAX_LAUNCH_SPEED / len;
    return { x: v.x * k, y: v.y * k };
  }
  if (len < MIN_LAUNCH_SPEED) {
    const k = MIN_LAUNCH_SPEED / len;
    return { x: v.x * k, y: v.y * k };
  }
  return { x: v.x, y: v.y };
}

/** World units of drag that map to full launch speed. */
export const FULL_POWER_DRAG = 220;

/**
 * Slingshot aiming: pull back from the probe, launch the opposite way.
 * pull is (dragStart - dragCurrent) in world units.
 */

export function launchFromDrag(pull: Vec): Vec {
    const k = MAX_LAUNCH_SPEED / FULL_POWER_DRAG;
    return clampLaunch({ x: pull.x * k, y: pull.y * k})
}

/** 0..1 power for UI. */
export function launchPower(v: Vec): number {
    return Math.sqrt(v.x * v.x + v.y * v.y) / MAX_LAUNCH_SPEED;
}
