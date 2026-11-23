import assert from 'node:assert/strict';
import { test } from 'node:test';
import { pilotRank, precisionBonus, scoreRun } from './scoring.ts';

test('ace with a slow landing and two slingshots', () => {
  const s = scoreRun({
    landed: true,
    stagesUsed: 1,
    landingSpeed: 0,
    slingshots: 2,
  });
  assert.deepEqual(s, {
    landing: 100,
    precision: 50,
    slingshots: 20,
    stageBonus: 60,
    total: 230,
  });
});

test('two-stage and three-stage bonuses', () => {
  assert.equal(
    scoreRun({ landed: true, stagesUsed: 2, landingSpeed: 500, slingshots: 0 })
      .total,
    130
  );
  assert.equal(
    scoreRun({ landed: true, stagesUsed: 3, landingSpeed: 500, slingshots: 0 })
      .total,
    100
  );
});

test('fail score zero', () => {
  assert.equal(
    scoreRun({
      landed: false,
      stagesUsed: 3,
      landingSpeed: null,
      slingshots: 4,
    }).total,
    0
  );
});

test('precision is clamped', () => {
  assert.equal(precisionBonus(-10), 50);
  assert.equal(precisionBonus(250), 25);
  assert.equal(precisionBonus(9999), 0);
});

test('pilot rank: fewer stages always beats better precision', () => {
  assert.ok(pilotRank(1, 0) > pilotRank(2, 50));
  assert.ok(pilotRank(2, 40) > pilotRank(2, 39));
});
