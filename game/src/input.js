// Keyboard and pointer input. Held keys give a steering direction; one-shot presses (start,
// pause, retry, mute, tools) are queued as bit flags and taken once by the loop, so a press
// between two frames is never lost and never counted twice. A click on the floor sets a
// destination the thief walks to; a key press cancels it.

import { FIELD } from './config.js';

export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_RETRY = 4;
export const ACTION_MUTE = 8;
export const ACTION_TOOL_1 = 16;
export const ACTION_TOOL_2 = 32;
export const ACTION_TOOL_3 = 64;
export const ACTION_TOOL_4 = 128;

const UP = new Set(['ArrowUp', 'KeyW']);
const DOWN = new Set(['ArrowDown', 'KeyS']);
const LEFT = new Set(['ArrowLeft', 'KeyA']);
const RIGHT = new Set(['ArrowRight', 'KeyD']);
const CONFIRM = new Set(['Space', 'Enter']);
const PAUSE = new Set(['KeyP', 'Escape']);
const RETRY = new Set(['KeyR']);
const MUTE = new Set(['KeyM']);
const TOOL_KEYS = new Map([
  ['Digit1', ACTION_TOOL_1],
  ['Digit2', ACTION_TOOL_2],
  ['Digit3', ACTION_TOOL_3],
  ['Digit4', ACTION_TOOL_4],
]);

export function createInput(canvas) {
  let up = false;
  let down = false;
  let left = false;
  let right = false;
  let actions = 0;
  let click = null;

  window.addEventListener('keydown', (event) => {
    if (UP.has(event.code)) up = true;
    else if (DOWN.has(event.code)) down = true;
    else if (LEFT.has(event.code)) left = true;
    else if (RIGHT.has(event.code)) right = true;
    else if (CONFIRM.has(event.code)) {
      if (!event.repeat) actions |= ACTION_CONFIRM;
    } else if (PAUSE.has(event.code)) {
      if (!event.repeat) actions |= ACTION_PAUSE;
    } else if (RETRY.has(event.code)) {
      if (!event.repeat) actions |= ACTION_RETRY;
    } else if (MUTE.has(event.code)) {
      if (!event.repeat) actions |= ACTION_MUTE;
    } else if (TOOL_KEYS.has(event.code)) {
      if (!event.repeat) actions |= TOOL_KEYS.get(event.code);
    } else return;
    event.preventDefault();
  });
  window.addEventListener('keyup', (event) => {
    if (UP.has(event.code)) up = false;
    else if (DOWN.has(event.code)) down = false;
    else if (LEFT.has(event.code)) left = false;
    else if (RIGHT.has(event.code)) right = false;
  });
  // A key released while the tab is hidden never sends keyup: let go of everything on blur.
  window.addEventListener('blur', () => {
    up = false;
    down = false;
    left = false;
    right = false;
  });
  canvas.addEventListener('pointerdown', (event) => {
    // Convert the click from screen pixels to floor coordinates, through the same scale
    // and centring the renderer uses.
    const rect = canvas.getBoundingClientRect();
    const ratio = window.devicePixelRatio || 1;
    const scale = Math.min((rect.width * ratio) / FIELD.width, (rect.height * ratio) / FIELD.height);
    const offsetX = (rect.width * ratio - FIELD.width * scale) / 2;
    const offsetY = (rect.height * ratio - FIELD.height * scale) / 2;
    const x = ((event.clientX - rect.left) * ratio - offsetX) / scale;
    const y = ((event.clientY - rect.top) * ratio - offsetY) / scale;
    if (x >= 0 && x <= FIELD.width && y >= 0 && y <= FIELD.height) {
      click = { x, y };
    }
    actions |= ACTION_CONFIRM;
  });

  return {
    /** The steering direction from the held keys: each component in -1..1. */
    move() {
      return { x: (right ? 1 : 0) - (left ? 1 : 0), y: (down ? 1 : 0) - (up ? 1 : 0) };
    },
    /** The one-shot presses since the last call, as ACTION_* flags. */
    takeActions() {
      const taken = actions;
      actions = 0;
      return taken;
    },
    /** The floor point of the last click, or null; taken once, like the actions. */
    takeClick() {
      const taken = click;
      click = null;
      return taken;
    },
  };
}
