// The guards: each walks a patrol loop, pauses at every waypoint to sweep its cone, and
// hunts the thief the moment it is sure it saw one. A guard that loses the thief for a while
// gives up and walks back to its patrol. Guards never know where the thief is unless they see
// it, hear a decoy, or the alarm puts the whole floor on lockdown.

import { ALARM, GUARD } from './config.js';
import { angleDifference, circleBlocked, lineOfSight } from './level.js';

export const GUARD_PATROL = 'patrol';
export const GUARD_CHASE = 'chase';
export const GUARD_INVESTIGATE = 'investigate';

/**
 * One guard on its patrol. `waypoints` is the loop it walks; `start` is where it begins.
 * The guard's cone is drawn from its position and facing, so the renderer needs nothing else.
 */
export function createGuard(waypoints, start) {
  return {
    waypoints,
    waypointIndex: 0,
    x: start.x,
    y: start.y,
    angle: 0,
    state: GUARD_PATROL,
    pauseLeft: 0,
    sweepTime: 0,
    chaseLeft: 0,
    investigateX: 0,
    investigateY: 0,
    investigateLeft: 0,
    seen: false,
    /** Seconds of unbroken look at the thief: a glance is suspicion, a stare is a chase. */
    seenTime: 0,
  };
}

/** True when this guard can see the thief right now: in range, inside the cone, line clear. */
export function guardSees(guard, playerX, playerY, solids, hidden) {
  if (hidden) return false;
  const dx = playerX - guard.x;
  const dy = playerY - guard.y;
  const distance = Math.hypot(dx, dy);
  if (distance > GUARD.sightRange) return false;
  if (distance < GUARD.bumpRange) return true;
  if (angleDifference(Math.atan2(dy, dx), guard.angle) > GUARD.sightHalfAngle) return false;
  return lineOfSight(guard.x, guard.y, playerX, playerY, solids);
}

function turnToward(guard, targetAngle, dt) {
  let diff = targetAngle - guard.angle;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  const step = 3.2 * dt;
  guard.angle += Math.max(-step, Math.min(step, diff));
}

function moveToward(guard, targetX, targetY, speed, dt, solids) {
  const dx = targetX - guard.x;
  const dy = targetY - guard.y;
  const distance = Math.hypot(dx, dy);
  if (distance < 1) return true;
  const step = Math.min(distance, speed * dt);
  const nextX = guard.x + (dx / distance) * step;
  const nextY = guard.y + (dy / distance) * step;
  // Axis by axis, so a desk or pillar stops one direction without trapping the guard.
  if (!circleBlocked(nextX, guard.y, GUARD.radius, solids)) guard.x = nextX;
  if (!circleBlocked(guard.x, nextY, GUARD.radius, solids)) guard.y = nextY;
  return distance <= step + 0.5;
}

/**
 * Advance one guard one fixed step. Returns 'bump' when it walks into the thief while
 * patrolling (an instant spot), 'caught' when a chasing guard lays hands on the thief.
 * `player` carries x, y and the smoke-hidden flag; `solids` is the floor's solids.
 */
export function stepGuard(guard, dt, player, solids, lockdown) {
  guard.sweepTime += dt;
  const dx = player.x - guard.x;
  const dy = player.y - guard.y;
  const distance = Math.hypot(dx, dy);

  if (lockdown && guard.state !== GUARD_CHASE) {
    guard.state = GUARD_CHASE;
    guard.chaseLeft = ALARM.lockdownSeconds;
  }

  if (guard.state === GUARD_CHASE) {
    guard.chaseLeft -= dt;
    turnToward(guard, Math.atan2(dy, dx), dt);
    moveToward(guard, player.x, player.y, GUARD.chaseSpeed, dt, solids);
    if (distance < GUARD.catchRange) return 'caught';
    if (guard.chaseLeft <= 0 && !guardSees(guard, player.x, player.y, solids, player.hidden)) {
      guard.state = GUARD_PATROL;
      guard.pauseLeft = GUARD.waypointPause;
    }
    return null;
  }

  if (guard.state === GUARD_INVESTIGATE) {
    const arrived = moveToward(guard, guard.investigateX, guard.investigateY, GUARD.investigateSpeed, dt, solids);
    if (arrived) {
      guard.investigateLeft -= dt;
      // Look around while checking the noise out.
      guard.angle += Math.sin(guard.sweepTime * 3) * 1.6 * dt;
      if (guard.investigateLeft <= 0) {
        guard.state = GUARD_PATROL;
        guard.pauseLeft = GUARD.waypointPause;
      }
    } else {
      turnToward(guard, Math.atan2(guard.investigateY - guard.y, guard.investigateX - guard.x), dt);
    }
    return null;
  }

  // Patrol: walk to the next waypoint, pause there and sweep the cone across the floor.
  const target = guard.waypoints[guard.waypointIndex];
  if (guard.pauseLeft > 0) {
    guard.pauseLeft -= dt;
    const next = guard.waypoints[(guard.waypointIndex + 1) % guard.waypoints.length];
    const sweepBase = Math.atan2(next.y - guard.y, next.x - guard.x);
    guard.angle = sweepBase + Math.sin(guard.sweepTime * 1.4) * 0.85;
    return null;
  }
  const arrived = moveToward(guard, target.x, target.y, GUARD.patrolSpeed, dt, solids);
  turnToward(guard, Math.atan2(target.y - guard.y, target.x - guard.x), dt);
  if (arrived) {
    guard.waypointIndex = (guard.waypointIndex + 1) % guard.waypoints.length;
    guard.pauseLeft = GUARD.waypointPause;
  }
  if (distance < GUARD.bumpRange) return 'bump';
  return null;
}

/** Point the nearest patrolling guard at a decoy's noise. */
export function sendToDecoy(guards, x, y) {
  let nearest = null;
  let nearestDistance = Infinity;
  for (const guard of guards) {
    if (guard.state !== GUARD_PATROL) continue;
    const distance = Math.hypot(guard.x - x, guard.y - y);
    if (distance < nearestDistance) {
      nearestDistance = distance;
      nearest = guard;
    }
  }
  if (nearest === null) return false;
  nearest.state = GUARD_INVESTIGATE;
  nearest.investigateX = x;
  nearest.investigateY = y;
  nearest.investigateLeft = 2.0;
  return true;
}
