// All tuning lives here. World units are arbitrary "pixels" of a fixed
// 1000 x 1400 portrait arena; the renderer scales them to the screen.

export const WORLD_W = 1000;
export const WORLD_H = 1400;

/** Fixed time step: 120 Hz. */
export const DT = 1 / 120;

/** 6 seconds of flight per stage. */
export const MAX_STEPS = 720;
export const STAGES_PER_DAY = 3;

export const MAX_LAUNCH_SPEED = 520;
export const MIN_LAUNCH_SPEED = 40;

/** How far past the arena edge a probe may go before it counts as lost. */
export const ARENA_MARGIN = 40;

/** Planet surface gravity is constant: mu = PLANET_MU_PER_R2 * r^2. */
export const PLANET_MU_PER_R2 = 1600;
export const PLANET_SOFTENING = 8;

export const BEACON_MU = 1.2e6;
export const BEACON_SOFTENING = 20;
export const BEACON_CAPTURE_RADIUS = 34;

/** Debris gravity at full strenght. A mid sized planet (r=70) is ~7.8e6 */
export const DEBRIS_MU_MAX = 9e5;
export const DEBRIS_SOFTENING = 28;

/** Accumulated |delta-v| (units/s) a debris piece must give a probe a count as "used". */
export const DEBRIS_USED_DV = 60;

/** Radius used only for the visual pulse. Scoring uses delta-v. */
export const DEBRIS_PULSE_RADIUS = 140;
export const MAX_DEBRIS = 150;

/** Strength multiplier applied to every existing debris each new launch. */
export const DEBRIS_DECAY_PER_LAUNCH = 0.975;
export const DEBRIS_MIN_STRENGTH = 0.2;

export const NO_WRECK_BEACON = 120;
export const NO_WRECK_LAUNCHER = 110;

/** Wrecks are kept this far from an arena edge and from planet surfaces. */
export const WRECK_EDGE_INSET = 24;
export const WRECH_SURFACE_GAP = 6;

export const GHOST_FRACTION_FIRST = 0.3;
export const GHOST_FRACTION = 0.15;
