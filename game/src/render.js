// Drawing only: the world's state and the current screen in, pixels out. The 1280x720
// playfield is scaled to fit the window and centred, the margin filled with the backdrop
// colour. Vision cones and camera beams are raycast against the floor's solids, so what you
// see is exactly what the guards see. Flat shapes, canvas text for the HUD and the panels.

import { CAMERA, FIELD, FONT, GUARD, PALETTE, PLAYER } from './config.js';
import { DESK, EXIT, LEDGER, PILLAR, VAULT_DOOR, WALL, castRay } from './level.js';
import { cameraAngle } from './camera.js';
import { GUARD_CHASE } from './guard.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_OVER = 'over';
export const SCREEN_WIN = 'win';

const PANEL = { width: 640, top: 150, line: 32, bottom: 76 };
const CONE_RAYS = 26;
const BEAM_RAYS = 20;

/** A vision cone as a raycast polygon: the watcher's eye, then where each ray stops. */
function conePath(context, x, y, angle, halfAngle, range, rays, solids) {
  context.beginPath();
  context.moveTo(x, y);
  for (let index = 0; index <= rays; index += 1) {
    const rayAngle = angle - halfAngle + (2 * halfAngle * index) / rays;
    const distance = castRay(x, y, rayAngle, range, solids);
    context.lineTo(x + Math.cos(rayAngle) * distance, y + Math.sin(rayAngle) * distance);
  }
  context.closePath();
}

export function createRenderer(canvas) {
  const context = canvas.getContext('2d');
  const view = { scale: 1, x: 0, y: 0 };
  const fonts = new Map();

  function resize() {
    const ratio = window.devicePixelRatio || 1;
    const width = Math.round(window.innerWidth * ratio);
    const height = Math.round(window.innerHeight * ratio);
    canvas.width = width;
    canvas.height = height;
    view.scale = Math.min(width / FIELD.width, height / FIELD.height);
    view.x = (width - FIELD.width * view.scale) / 2;
    view.y = (height - FIELD.height * view.scale) / 2;
  }

  function text(value, x, y, size, color, align) {
    if (!fonts.has(size)) fonts.set(size, `${size}px ${FONT}`);
    context.font = fonts.get(size);
    context.fillStyle = color;
    context.textAlign = align;
    context.fillText(value, x, y);
  }

  function drawFloor(state) {
    context.fillStyle = PALETTE.floor;
    context.fillRect(0, 0, FIELD.width, FIELD.height);
    // Marble tiles: a quiet checker of large slabs with a faint vein through each.
    context.fillStyle = PALETTE.floorTile;
    for (let ty = 0; ty < 6; ty += 1) {
      for (let tx = 0; tx < 10; tx += 1) {
        if ((tx + ty) % 2 === 0) context.fillRect(tx * 128 + 24, ty * 120 + 24, 128, 120);
      }
    }
    context.strokeStyle = PALETTE.floorVein;
    context.lineWidth = 1;
    context.beginPath();
    for (let ty = 0; ty < 6; ty += 1) {
      for (let tx = 0; tx < 10; tx += 1) {
        const x0 = tx * 128 + 24;
        const y0 = ty * 120 + 24;
        context.moveTo(x0 + 20, y0 + 90);
        context.lineTo(x0 + 70, y0 + 30);
        context.lineTo(x0 + 120, y0 + 70);
      }
    }
    context.stroke();
    // The vault room's carpet: a deep red runner that says "the prize is in here".
    context.fillStyle = '#3d1420';
    context.fillRect(900, 24, 356, 256);
    context.fillStyle = '#4a1826';
    context.fillRect(920, 44, 316, 216);
    // The getaway door, bottom right: a green-lit exit, and the service door, bottom left.
    context.fillStyle = PALETTE.exitGlow;
    context.fillRect(EXIT.x, EXIT.y - 6, EXIT.w, 6);
    text('GETAWAY', EXIT.x + EXIT.w / 2, EXIT.y - 12, 15, PALETTE.exitGlow, 'center');
    context.fillStyle = PALETTE.muted;
    text('SERVICE DOOR', 100, 690, 13, PALETTE.muted, 'center');
  }

  function drawSolids(state) {
    for (const solid of state.solids) {
      if (solid.kind === VAULT_DOOR) continue;
      if (solid.kind === WALL) {
        context.fillStyle = PALETTE.wall;
        context.fillRect(solid.x, solid.y, solid.w, solid.h);
        context.fillStyle = PALETTE.wallTop;
        if (solid.h <= 24) context.fillRect(solid.x, solid.y, solid.w, 5);
        else context.fillRect(solid.x, solid.y, 5, solid.h);
      } else if (solid.kind === PILLAR) {
        context.fillStyle = PALETTE.pillar;
        context.fillRect(solid.x, solid.y, solid.w, solid.h);
        context.fillStyle = PALETTE.wallTop;
        context.fillRect(solid.x + 4, solid.y + 4, solid.w - 8, 6);
        context.fillStyle = PALETTE.goldDark;
        context.fillRect(solid.x + solid.w / 2 - 2, solid.y, 4, solid.h);
      } else if (solid.kind === DESK) {
        context.fillStyle = PALETTE.desk;
        context.fillRect(solid.x, solid.y, solid.w, solid.h);
        context.fillStyle = PALETTE.deskTop;
        context.fillRect(solid.x + 5, solid.y + 5, solid.w - 10, solid.h - 10);
        context.fillStyle = PALETTE.gold;
        context.fillRect(solid.x + 12, solid.y + 12, 10, 8);
        context.fillRect(solid.x + solid.w - 26, solid.y + solid.h - 20, 12, 8);
      }
    }
    // The vault door: brass, barred while locked, swung open once cracked.
    const door = { x: 1040, y: 280, w: 80, h: 20 };
    if (state.doorOpen) {
      context.fillStyle = PALETTE.vaultDoor;
      context.fillRect(door.x, door.y + door.h, door.w, 4);
      context.fillStyle = PALETTE.vaultGlow;
      context.fillRect(door.x + 6, door.y - 2, door.w - 12, 4);
    } else {
      context.fillStyle = PALETTE.vaultDoor;
      context.fillRect(door.x, door.y, door.w, door.h);
      context.fillStyle = '#5d4718';
      context.fillRect(door.x + 8, door.y + 4, 8, 12);
      context.fillRect(door.x + 36, door.y + 4, 8, 12);
      context.fillRect(door.x + 64, door.y + 4, 8, 12);
      context.beginPath();
      context.arc(door.x + door.w / 2, door.y + door.h / 2, 9, 0, Math.PI * 2);
      context.fillStyle = PALETTE.vaultGlow;
      context.fill();
      context.fillStyle = '#5d4718';
      context.beginPath();
      context.arc(door.x + door.w / 2, door.y + door.h / 2, 4, 0, Math.PI * 2);
      context.fill();
      if (state.doorCrack > 0) {
        const progress = state.doorCrack / PLAYER.crackTime;
        context.fillStyle = PALETTE.panel;
        context.fillRect(door.x - 10, door.y - 24, door.w + 20, 8);
        context.fillStyle = PALETTE.gold;
        context.fillRect(door.x - 10, door.y - 24, (door.w + 20) * progress, 8);
        text('CRACKING…', door.x + door.w / 2, door.y - 30, 13, PALETTE.gold, 'center');
      }
    }
    // The vault itself: a brass-ringed door on the north wall, and the ledger's glow.
    context.strokeStyle = PALETTE.vaultDoor;
    context.lineWidth = 5;
    context.beginPath();
    context.arc(1150, 120, 26, 0, Math.PI * 2);
    context.stroke();
    context.fillStyle = '#2a2118';
    context.beginPath();
    context.arc(1150, 120, 20, 0, Math.PI * 2);
    context.fill();
  }

  function drawLoot(state) {
    for (const bar of state.gold) {
      if (bar.taken) continue;
      context.fillStyle = PALETTE.goldDark;
      context.fillRect(bar.x - 11, bar.y - 6, 22, 12);
      context.fillStyle = PALETTE.gold;
      context.fillRect(bar.x - 9, bar.y - 8, 18, 10);
      context.fillStyle = '#fff3c4';
      context.fillRect(bar.x - 6, bar.y - 7, 5, 3);
    }
    if (!state.hasLedger) {
      const pulse = 0.6 + 0.4 * Math.sin(state.elapsed * 3);
      context.fillStyle = `rgba(255, 215, 106, ${0.25 * pulse})`;
      context.beginPath();
      context.arc(LEDGER.x, LEDGER.y, 30 + 6 * pulse, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = '#7a1f2b';
      context.fillRect(LEDGER.x - 12, LEDGER.y - 9, 24, 18);
      context.fillStyle = PALETTE.gold;
      context.fillRect(LEDGER.x - 12, LEDGER.y - 9, 24, 4);
      context.fillRect(LEDGER.x - 1, LEDGER.y - 9, 2, 18);
      text('THE MERIDIAN LEDGER', LEDGER.x, LEDGER.y - 40, 13, PALETTE.vaultGlow, 'center');
    }
    text('VAULT', 1078, 60, 15, PALETTE.vaultGlow, 'center');
  }

  function drawConesAndBeams(state) {
    const solids = state.solids;
    for (const guard of state.guards) {
      const alerted = guard.state === GUARD_CHASE || guard.seen;
      conePath(context, guard.x, guard.y, guard.angle, GUARD.sightHalfAngle, GUARD.sightRange, CONE_RAYS, solids);
      context.fillStyle = alerted ? PALETTE.coneAlert : PALETTE.cone;
      context.fill();
      context.strokeStyle = alerted ? PALETTE.coneAlertEdge : PALETTE.coneEdge;
      context.lineWidth = 1.5;
      context.stroke();
    }
    for (const camera of state.cameras) {
      const angle = cameraAngle(camera);
      const frozen = camera.frozenLeft > 0;
      conePath(context, camera.x, camera.y, angle, CAMERA.sightHalfAngle, CAMERA.sightRange, BEAM_RAYS, solids);
      context.fillStyle = frozen ? 'rgba(120, 130, 150, 0.08)' : PALETTE.beam;
      context.fill();
      context.strokeStyle = frozen ? 'rgba(120, 130, 150, 0.4)' : PALETTE.beamEdge;
      context.lineWidth = 1.5;
      context.stroke();
      // The camera body: a small housing on the wall, lens pointing down the beam.
      context.fillStyle = frozen ? '#5a6274' : '#2b3f5c';
      context.fillRect(camera.x - 10, camera.y - 7, 20, 14);
      context.fillStyle = frozen ? '#8b93a3' : '#4fc3f7';
      context.beginPath();
      context.arc(camera.x + Math.cos(angle) * 10, camera.y + Math.sin(angle) * 10, 4, 0, Math.PI * 2);
      context.fill();
    }
  }

  function drawSmoke(state) {
    for (const smoke of state.smokes) {
      context.fillStyle = PALETTE.smoke;
      context.beginPath();
      context.arc(smoke.x, smoke.y, smoke.r, 0, Math.PI * 2);
      context.fill();
      context.beginPath();
      context.arc(smoke.x - smoke.r * 0.4, smoke.y + smoke.r * 0.3, smoke.r * 0.6, 0, Math.PI * 2);
      context.fill();
      context.beginPath();
      context.arc(smoke.x + smoke.r * 0.4, smoke.y - smoke.r * 0.3, smoke.r * 0.55, 0, Math.PI * 2);
      context.fill();
    }
  }

  function drawGuards(state) {
    for (const guard of state.guards) {
      context.fillStyle = PALETTE.guard;
      context.beginPath();
      context.arc(guard.x, guard.y, GUARD.radius, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = PALETTE.guardCap;
      context.beginPath();
      context.arc(guard.x, guard.y - 3, 8, 0, Math.PI * 2);
      context.fill();
      // Facing tick, and a red "!" while the guard is hunting.
      context.strokeStyle = '#dfe6f2';
      context.lineWidth = 3;
      context.beginPath();
      context.moveTo(guard.x, guard.y);
      context.lineTo(guard.x + Math.cos(guard.angle) * (GUARD.radius + 7), guard.y + Math.sin(guard.angle) * (GUARD.radius + 7));
      context.stroke();
      if (guard.state === GUARD_CHASE) {
        text('!', guard.x, guard.y - GUARD.radius - 8, 20, PALETTE.danger, 'center');
      } else if (guard.state === 'investigate') {
        text('?', guard.x, guard.y - GUARD.radius - 8, 20, PALETTE.gold, 'center');
      } else if (guard.seen) {
        // A guard that has spotted something but is not sure yet: a glance, not a chase.
        text('!', guard.x, guard.y - GUARD.radius - 8, 20, PALETTE.gold, 'center');
      }
    }
  }

  function drawPlayer(state) {
    const player = state.player;
    if (state.caught) return;
    // A hooded figure in dark cloth: cloak, hood, and a pale mask catching the light.
    context.fillStyle = PALETTE.playerCloak;
    context.beginPath();
    context.arc(player.x, player.y, PLAYER.radius, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = PALETTE.player;
    context.beginPath();
    context.arc(player.x + Math.cos(player.angle) * 4, player.y + Math.sin(player.angle) * 4, 6, 0, Math.PI * 2);
    context.fill();
    context.strokeStyle = PALETTE.player;
    context.lineWidth = 2;
    context.beginPath();
    context.moveTo(player.x, player.y);
    context.lineTo(player.x + Math.cos(player.angle) * (PLAYER.radius + 6), player.y + Math.sin(player.angle) * (PLAYER.radius + 6));
    context.stroke();
    if (player.targetX !== null) {
      context.strokeStyle = 'rgba(238, 241, 245, 0.5)';
      context.lineWidth = 1.5;
      context.beginPath();
      context.arc(player.targetX, player.targetY, 8, 0, Math.PI * 2);
      context.stroke();
      context.beginPath();
      context.moveTo(player.targetX - 12, player.targetY);
      context.lineTo(player.targetX + 12, player.targetY);
      context.moveTo(player.targetX, player.targetY - 12);
      context.lineTo(player.targetX, player.targetY + 12);
      context.stroke();
    }
  }

  function drawHud(state, muted) {
    // Top bar: loot left, alarm centre, kit and tools right.
    context.fillStyle = 'rgba(10, 12, 18, 0.72)';
    context.fillRect(0, 0, FIELD.width, 52);
    context.textBaseline = 'top';
    text(`LOOT $${state.loot}`, 24, 14, 26, PALETTE.gold, 'left');
    if (state.hasLedger) text('LEDGER ✓', 190, 16, 22, PALETTE.vaultGlow, 'left');
    // The alarm meter: a bar that fills gold, then red, with its word underneath the number.
    const meterX = FIELD.width / 2 - 150;
    const meterW = 300;
    context.fillStyle = '#2a2f3f';
    context.fillRect(meterX, 14, meterW, 16);
    const fraction = state.alarm / 100;
    context.fillStyle = state.lockdownLeft > 0 ? PALETTE.danger : fraction > 0.6 ? '#e08a3c' : PALETTE.gold;
    context.fillRect(meterX, 14, meterW * fraction, 16);
    context.strokeStyle = PALETTE.panelEdge;
    context.lineWidth = 1;
    context.strokeRect(meterX, 14, meterW, 16);
    const alarmWord = state.lockdownLeft > 0 ? 'LOCKDOWN' : state.seenNow ? 'SPOTTED' : fraction > 0.5 ? 'SUSPICIOUS' : 'ALARM';
    text(`${alarmWord} ${Math.floor(state.alarm)}%`, FIELD.width / 2, 34, 14, state.lockdownLeft > 0 ? PALETTE.danger : PALETTE.muted, 'center');
    text(`KIT ×${state.player.kit}`, FIELD.width - 24, 14, 22, PALETTE.text, 'right');
    text('1 lockpick · 2 EMP · 3 smoke · 4 decoy', FIELD.width - 24, 36, 13, PALETTE.muted, 'right');
    const minutes = Math.floor(state.elapsed / 60);
    const seconds = Math.floor(state.elapsed % 60);
    text(`${minutes}:${String(seconds).padStart(2, '0')}`, FIELD.width / 2 - 190, 14, 20, PALETTE.muted, 'right');
    if (muted) text('MUTED (M)', 24, 56, 13, PALETTE.muted, 'left');
    // A red wash creeps in as the alarm fills: tension you can feel before you read it.
    if (state.alarm > 55 && state.lockdownLeft <= 0) {
      context.fillStyle = `rgba(229, 83, 75, ${((state.alarm - 55) / 45) * 0.10})`;
      context.fillRect(0, 0, FIELD.width, FIELD.height);
    }
    if (state.lockdownLeft > 0) {
      context.fillStyle = 'rgba(229, 83, 75, 0.12)';
      context.fillRect(0, 0, FIELD.width, FIELD.height);
      text('LOCKDOWN — BREAK LINE OF SIGHT', FIELD.width / 2, 62, 18, PALETTE.danger, 'center');
    }
  }

  function drawPanel(title, lines, prompt) {
    const height = PANEL.top + lines.length * PANEL.line + PANEL.bottom;
    const x = (FIELD.width - PANEL.width) / 2;
    const y = (FIELD.height - height) / 2;
    context.fillStyle = 'rgba(10, 12, 18, 0.55)';
    context.fillRect(0, 0, FIELD.width, FIELD.height);
    context.fillStyle = PALETTE.panel;
    context.fillRect(x, y, PANEL.width, height);
    context.strokeStyle = PALETTE.panelEdge;
    context.lineWidth = 2;
    context.strokeRect(x, y, PANEL.width, height);
    context.textBaseline = 'alphabetic';
    text(title, FIELD.width / 2, y + 78, 46, PALETTE.text, 'center');
    for (let index = 0; index < lines.length; index += 1) {
      text(lines[index], FIELD.width / 2, y + PANEL.top + index * PANEL.line, 21, PALETTE.muted, 'center');
    }
    text(prompt, FIELD.width / 2, y + height - 38, 23, PALETTE.gold, 'center');
  }

  /** Paint one frame: the floor, then the HUD or a panel for the screen the game is on. */
  function draw(state, screen, best, muted) {
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.fillStyle = PALETTE.backdrop;
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.setTransform(view.scale, 0, 0, view.scale, view.x, view.y);
    drawFloor(state);
    drawSolids(state);
    drawLoot(state);
    drawConesAndBeams(state);
    drawSmoke(state);
    drawGuards(state);
    drawPlayer(state);
    if (screen === SCREEN_TITLE) {
      drawPanel('THE MERIDIAN VAULT', [
        'One quiet thief. One bank, asleep but watched.',
        'Cross the floor, crack the vault, take the Meridian Ledger,',
        'and reach the getaway door — unseen, or at least uncaught.',
        'WASD / arrows to move · click to walk there',
        '1 lockpick · 2 EMP · 3 smoke · 4 decoy · P pause · M mute',
        `Best loot so far: $${best}`,
      ], 'Press Space or click to begin the heist');
      return;
    }
    drawHud(state, muted);
    if (screen === SCREEN_PAUSED) {
      drawPanel('Paused', ['The guards wait. The cameras keep sweeping.'], 'Press P to slip back in');
    } else if (screen === SCREEN_OVER) {
      drawPanel('CAUGHT', [
        `The floor woke up. Loot kept: $${state.loot}`,
        state.hasLedger ? 'You had the ledger in your hands.' : 'The ledger is still in the vault.',
        `Best loot so far: $${best}`,
      ], 'Press Space or R to try again');
    } else if (screen === SCREEN_WIN) {
      const minutes = Math.floor(state.elapsed / 60);
      const seconds = Math.floor(state.elapsed % 60);
      drawPanel('CLEAN GETAWAY', [
        `The Meridian Ledger is yours. Loot: $${state.loot}`,
        `Out in ${minutes}:${String(seconds).padStart(2, '0')} — the van never even slowed down.`,
        `Best loot so far: $${best}`,
      ], 'Press Space or R to run it again');
    }
  }

  resize();
  window.addEventListener('resize', resize);
  return { draw };
}
