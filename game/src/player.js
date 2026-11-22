// The thief, Wren: one quiet professional crossing the vault floor. Keyboard steers, a
// mouse click sets a destination to walk to, and the four tools each spend one kit charge:
// a lockpick cracks the vault door at once, an EMP freezes the cameras, smoke breaks every
// line of sight, and a decoy pulls the nearest guard off its patrol.

import { PLAYER, TOOLS } from './config.js';
import { circleBlocked } from './level.js';

export const TOOL_LOCKPICK = 0;
export const TOOL_EMP = 1;
export const TOOL_SMOKE = 2;
export const TOOL_DECOY = 3;

/** The thief's state: position, facing, where a click told it to walk, and its kit. */
export function createPlayer(x, y) {
  return {
    x,
    y,
    angle: -Math.PI / 2,
    targetX: null,
    targetY: null,
    kit: TOOLS.startKit,
    crackProgress: 0,
    moving: false,
  };
}

function tryMove(player, nextX, nextY, solids) {
  // Axis by axis: slide along a wall instead of sticking to it.
  if (!circleBlocked(nextX, player.y, PLAYER.radius, solids)) player.x = nextX;
  if (!circleBlocked(player.x, nextY, PLAYER.radius, solids)) player.y = nextY;
}

/**
 * Move the thief one fixed step. `move` is {x, y} from the keys (-1..1 each way); a click
 * target overrides it until reached or a key is pressed. Returns the distance travelled.
 */
export function stepPlayer(player, dt, move, solids) {
  let dx = move.x;
  let dy = move.y;
  if ((dx !== 0 || dy !== 0) && player.targetX !== null) {
    player.targetX = null;
    player.targetY = null;
  }
  if (dx === 0 && dy === 0 && player.targetX !== null) {
    dx = player.targetX - player.x;
    dy = player.targetY - player.y;
    const distance = Math.hypot(dx, dy);
    if (distance < 6) {
      player.targetX = null;
      player.targetY = null;
      dx = 0;
      dy = 0;
    } else {
      dx /= distance;
      dy /= distance;
    }
  }
  const length = Math.hypot(dx, dy);
  if (length === 0) {
    player.moving = false;
    return 0;
  }
  const step = PLAYER.speed * dt;
  const nextX = player.x + (dx / length) * step;
  const nextY = player.y + (dy / length) * step;
  tryMove(player, nextX, nextY, solids);
  player.angle = Math.atan2(dy, dx);
  player.moving = true;
  return step;
}

/** Point the thief at a clicked spot on the floor. */
export function setClickTarget(player, x, y) {
  player.targetX = x;
  player.targetY = y;
}

/**
 * Use a tool. Returns an object describing what happened, so the world can apply it:
 * { ok, kind, ... } — ok is false when the tool cannot be used here (no charge spent).
 * `nearDoor` says the thief stands at the vault door; `facing` is where the decoy flies.
 */
export function useTool(player, tool, nearDoor, facing) {
  if (player.kit <= 0) return { ok: false, kind: tool, reason: 'no kit' };
  if (tool === TOOL_LOCKPICK) {
    if (!nearDoor) return { ok: false, kind: tool, reason: 'not at the vault door' };
    player.kit -= 1;
    return { ok: true, kind: tool };
  }
  if (tool === TOOL_EMP) {
    player.kit -= 1;
    return { ok: true, kind: tool, seconds: TOOLS.empSeconds };
  }
  if (tool === TOOL_SMOKE) {
    player.kit -= 1;
    return { ok: true, kind: tool, x: player.x, y: player.y, radius: TOOLS.smokeRadius, seconds: TOOLS.smokeSeconds };
  }
  if (tool === TOOL_DECOY) {
    player.kit -= 1;
    return {
      ok: true,
      kind: tool,
      x: player.x + Math.cos(facing) * TOOLS.decoyRange,
      y: player.y + Math.sin(facing) * TOOLS.decoyRange,
    };
  }
  return { ok: false, kind: tool, reason: 'unknown tool' };
}
