// The Meridian Vault's floor: every solid thing on it, where the loot sits, where the thief
// enters and where the getaway waits. Walls, pillars and desks block movement and sight; the
// vault door blocks both until it is cracked. The layout leaves three routes across the floor:
// the west gallery (left), the marble hall (centre, through the arch gap) and the east corridor
// (right, past the cameras), so no single patrol can cover the whole crossing.

export const WALL = 'wall';
export const PILLAR = 'pillar';
export const DESK = 'desk';
export const VAULT_DOOR = 'vault-door';

/** The border walls, thickness 24, all round the floor. */
const BORDER = [
  { kind: WALL, x: 0, y: 0, w: 1280, h: 24 },
  { kind: WALL, x: 0, y: 696, w: 1280, h: 24 },
  { kind: WALL, x: 0, y: 0, w: 24, h: 720 },
  { kind: WALL, x: 1256, y: 0, w: 24, h: 720 },
];

/** Interior walls: a stub wall off the west, the hall divider with its arch gap, the east
 *  divider with its low gap, and the vault room's own walls (the door gap is the vault door). */
const INTERIOR = [
  { kind: WALL, x: 420, y: 24, w: 20, h: 176 },
  { kind: WALL, x: 24, y: 380, w: 306, h: 20 },
  { kind: WALL, x: 410, y: 380, w: 290, h: 20 },
  { kind: WALL, x: 700, y: 400, w: 20, h: 120 },
  { kind: WALL, x: 700, y: 600, w: 20, h: 96 },
  { kind: WALL, x: 880, y: 24, w: 20, h: 276 },
  { kind: WALL, x: 900, y: 280, w: 140, h: 20 },
  { kind: WALL, x: 1120, y: 280, w: 136, h: 20 },
];

/** Freestanding marble pillars: safe cover in the open floor. */
const PILLARS = [
  { kind: PILLAR, x: 280, y: 260, w: 36, h: 36 },
  { kind: PILLAR, x: 560, y: 140, w: 36, h: 36 },
  { kind: PILLAR, x: 820, y: 140, w: 36, h: 36 },
  { kind: PILLAR, x: 280, y: 560, w: 36, h: 36 },
  { kind: PILLAR, x: 560, y: 560, w: 36, h: 36 },
  { kind: PILLAR, x: 980, y: 500, w: 36, h: 36 },
];

/** Heavy oak desks: cover you can duck behind, and sight-blockers. */
const DESKS = [
  { kind: DESK, x: 150, y: 300, w: 90, h: 44 },
  { kind: DESK, x: 520, y: 300, w: 90, h: 44 },
  { kind: DESK, x: 820, y: 520, w: 90, h: 44 },
];

/** The vault door: the locked gate in the vault room's south wall. Solid until cracked. */
export const VAULT_DOOR_RECT = { kind: VAULT_DOOR, x: 1040, y: 280, w: 80, h: 20 };

/** Where the thief slips in: the service door in the south wall, bottom left. */
export const ENTRY = { x: 100, y: 640 };
/** Where the getaway van waits: the south door, bottom right. */
export const EXIT = { x: 1180, y: 660, w: 90, h: 36 };
/** The Meridian Ledger, the prize of the night, inside the vault. */
export const LEDGER = { x: 1150, y: 120 };
/** Gold bars scattered across the floor; the two in the vault pay for the risk of going in. */
export const GOLD_BARS = [
  { x: 200, y: 120, taken: false },
  { x: 640, y: 90, taken: false },
  { x: 950, y: 500, taken: false },
  { x: 1000, y: 150, taken: false },
  { x: 1180, y: 220, taken: false },
];

/** Wall cameras: fixed to a wall, sweeping a beam across the floor. */
export const CAMERAS = [
  { x: 640, y: 24, baseAngle: Math.PI / 2, sweep: 0.9, phase: 0 },
  { x: 1256, y: 430, baseAngle: Math.PI, sweep: 0.8, phase: 1.7 },
  { x: 640, y: 696, baseAngle: -Math.PI / 2, sweep: 0.9, phase: 3.1 },
];

/** Guard patrols: each a loop of waypoints across the floor they own. */
export const PATROLS = [
  // Hall guard: sweeps the top hall, past the west gold and the vault approach.
  [{ x: 300, y: 120 }, { x: 800, y: 120 }, { x: 800, y: 240 }, { x: 300, y: 240 }],
  // Gallery guard: walks the lower west gallery, under the hall divider.
  [{ x: 200, y: 480 }, { x: 620, y: 480 }, { x: 620, y: 620 }, { x: 200, y: 620 }],
  // Vault guard: paces the vault approach and the getaway corridor.
  [{ x: 950, y: 420 }, { x: 1150, y: 420 }, { x: 1150, y: 600 }, { x: 950, y: 600 }],
];

/** All solid rectangles, in a fixed order: border, interior, pillars, desks, then the door. */
export function buildSolids() {
  return [...BORDER, ...INTERIOR, ...PILLARS, ...DESKS, { ...VAULT_DOOR_RECT }];
}

/** True when the point sits inside any solid rectangle in `solids`. */
export function pointBlocked(x, y, solids) {
  for (let index = 0; index < solids.length; index += 1) {
    const s = solids[index];
    if (x >= s.x && x <= s.x + s.w && y >= s.y && y <= s.y + s.h) return true;
  }
  return false;
}

/** True when a circle of `radius` at (x, y) touches any solid rectangle. */
export function circleBlocked(x, y, radius, solids) {
  for (let index = 0; index < solids.length; index += 1) {
    const s = solids[index];
    const nearestX = Math.max(s.x, Math.min(x, s.x + s.w));
    const nearestY = Math.max(s.y, Math.min(y, s.y + s.h));
    const dx = x - nearestX;
    const dy = y - nearestY;
    if (dx * dx + dy * dy < radius * radius) return true;
  }
  return false;
}

/**
 * True when the segment from (x1, y1) to (x2, y2) has a clear run: sampled every 6 px, it
 * never crosses a solid rectangle. Guards and cameras see through nothing.
 */
export function lineOfSight(x1, y1, x2, y2, solids) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const distance = Math.hypot(dx, dy);
  const steps = Math.max(1, Math.ceil(distance / 6));
  for (let step = 1; step < steps; step += 1) {
    const t = step / steps;
    if (pointBlocked(x1 + dx * t, y1 + dy * t, solids)) return false;
  }
  return true;
}

/**
 * Cast one sight ray from (x, y) along `angle`: march in 8 px steps until a solid stops it
 * or `range` runs out, and return how far the ray travelled.
 */
export function castRay(x, y, angle, range, solids) {
  const stepX = Math.cos(angle) * 8;
  const stepY = Math.sin(angle) * 8;
  let travelled = 0;
  while (travelled < range) {
    const nextX = x + stepX * (travelled / 8 + 1);
    const nextY = y + stepY * (travelled / 8 + 1);
    if (pointBlocked(nextX, nextY, solids)) break;
    travelled += 8;
  }
  return Math.min(travelled, range);
}

/** The smallest absolute difference between two angles, in radians. */
export function angleDifference(a, b) {
  let diff = a - b;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  return Math.abs(diff);
}
