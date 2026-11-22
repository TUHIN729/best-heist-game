// The wall cameras: fixed to a wall, sweeping a beam across the floor on a slow, readable
// arc. A camera never moves, so its beam is a rhythm to learn: cross while it looks away.
// An EMP freezes every camera at once, beam dimmed, for a few seconds.

import { CAMERA } from './config.js';
import { angleDifference, lineOfSight } from './level.js';

/** One camera, from the level's CAMERAS table: position, the direction it faces at rest,
 *  how far it sweeps either side, and its phase so the three never move in step. */
export function createCamera(definition) {
  return {
    x: definition.x,
    y: definition.y,
    baseAngle: definition.baseAngle,
    sweep: definition.sweep,
    phase: definition.phase,
    time: 0,
    frozenLeft: 0,
  };
}

/** The angle the sweep would be at right now, ignoring any freeze. */
function liveAngle(camera) {
  return camera.baseAngle + Math.sin((camera.time / CAMERA.sweepPeriod) * Math.PI * 2 + camera.phase) * camera.sweep;
}

/** Where the camera is looking right now: frozen cameras stare where they stopped. */
export function cameraAngle(camera) {
  if (camera.frozenLeft > 0) return camera.frozenAngle ?? liveAngle(camera);
  return liveAngle(camera);
}

export function stepCamera(camera, dt) {
  camera.time += dt;
  if (camera.frozenLeft > 0) {
    if (camera.frozenAngle === undefined) camera.frozenAngle = liveAngle(camera);
    camera.frozenLeft = Math.max(0, camera.frozenLeft - dt);
    if (camera.frozenLeft === 0) delete camera.frozenAngle;
  }
}

/** True when this camera's beam holds the thief: in range, inside the beam, line clear. */
export function cameraSees(camera, playerX, playerY, solids, hidden) {
  if (camera.frozenLeft > 0 || hidden) return false;
  const dx = playerX - camera.x;
  const dy = playerY - camera.y;
  const distance = Math.hypot(dx, dy);
  if (distance > CAMERA.sightRange) return false;
  if (angleDifference(Math.atan2(dy, dx), cameraAngle(camera)) > CAMERA.sightHalfAngle) return false;
  return lineOfSight(camera.x, camera.y, playerX, playerY, solids);
}

/** Freeze every camera for `seconds` (the EMP tool). */
export function freezeCameras(cameras, seconds) {
  for (const camera of cameras) {
    if (camera.frozenLeft <= 0) camera.frozenAngle = cameraAngle(camera);
    camera.frozenLeft = seconds;
  }
}
