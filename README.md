# The Meridian Vault

[![best-heist-game-20261122-0559](https://make.fun/badge/best-heist-game-20261122-0559.svg)](https://make.fun/c/best-heist-game-20261122-0559)
[![rank](https://make.fun/badge/best-heist-game-20261122-0559/TUHIN729/best-heist-game/rank.svg)](https://make.fun/c/best-heist-game-20261122-0559)
[![reward](https://make.fun/badge/best-heist-game-20261122-0559/TUHIN729/best-heist-game/reward.svg)](https://make.fun/c/best-heist-game-20261122-0559)

One quiet thief, one bank asleep but watched. Cross the marble floor of the Meridian Vault
past three patrolling guards with raycast vision cones and three sweeping wall cameras,
crack the vault door, take the Meridian Ledger, and reach the getaway door — unseen, or at
least uncaught.

The alarm meter fills whenever a guard or a camera holds you in its sights and drains in
shadow; fill it and the whole floor goes into lockdown, every guard hunting. A glance is
only suspicion — a guard chases once it has stared for a moment — so a quick step through
a cone edge is survivable, and a slow one is not. Four tools, each costing one kit charge:
a lockpick that cracks the vault door at once, an EMP that freezes the cameras, smoke that
breaks every line of sight, and a decoy that pulls the nearest guard off its patrol. Three
routes cross the floor — the west gallery, the marble hall, the east corridor — and the
gold bars scattered across it pay for the risk of going in.

## How to play

- **Move:** WASD or arrow keys, or click a spot on the floor to walk there
- **Tools:** `1` lockpick · `2` EMP · `3` smoke · `4` decoy
- **Pause:** `P` (or `Esc`) · **Retry:** `R` · **Mute:** `M`
- **Start / restart:** `Space` or click

Grab the ledger inside the vault, then reach the green-lit getaway door at the bottom
right. Get caught by a chasing guard and the run is over. No network, no libraries —
plain canvas 2D and WebAudio synth, all in `game/`.

Serve it with any static server over `game/` (for example `python3 -m http.server` inside
`game/`) and open `index.html`.
