// The game's rules and state, with no drawing and no browser in it: the thief, the guards,
// the cameras, the alarm meter, the loot and the vault door. step() advances one fixed step
// and returns what happened as bit flags, so the caller can react without the world knowing
// about screens or sound. Nothing here allocates after createWorld returns.

import { ALARM, GUARD, LOOT, PLAYER, TOOLS } from './config.js';
import {
  CAMERAS,
  ENTRY,
  EXIT as EXIT_RECT,
  GOLD_BARS,
  LEDGER as LEDGER_POS,
  PATROLS,
  VAULT_DOOR_RECT,
  buildSolids,
} from './level.js';
import { createCamera, cameraSees, freezeCameras, stepCamera } from './camera.js';
import { createGuard, guardSees, sendToDecoy, stepGuard } from './guard.js';
import { TOOL_DECOY, TOOL_EMP, TOOL_LOCKPICK, TOOL_SMOKE, createPlayer, setClickTarget, stepPlayer, useTool } from './player.js';

export const EVENT_GOLD = 1;
export const EVENT_LEDGER = 2;
export const EVENT_SEEN = 4;
export const EVENT_LOCKDOWN = 8;
export const EVENT_CAUGHT = 16;
export const EVENT_WIN = 32;
export const EVENT_TOOL = 64;
export const EVENT_DOOR = 128;

const DOOR_OPEN_DISTANCE = 70;

/** True when the segment from a watcher to the thief crosses a smoke cloud. */
function smokeBlocks(x1, y1, x2, y2, smokes) {
  for (let index = 0; index < smokes.length; index += 1) {
    const smoke = smokes[index];
    // Distance from the cloud's centre to the segment: under its radius means blocked.
    const dx = x2 - x1;
    const dy = y2 - y1;
    const lengthSquared = dx * dx + dy * dy;
    let t = lengthSquared === 0 ? 0 : ((smoke.x - x1) * dx + (smoke.y - y1) * dy) / lengthSquared;
    t = Math.max(0, Math.min(1, t));
    const closestX = x1 + dx * t;
    const closestY = y1 + dy * t;
    if (Math.hypot(smoke.x - closestX, smoke.y - closestY) < smoke.r) return true;
  }
  return false;
}

/** True when the thief stands inside any smoke cloud: unseen from every direction. */
function insideSmoke(x, y, smokes) {
  for (let index = 0; index < smokes.length; index += 1) {
    const smoke = smokes[index];
    if (Math.hypot(smoke.x - x, smoke.y - y) < smoke.r) return true;
  }
  return false;
}

export function createWorld(random) {
  const solids = buildSolids();
  const player = createPlayer(ENTRY.x, ENTRY.y);
  const guards = PATROLS.map((waypoints) => createGuard(waypoints, waypoints[0]));
  const cameras = CAMERAS.map((definition) => createCamera(definition));
  const gold = GOLD_BARS.map((bar) => ({ x: bar.x, y: bar.y, taken: false }));
  const smokes = [];
  const state = {
    player,
    guards,
    cameras,
    gold,
    smokes,
    solids,
    alarm: 0,
    lockdownLeft: 0,
    loot: 0,
    hasLedger: false,
    doorOpen: false,
    doorCrack: 0,
    elapsed: 0,
    caught: false,
    won: false,
    seenNow: false,
  };

  function reset() {
    player.x = ENTRY.x;
    player.y = ENTRY.y;
    player.angle = -Math.PI / 2;
    player.targetX = null;
    player.targetY = null;
    player.kit = TOOLS.startKit;
    player.crackProgress = 0;
    for (let index = 0; index < guards.length; index += 1) {
      guards[index] = createGuard(PATROLS[index], PATROLS[index][0]);
    }
    for (let index = 0; index < cameras.length; index += 1) {
      cameras[index] = createCamera(CAMERAS[index]);
    }
    for (const bar of gold) bar.taken = false;
    smokes.length = 0;
    state.alarm = 0;
    state.lockdownLeft = 0;
    state.loot = 0;
    state.hasLedger = false;
    state.doorOpen = false;
    state.doorCrack = 0;
    state.elapsed = 0;
    state.caught = false;
    state.won = false;
    state.seenNow = false;
  }

  /** The vault door's centre, for distance checks and drawing. */
  function doorCentre() {
    return { x: VAULT_DOOR_RECT.x + VAULT_DOOR_RECT.w / 2, y: VAULT_DOOR_RECT.y + VAULT_DOOR_RECT.h / 2 };
  }

  function nearDoor() {
    const centre = doorCentre();
    return Math.hypot(player.x - centre.x, player.y - centre.y) < DOOR_OPEN_DISTANCE;
  }

  /** Solids as they stand right now: an open vault door stops blocking sight and movement. */
  function liveSolids() {
    if (!state.doorOpen) return solids;
    return solids.filter((solid) => solid.kind !== 'vault-door');
  }

  /**
   * One fixed step. `move` is {x, y} from the keys; `tool` is a tool id or -1; `click` is a
   * floor point to walk to, or null. `harmless` (the title screen's backdrop) runs the floor
   * without the thief ever being seen, caught or scored.
   */
  function step(dt, move, tool, click, harmless) {
    let events = 0;
    state.elapsed += dt;

    if (click !== null) setClickTarget(player, click.x, click.y);
    stepPlayer(player, dt, move, liveSolids());

    // Smoke clouds thin out.
    for (let index = smokes.length - 1; index >= 0; index -= 1) {
      smokes[index].ttl -= dt;
      if (smokes[index].ttl <= 0) smokes.splice(index, 1);
    }
    const hidden = insideSmoke(player.x, player.y, smokes);

    // Tools, spent only when they can actually do something.
    if (tool >= 0 && !harmless) {
      const result = useTool(player, tool, !state.doorOpen && nearDoor(), player.angle);
      if (result.ok) {
        events |= EVENT_TOOL;
        if (result.kind === TOOL_LOCKPICK) {
          state.doorOpen = true;
          events |= EVENT_DOOR;
        } else if (result.kind === TOOL_EMP) {
          freezeCameras(cameras, result.seconds);
        } else if (result.kind === TOOL_SMOKE) {
          smokes.push({ x: result.x, y: result.y, r: result.radius, ttl: result.seconds });
        } else if (result.kind === TOOL_DECOY) {
          sendToDecoy(guards, result.x, result.y);
        }
      }
    }

    // Cracking the vault door by hand: stand at it and hold still-ish for three seconds.
    if (!state.doorOpen && nearDoor() && !harmless) {
      state.doorCrack += dt;
      if (state.doorCrack >= PLAYER.crackTime) {
        state.doorOpen = true;
        events |= EVENT_DOOR;
      }
    } else if (!state.doorOpen) {
      state.doorCrack = Math.max(0, state.doorCrack - dt * 2);
    }

    // Loot: gold bars anywhere, the ledger only inside the open vault.
    if (!harmless) {
      for (const bar of gold) {
        if (!bar.taken && Math.hypot(player.x - bar.x, player.y - bar.y) < PLAYER.radius + 16) {
          bar.taken = true;
          state.loot += LOOT.goldValue;
          events |= EVENT_GOLD;
        }
      }
      if (!state.hasLedger && state.doorOpen && Math.hypot(player.x - LEDGER_POS.x, player.y - LEDGER_POS.y) < PLAYER.radius + 18) {
        state.hasLedger = true;
        state.loot += LOOT.ledgerValue;
        events |= EVENT_LEDGER;
      }
    }

    // Cameras sweep; guards patrol, chase or investigate.
    for (const camera of cameras) stepCamera(camera, dt);
    const lockdown = state.lockdownLeft > 0;
    for (const guard of guards) {
      const outcome = stepGuard(guard, dt, { x: player.x, y: player.y, hidden }, liveSolids(), lockdown);
      if (outcome === 'bump' && !harmless) {
        state.alarm = Math.min(100, state.alarm + ALARM.bumpJump);
        guard.state = 'chase';
        guard.chaseLeft = GUARD.chaseMemory;
        events |= EVENT_SEEN;
      } else if (outcome === 'caught' && !harmless) {
        state.caught = true;
        events |= EVENT_CAUGHT;
        return events;
      }
    }

    // Who sees the thief right now? Smoke hides the thief; a cloud between watcher and
    // thief breaks the line even when the thief stands outside it. A glance is only
    // suspicion: a guard chases once it has stared for a moment, or the alarm is already
    // high enough that every guard is sure. Walking straight into a guard is instant.
    let seen = false;
    if (!harmless && !hidden) {
      for (const guard of guards) {
        if (guardSees(guard, player.x, player.y, liveSolids(), false) && !smokeBlocks(guard.x, guard.y, player.x, player.y, smokes)) {
          seen = true;
          state.alarm = Math.min(100, state.alarm + ALARM.guardRate * dt);
          guard.seen = true;
          guard.seenTime = Math.min(2, guard.seenTime + dt);
          if (guard.state === 'patrol' && (guard.seenTime > GUARD.seenToChase || state.alarm >= ALARM.chaseAt)) {
            guard.state = 'chase';
            guard.chaseLeft = GUARD.chaseMemory;
          } else if (guard.state === 'chase') {
            guard.chaseLeft = Math.max(guard.chaseLeft, GUARD.chaseMemory);
          }
        } else {
          guard.seen = false;
          guard.seenTime = Math.max(0, guard.seenTime - dt);
        }
      }
      for (const camera of cameras) {
        if (cameraSees(camera, player.x, player.y, liveSolids(), false) && !smokeBlocks(camera.x, camera.y, player.x, player.y, smokes)) {
          seen = true;
          state.alarm = Math.min(100, state.alarm + ALARM.cameraRate * dt);
        }
      }
    }
    state.seenNow = seen;
    if (seen) events |= EVENT_SEEN;
    if (!seen && state.lockdownLeft <= 0) {
      state.alarm = Math.max(0, state.alarm - ALARM.drainRate * dt);
    }

    // The meter fills: lockdown. Every guard hunts; the thief has ten seconds to break away.
    if (state.alarm >= 100 && state.lockdownLeft <= 0 && !harmless) {
      state.lockdownLeft = ALARM.lockdownSeconds;
      events |= EVENT_LOCKDOWN;
    }
    if (state.lockdownLeft > 0) {
      state.lockdownLeft -= dt;
      state.alarm = 100;
      if (state.lockdownLeft <= 0) {
        state.alarm = ALARM.afterLockdown;
        state.lockdownLeft = 0;
      }
    }

    // The getaway: ledger in hand, reach the south door.
    if (!harmless && state.hasLedger) {
      if (player.x > EXIT_RECT.x && player.x < EXIT_RECT.x + EXIT_RECT.w && player.y > EXIT_RECT.y - 10 && player.y < EXIT_RECT.y + EXIT_RECT.h) {
        state.won = true;
        events |= EVENT_WIN;
      }
    }

    return events;
  }

  reset();
  return { state, reset, step, nearDoor, doorCentre, liveSolids };
}
