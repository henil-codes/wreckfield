import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  DEBRIS_MIN_STRENGTH,
  MAX_LAUNCH_SPEED,
  MIN_LAUNCH_SPEED,
  NO_WRECK_BEACON,
  NO_WRECK_LAUNCHER,
} from './constants.ts';
import { clampLaunch, launchFromDrag } from './launch.ts';
import { simulateStage } from './simulate.ts';
import { decayDebris, placeWreck, usedDebris } from './debris.ts';
import { generateField, ARCHETYPES, planetFits } from './field.ts';
import type { Debris, Field } from './types.ts';

const empty: Field = {
  seed: 'test',
  archetype: 'maze',
  launcher: { x: 500, y: 1290 },
  beacon: { x: 500, y: 200 },
  planets: [],
};

const len = (v: { x: number; y: number }) => Math.hypot(v.x, v.y);

test('clampLaunch caps seed and handles garbage', () => {
  assert.ok(
    Math.abs(len(clampLaunch({ x: 999, y: 9999 })) - MAX_LAUNCH_SPEED) < 1e-9
  );
  assert.ok(
    Math.abs(len(clampLaunch({ x: 1, y: 0 })) - MIN_LAUNCH_SPEED) < 1e-9
  );
  assert.deepEqual(clampLaunch({ x: NaN, y: 1 }), {
    x: 0,
    y: -MIN_LAUNCH_SPEED,
  });
  assert.deepEqual(clampLaunch({ x: 0, y: 0 }), { x: 0, y: -MIN_LAUNCH_SPEED });
});
