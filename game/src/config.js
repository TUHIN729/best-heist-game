// Every tuning number and colour for The Meridian Vault, in one place. The playfield is a
// fixed 1280x720 logical area; the renderer scales it to the window, so no rule below depends
// on the screen size. The vault floor is a night bank: marble, brass, deep shadow.

export const FIELD = { width: 1280, height: 720 };

/** The simulation's fixed step, in seconds: 60 updates a second whatever the display's rate. */
export const STEP = 1 / 60;

export const PLAYER = {
  radius: 12,
  speed: 205,
  /** Seconds standing at the vault door to crack it without a lockpick. */
  crackTime: 3,
};

export const GUARD = {
  radius: 13,
  patrolSpeed: 72,
  chaseSpeed: 132,
  investigateSpeed: 95,
  /** How far a guard can see, in pixels. */
  sightRange: 255,
  /** Half the vision cone's angle, in radians. */
  sightHalfAngle: 0.62,
  /** Bumped into: closer than this, a patrolling guard spots the thief at once. */
  bumpRange: 30,
  /** Touching a chasing guard ends the run. */
  catchRange: 24,
  /** Seconds a chasing guard keeps hunting after losing sight. */
  chaseMemory: 2.0,
  /** Seconds a guard pauses and sweeps at each patrol waypoint. */
  waypointPause: 0.9,
  /** Seconds of an unbroken look before a guard is sure enough to chase. */
  seenToChase: 1.2,
};

export const CAMERA = {
  sightRange: 300,
  sightHalfAngle: 0.34,
  /** Seconds for one full sweep across the camera's arc. */
  sweepPeriod: 5.2,
};

export const ALARM = {
  /** Per second while a guard has the thief in its cone. */
  guardRate: 42,
  /** Per second while a camera beam holds the thief. */
  cameraRate: 34,
  /** Per second the meter drains while nobody sees the thief. */
  drainRate: 18,
  /** Instant jump when a guard bumps into the thief. */
  bumpJump: 40,
  /** The meter level at which every guard is sure enough to chase on sight alone. */
  chaseAt: 40,
  /** Seconds of lockdown (all guards chase) once the meter fills. */
  lockdownSeconds: 10,
  /** Where the meter settles when lockdown ends. */
  afterLockdown: 55,
};

export const TOOLS = {
  /** Kit charges the thief starts with; gold never buys more, so every tool is a real choice. */
  startKit: 3,
  empSeconds: 6,
  smokeSeconds: 5,
  smokeRadius: 72,
  decoyRange: 190,
};

export const LOOT = {
  goldValue: 100,
  ledgerValue: 500,
};

export const PALETTE = {
  backdrop: '#0a0c12',
  floor: '#171a24',
  floorTile: '#1c202d',
  floorVein: '#232839',
  wall: '#3a3f55',
  wallTop: '#4a5068',
  pillar: '#2e3348',
  desk: '#4a3220',
  deskTop: '#5d4028',
  rope: '#7a1f2b',
  gold: '#f2c94c',
  goldDark: '#b98a1d',
  vaultDoor: '#8a6d2f',
  vaultGlow: '#ffd76a',
  player: '#e8e4d8',
  playerCloak: '#23272f',
  guard: '#3d5a80',
  guardCap: '#2b3f5c',
  cone: 'rgba(242, 201, 76, 0.16)',
  coneEdge: 'rgba(242, 201, 76, 0.55)',
  coneAlert: 'rgba(229, 83, 75, 0.22)',
  coneAlertEdge: 'rgba(229, 83, 75, 0.7)',
  beam: 'rgba(79, 195, 247, 0.15)',
  beamEdge: 'rgba(79, 195, 247, 0.55)',
  smoke: 'rgba(180, 185, 200, 0.35)',
  text: '#eef1f5',
  muted: '#9aa1b5',
  danger: '#e5534b',
  safe: '#58b368',
  panel: '#1d2230',
  panelEdge: '#39415c',
  exitGlow: '#58b368',
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

/** Where the best loot is kept between visits (this browser only). */
export const BEST_KEY = 'meridian-vault.best';
