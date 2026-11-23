export type Vec = { x: number; y: number };

export type Planet = { x: number; y: number; r: number; mu: number };

export type Archetype = 'gate' | 'slingshot' | 'binary' | 'maze';

export type Field = {
  seed: string;
  archetype: Archetype;
  launcher: Vec;
  beacon: Vec;
  planets: Planet[];
};

export type Debris = {
  id: string;
  x: number;
  y: number;
  owner: string;
  epitaph: string;
  /** 0..1, multiplies DEBRIS_MU_MAX. Fades with traffic. */
  strength: number;
};

/**
 * landed - entered the beacon's capture radius
 * crashed - hit a planet surface
 * lost - left the arena (the next stage restarts from this page's start)
 * timeout - still flying after MAX_STEPS
 */
export type StageOutcome = 'landed' | 'crashed' | 'lost' | 'timeout';

export type StageResult = {
  outcome: StageOutcome;
  /** Flat [x0, y0, x1, y1, ...], one point per physics step, including the start. */
  path: number[];
  steps: number;
  /** Where the stage launches from. */
  next: Vec;
  /** Where this stage debris should go (before no-wreck rule), or null if it landed. */
  wreck: Vec | null;
  landingSpeed: number | null;
  /** Accumulated | delta-v | each debris piece gave the probe, by debris id. Only non-zero entries. */
  debrisDv: Record<string, number>;
};
