// The screenshot scenes behind ?shot=start|play|alert|win. Each one plays the real rules
// forward from a fresh world for a fixed time, steered by a simple autopilot that follows a
// list of waypoints (pausing where the list says so, to crack the vault door) and runs from a
// chasing guard when one gets close, so the frame is what a short game really looks like and
// the same seed always gives the same frame. No randomness is used: the scenes are exact.

import { STEP } from './config.js';
import { guardSees } from './guard.js';
import { cameraSees } from './camera.js';
import { TOOL_LOCKPICK } from './player.js';
import { SCREEN_OVER, SCREEN_PLAY, SCREEN_TITLE, SCREEN_WIN } from './render.js';

/** Seconds each scene runs, at most: the play and win scenes end at their last waypoint. */
const START_SECONDS = 5;
const PLAY_LIMIT_SECONDS = 30;
const ALERT_SECONDS = 5;
const WIN_LIMIT_SECONDS = 60;
/** Seconds the thief stands at the entry while the guards' opening sweep finishes. */
const SETTLE_SECONDS = 1.2;

/** How close to a waypoint counts as arriving. */
const ARRIVE = 14;
/** A chasing guard closer than this bends the autopilot away from it. */
const EVADE_RANGE = 200;
/** The longest the thief waits for a cone to clear before crossing anyway. */
const MAX_CLEAR_WAIT = 4;

/** True when a guard or a camera would see someone standing at (x, y) right now. */
function pointSeen(x, y, state) {
  for (const guard of state.guards) {
    if (guard.state === 'chase') continue;
    if (guardSees(guard, x, y, state.solids, false)) return true;
  }
  for (const camera of state.cameras) {
    if (cameraSees(camera, x, y, state.solids, false)) return true;
  }
  return false;
}

/** True when the straight walk from (fromX, fromY) to (toX, toY) crosses a cone or a beam. */
function pathBlocked(fromX, fromY, toX, toY, state) {
  const dx = toX - fromX;
  const dy = toY - fromY;
  const distance = Math.hypot(dx, dy);
  const steps = Math.max(1, Math.ceil(distance / 25));
  for (let step = 1; step <= steps; step += 1) {
    const t = step / steps;
    if (pointSeen(fromX + dx * t, fromY + dy * t, state)) return true;
  }
  return false;
}

/** The play scene's route: up the west gallery, through the arch gap in the hall divider,
 *  across the marble hall, to the vault door. Every leg stays in open floor. */
const PLAY_ROUTE = [
  { x: 300, y: 640 },
  { x: 370, y: 430 },
  { x: 370, y: 320 },
  { x: 450, y: 200 },
  { x: 700, y: 200 },
  { x: 700, y: 150 },
  { x: 850, y: 200 },
  { x: 850, y: 320 },
  { x: 950, y: 340 },
];

/** The alert scene's loop: a wide rectangle under the hall divider, crossing the gallery
 *  guard's patrol on long straight legs, so the alarm climbs and the guards hunt without
 *  ever cutting a corner close enough to catch the thief. */
const ALERT_LOOP = [
  { x: 350, y: 450 },
  { x: 650, y: 450 },
  { x: 650, y: 600 },
  { x: 350, y: 600 },
];

/** The win scene's route: the whole heist — in through the arch gap, crack the door, take
 *  the ledger, out through the getaway door. */
const WIN_ROUTE = [
  { x: 300, y: 640 },
  { x: 370, y: 430 },
  { x: 370, y: 320 },
  { x: 450, y: 200 },
  { x: 700, y: 200 },
  { x: 850, y: 320 },
  { x: 1080, y: 345 },
  { x: 1080, y: 200 },
  { x: 1150, y: 130 },
  { x: 1080, y: 345 },
  { x: 1150, y: 500 },
  { x: 1210, y: 665 },
];

/**
 * A pilot that follows `waypoints` in order, waits where a waypoint says so, and runs from
 * a chasing guard that gets close — away from the guard, but still along the route, so it
 * never pins itself against a wall. If the thief stops moving while a move is commanded
 * (wedged on a desk corner), it sidesteps around the block for a moment. A cautious pilot
 * waits out a cone crossing its path; a reckless one walks straight through it.
 */
function makePilot(waypoints, loop, cautious) {
  let index = 0;
  let waitLeft = 0;
  let prevX = null;
  let prevY = null;
  let stillSteps = 0;
  let unstickLeft = 0;
  let unstickX = 0;
  let unstickY = 0;
  let clearWait = 0;
  const pilot = {
    done: false,
    steer(state, dt) {
      if (unstickLeft > 0) {
        unstickLeft -= dt;
        return { x: unstickX, y: unstickY };
      }
      if (prevX !== null) {
        const moved = Math.hypot(state.player.x - prevX, state.player.y - prevY);
        stillSteps = moved < 0.5 ? stillSteps + 1 : 0;
      }
      prevX = state.player.x;
      prevY = state.player.y;
      if (index >= waypoints.length) {
        if (loop) {
          index = 0;
        } else {
          pilot.done = true;
          return { x: 0, y: 0 };
        }
      }
      const waypoint = waypoints[index];
      const toX = waypoint.x - state.player.x;
      const toY = waypoint.y - state.player.y;
      const toLength = Math.hypot(toX, toY) || 1;
      const toWaypoint = { x: toX / toLength, y: toY / toLength };
      // A chasing guard close by: flee — straight away from it, with a sideways slide
      // toward the route, so a wall the thief is pressed against never pins it in place.
      let nearest = null;
      let nearestDistance = EVADE_RANGE;
      for (const guard of state.guards) {
        if (guard.state !== 'chase') continue;
        const distance = Math.hypot(guard.x - state.player.x, guard.y - state.player.y);
        if (distance < nearestDistance) {
          nearestDistance = distance;
          nearest = guard;
        }
      }
      let moveX = toWaypoint.x;
      let moveY = toWaypoint.y;
      if (nearest !== null) {
        const awayX = (state.player.x - nearest.x) / nearestDistance;
        const awayY = (state.player.y - nearest.y) / nearestDistance;
        let tangentX = -awayY;
        let tangentY = awayX;
        if (tangentX * toX + tangentY * toY < 0) {
          tangentX = -tangentX;
          tangentY = -tangentY;
        }
        moveX = awayX + tangentX * 0.7 + toWaypoint.x * 0.3;
        moveY = awayY + tangentY * 0.7 + toWaypoint.y * 0.3;
        clearWait = 0;
      } else if (cautious) {
        // Nobody hunting: wait out a cone crossing the path — unless the thief is
        // standing in a cone itself, or a guard is close enough to bump into, or the
        // wait has already gone on too long. Cones sweep on, so the path clears.
        const hereSeen = pointSeen(state.player.x, state.player.y, state);
        const closeGuard = state.guards.some(
          (guard) => guard.state === 'patrol' && Math.hypot(guard.x - state.player.x, guard.y - state.player.y) < 70,
        );
        if (!hereSeen && !closeGuard && pathBlocked(state.player.x, state.player.y, waypoint.x, waypoint.y, state)) {
          clearWait += dt;
          if (clearWait < MAX_CLEAR_WAIT) return { x: 0, y: 0 };
        } else {
          clearWait = 0;
        }
      }
      const moveLength = Math.hypot(moveX, moveY);
      if (moveLength < 0.05) return { x: 0, y: 0 };
      const distance = Math.hypot(toX, toY);
      if (distance < ARRIVE) {
        if (waitLeft <= 0) waitLeft = waypoint.wait ?? 0;
        if (waitLeft > 0) {
          waitLeft -= dt;
          return { x: 0, y: 0 };
        }
        index += 1;
        return { x: 0, y: 0 };
      }
      const move = { x: moveX / moveLength, y: moveY / moveLength };
      if (stillSteps > 15) {
        // Wedged: step sideways, toward the side the route lies on, for half a second.
        const side = toWaypoint.x * move.y - toWaypoint.y * move.x >= 0 ? 1 : -1;
        unstickX = -move.y * side;
        unstickY = move.x * side;
        unstickLeft = 0.5;
        stillSteps = 0;
        return { x: unstickX, y: unstickY };
      }
      return move;
    },
  };
  return pilot;
}

function runRoute(world, waypoints, limitSeconds, loop, cautious = true) {
  // Let the opening sweep finish before the thief moves: the gallery guard sweeps the
  // service corridor as the scene opens, and the entry itself is out of every cone.
  for (let index = 0; index < SETTLE_SECONDS / STEP; index += 1) {
    world.step(STEP, { x: 0, y: 0 }, -1, null, false);
    if (world.state.caught) return;
  }
  const pilot = makePilot(waypoints, loop, cautious);
  for (let index = 0; index < limitSeconds / STEP; index += 1) {
    const move = pilot.steer(world.state, STEP);
    // Standing at a locked vault door for three seconds is a sitting duck: the thief
    // spends one kit charge on the lockpick instead, and never stops moving.
    const tool = world.nearDoor() && !world.state.doorOpen ? TOOL_LOCKPICK : -1;
    world.step(STEP, move, tool, null, false);
    if (world.state.won || world.state.caught || pilot.done) break;
  }
}

/**
 * Set `world` to the named scene (start, play, alert or win; any other name is start) and
 * return the screen to draw over it and the best score to show.
 */
export function stageShot(name, world) {
  world.reset();
  if (name === 'play') {
    runRoute(world, PLAY_ROUTE, PLAY_LIMIT_SECONDS, false);
    return { screen: SCREEN_PLAY, best: world.state.loot };
  }
  if (name === 'alert') {
    // The reckless run: straight through the gallery guard's patrol, so the alarm
    // climbs and the guards hunt — the grace window and the flee keep the thief alive.
    runRoute(world, ALERT_LOOP, ALERT_SECONDS, true, false);
    return { screen: world.state.caught ? SCREEN_OVER : SCREEN_PLAY, best: world.state.loot };
  }
  if (name === 'win') {
    runRoute(world, WIN_ROUTE, WIN_LIMIT_SECONDS, false);
    return { screen: world.state.won ? SCREEN_WIN : SCREEN_PLAY, best: world.state.loot };
  }
  for (let index = 0; index < START_SECONDS / STEP; index += 1) {
    world.step(STEP, { x: 0, y: 0 }, -1, null, true);
  }
  return { screen: SCREEN_TITLE, best: 0 };
}
