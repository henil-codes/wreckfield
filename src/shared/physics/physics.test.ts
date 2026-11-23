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

test('drag aim opposite the pull', () => {
  const v = launchFromDrag({ x: 0, y: -100 });
  assert.ok(v.y < 0 && v.x === 0);
});

test('straight shot up an empty field lands on the beacon', () => {
  const r = simulateStage(empty, [], empty.launcher, { x: 0, y: -400 });
  assert.equal(r.outcome, 'landed');
  assert.equal(r.wreck, null);
  assert.ok(r.landingSpeed !== null && r.landingSpeed > 0);
});

test('simulation is deterministic', () => {
  const f = generateField('det', 'binary');
  const a = simulateStage(f, [], f.launcher, { x: 123.4, y: -321.9 });
  const b = simulateStage(f, [], f.launcher, { x: 123.4, y: -321.9 });
  assert.deepEqual(a, b);
});

test('sideways shot leaves the arena and restarts from its start', () => {
  const r = simulateStage(empty, [], empty.launcher, { x: 520, y: 0 });
  assert.equal(r.outcome, 'lost');
  assert.deepEqual(r.next, empty.launcher);
  assert.ok(r.wreck !== null);
});

test('hitting a planet stops on its surface', () => {
  const f: Field = {
    ...empty,
    planets: [{ x: 500, y: 800, r: 60, mu: 1600 * 3600 }],
  };
  const r = simulateStage(f, [], f.launcher, { x: 0, y: -300 });
  assert.equal(r.outcome, 'crashed');
  assert.ok(r.wreck !== null);
  const d = Math.hypot(r.next.x - 500, r.next.y - 800);
  assert.ok(d > 60 && d < 70);
});

test('ghost guide is a prefix of the full path', () => {
  const f = generateField('ghost', 'slingshot');
  const full = simulateStage(f, [], f.launcher, { x: 200, y: -350 });
  const ghost = simulateStage(f, [], f.launcher, { x: 200, y: -350 }, 100);
  assert.deepEqual(ghost.path, full.path.slice(0, ghost.path.length));
});

test('debris bends the path and is reported as used', () => {
  const debris: Debris[] = [
    {
      id: 'd1',
      x: 560,
      y: 700,
      owner: 'alice',
      epitaph: 'worth it',
      strength: 1,
    },
  ];
  const base = simulateStage(empty, [], empty.launcher, { x: 0, y: -400 });
  const bent = simulateStage(empty, debris, empty.launcher, { x: 0, y: -400 });
  assert.notDeepEqual(base.path, bent.path);
  assert.deepEqual(usedDebris(bent, debris, 'bob'), ['d1']);
  assert.deepEqual(usedDebris(bent, debris, 'alice'), [], 'no self-assists');
});

test('wrecks are pushed out of no-wreck zones', () => {
  const nearBeacon = placeWreck(empty, { x: 510, y: 210 });
  assert.ok(nearBeacon);
  assert.ok(
    Math.hypot(nearBeacon.x - 500, nearBeacon.y - 200) >= NO_WRECK_BEACON - 1e-6
  );
  const nearLaunch = placeWreck(empty, { x: 500, y: 1280 });
  assert.ok(nearLaunch);
  assert.ok(
    Math.hypot(nearLaunch.x - 500, nearLaunch.y - 1290) >=
      NO_WRECK_LAUNCHER - 1e-6
  );
});

test('debris fades by traffic, not on Graveyard Sunday', () => {
  const d: Debris[] = [
    { id: 'a', x: 0, y: 0, owner: 'o', epitaph: 'e', strength: 1 },
  ];
  assert.ok((decayDebris(d, false)[0]?.strength ?? 1) < 1);
  assert.equal(decayDebris(d, true)[0]?.strength, 1);
  let cur = d;
  for (let i = 0; i < 500; i++) cur = decayDebris(cur, false);
  assert.equal(cur.length, 0);
  assert.ok(DEBRIS_MIN_STRENGTH > 0);
});

test('every archetype generates a legal, deterministic field', () => {
  for (const arch of ARCHETYPES) {
    for (let i = 0; i < 25; i++) {
      const f = generateField(`seed-${arch}-${i}`, arch);
      assert.deepEqual(f, generateField(`seed-${arch}-${i}`, arch));
      assert.ok(
        f.planets.length >= 3 && f.planets.length <= 6,
        `${arch} has ${f.planets.length}`
      );
      for (const p of f.planets) {
        const others = f.planets.filter((o) => o !== p);
        // Gate pairs are intentionally close; only check zones for those.
        assert.ok(
          planetFits(p, arch === 'gate' ? [] : others, f.launcher, f.beacon)
        );
      }
    }
  }
});
