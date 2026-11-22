// Boot and the one loop: input is read every frame, the world advances in fixed 1/60 s
// steps (several in a slow frame, none in a fast one), and the renderer paints what is
// there. The game moves between five screens: title, play, paused, caught and getaway.
//
// ?seed=N fixes the game. ?shot=start|play|alert|win (with &seed=N) stages that scene
// instead of running the loop, paints it twice and sets window.__shotReady for a screenshot,
// with the scene's numbers on window.__shotState for checking.

import { BEST_KEY, STEP } from './config.js';
import { createRandom } from './random.js';
import { createWorld, EVENT_CAUGHT, EVENT_DOOR, EVENT_GOLD, EVENT_LEDGER, EVENT_LOCKDOWN, EVENT_TOOL, EVENT_WIN } from './world.js';
import {
  ACTION_CONFIRM,
  ACTION_MUTE,
  ACTION_PAUSE,
  ACTION_RETRY,
  ACTION_TOOL_1,
  ACTION_TOOL_2,
  ACTION_TOOL_3,
  ACTION_TOOL_4,
  createInput,
} from './input.js';
import { createRenderer, SCREEN_OVER, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_TITLE, SCREEN_WIN } from './render.js';
import { createAudio } from './audio.js';
import { stageShot } from './shots.js';
import { TOOL_DECOY, TOOL_EMP, TOOL_LOCKPICK, TOOL_SMOKE } from './player.js';

/** The longest frame the loop catches up on; a longer stall (a hidden tab) is dropped. */
const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const world = createWorld(createRandom(seed));
const renderer = createRenderer(canvas);
const audio = createAudio();

function readBest() {
  try {
    return Number.parseInt(window.localStorage.getItem(BEST_KEY) ?? '0', 10) || 0;
  } catch {
    return 0;
  }
}

function saveBest(value) {
  try {
    window.localStorage.setItem(BEST_KEY, String(value));
  } catch {
    // Storage can be off (private windows): the best loot then lasts this visit only.
  }
}

function runShot(name) {
  const scene = stageShot(name, world);
  // The scene's numbers, on the window for checking: alarm, loot, ledger, screen.
  window.__shotState = {
    shot: name,
    screen: scene.screen,
    alarm: Math.round(world.state.alarm),
    loot: world.state.loot,
    hasLedger: world.state.hasLedger,
    doorOpen: world.state.doorOpen,
    caught: world.state.caught,
    won: world.state.won,
    playerX: Math.round(world.state.player.x),
    playerY: Math.round(world.state.player.y),
  };
  document.title = `shot=${name} screen=${scene.screen} alarm=${window.__shotState.alarm} loot=${world.state.loot} ledger=${world.state.hasLedger} won=${world.state.won} caught=${world.state.caught}`;
  let painted = 0;
  function paint() {
    renderer.draw(world.state, scene.screen, scene.best, false);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas);
  let screen = SCREEN_TITLE;
  let best = readBest();
  let accumulator = 0;
  let last = performance.now();

  // Screen readers (and anyone watching the page's text) hear the screen changes and the
  // big moments: spotted, lockdown, the ledger, the getaway.
  function announce(message) {
    status.textContent = message;
  }

  function startGame() {
    world.reset();
    accumulator = 0;
    screen = SCREEN_PLAY;
    audio.unlock();
    announce('Playing. Cross the floor, crack the vault, take the ledger, reach the getaway door.');
  }

  function endGame(won) {
    screen = won ? SCREEN_WIN : SCREEN_OVER;
    audio.stopAlarm();
    if (won) audio.win();
    else audio.caught();
    if (world.state.loot > best) {
      best = world.state.loot;
      saveBest(best);
    }
    announce(won ? `Clean getaway. Loot $${world.state.loot}.` : `Caught. Loot kept: $${world.state.loot}.`);
  }

  function toolFromActions(actions) {
    if (actions & ACTION_TOOL_1) return TOOL_LOCKPICK;
    if (actions & ACTION_TOOL_2) return TOOL_EMP;
    if (actions & ACTION_TOOL_3) return TOOL_SMOKE;
    if (actions & ACTION_TOOL_4) return TOOL_DECOY;
    return -1;
  }

  function handleActions() {
    const actions = input.takeActions();
    if (actions & ACTION_MUTE) {
      const muted = audio.toggleMute();
      announce(muted ? 'Muted.' : 'Sound on.');
    }
    if (actions & ACTION_CONFIRM) audio.unlock();
    if (actions & ACTION_RETRY && screen !== SCREEN_TITLE) {
      startGame();
      return;
    }
    if (actions & ACTION_CONFIRM && (screen === SCREEN_TITLE || screen === SCREEN_OVER || screen === SCREEN_WIN)) {
      startGame();
    } else if (actions & ACTION_PAUSE && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      audio.stopAlarm();
      announce('Paused.');
    } else if (actions & (ACTION_PAUSE | ACTION_CONFIRM) && screen === SCREEN_PAUSED) {
      screen = SCREEN_PLAY;
      announce('Playing.');
    }
    return actions;
  }

  function step(actions) {
    if (screen === SCREEN_TITLE) {
      world.step(STEP, { x: 0, y: 0 }, -1, null, true);
      return;
    }
    const click = input.takeClick();
    const tool = toolFromActions(actions);
    const events = world.step(STEP, input.move(), tool, click, false);
    audio.alarm(world.state.alarm / 100);
    if (events & EVENT_GOLD) audio.gold();
    if (events & EVENT_LEDGER) audio.ledger();
    if (events & EVENT_DOOR) audio.door();
    if (events & EVENT_TOOL) audio.tool();
    if (events & EVENT_LOCKDOWN) announce('Lockdown! Every guard is hunting you.');
    if (events & EVENT_CAUGHT) endGame(false);
    else if (events & EVENT_WIN) endGame(true);
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    const actions = handleActions();
    if (screen === SCREEN_TITLE || screen === SCREEN_PLAY) {
      // One-shot presses count once: only the first fixed step of the frame sees them.
      let firstActions = actions;
      while (accumulator >= STEP && (screen === SCREEN_TITLE || screen === SCREEN_PLAY)) {
        step(firstActions);
        firstActions = 0;
        accumulator -= STEP;
      }
    } else {
      accumulator = 0;
    }
    renderer.draw(world.state, screen, best, audio.muted);
  }

  // Leaving the tab pauses a running game rather than letting the guards hunt unseen.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      audio.stopAlarm();
      announce('Paused.');
    }
  });

  announce('The Meridian Vault. Press Space or click to begin the heist.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
