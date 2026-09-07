# Games

`games/` is a sibling of `apps/`. Its index uses the same compact gallery style as
the main site. Games also appear in `metadata.json`.

## Dungeon

Open `/games/lantern-labyrinth/`. The existing URL is retained. Run
`python3 -m http.server 8000` from the repository root for local development.

Start in a safe town. Approach a signed building and press F or B: Bowyer sells
damage ranks and bow options; Outfitter trains movement and vitality; Inn restores
health for free; Waygate travels to unlocked checkpoints. Walk to the dark stairwell
and press F to enter the dungeon. Underground floors use nine uneven, lobed chambers with offset centers linked by bending passageways,
with ceilings, wooden doors, stone ribs, and barred cell partitions. F operates
nearby doors; enemies can open them too. Closed doors and bars block arrows. F at the entrance stairs returns to town; F at
the far stairwell descends one floor. Town's entrance starts at floor 1. Reaching floors 5, 10, 15, and so on
permanently unlocks those destinations at the Waygate, including after defeat or
refresh. Checkpoint floors have marked arrival stairs and stronger guardians with
double coin rewards. Cleared enemies stay cleared on revisits (ambient reinforcements resume
while that floor is active).

Enemy health, damage, and coin rewards increase with depth. Health and rewards
include a quadratic component; deeper floors also have more enemies, faster
reinforcements, and a stronger mix of tiers. Sentinels telegraph a straight-line charge with
a crouch and glow; dodge sideways, interrupt with an arrow, or punish their recovery.
Treasure chests grant coins and a little healing once per floor. Purple sealed
chests explicitly offer an ambush; defeat both guards before claiming the reward. A guardian starts at each descent. Coins and bow
and movement upgrades carry between areas. Defeat costs 25% of coins and resets
the dungeon, retaining upgrades. Coins, damage, vitality, movement, and checkpoint progress save locally. Damage
and vitality have no gameplay level cap, with increasing prices; movement remains
bounded to keep controls manageable.
Town also sells permanent bow options: Quickdraw trades 20% damage for faster
recovery, Longbow trades recovery speed for 60% more damage, and Piercing deals
10% less damage but can hit three enemies. Switching owned options is free in
town. Piercing shots still stop at walls and closed doors. Multishot has two permanent
ranks: 3 horizontal arrows at 65% damage each (64 coins), then 5 at 50% each
(160 coins). It combines with the equipped bow type and uses one firing cooldown.
Dungeon layouts and exploration remain session-only. Controls includes a confirmed
Reset saved progress action. NPC quests, loot equipment, and magic remain future work.

- **W/S:** forward/back; **A/D:** strafe; **mouse:** captured first-person look
- **Left click:** bow (dungeon only); hold to repeat
- **F:** operate nearby doors, stairs, or treasure chests
- **M:** explored map; undiscovered areas stay dark, and opening the map pauses play
- **B:** nearby town service
- **Space:** jump; **T:** spray a yellow smiley on a wall
- **Escape:** pause and release mouse
- **Touch:** movement pad, drag to aim, Fire, Jump, Spray, and stair button

The map reveals cells within the camera’s actual field of view and clear sightlines,
including when turning in place. Walls and closed doors occlude exploration;
previously seen cells remain revealed. It shows
stairs only once discovered. A compact top-left minimap tracks the player with heading and view cone; M opens the full map. Sound is optional in Controls.
Moving enemies make quiet, varied shuffling footsteps, with heavier steps for larger tiers.
Steps follow distance traveled, pan with the listener, and become quieter and muffled through walls. Stationary enemies and player footsteps are silent; the bow uses a quiet, separate twang. Enemy sounds
stop on pause, mute, travel, or enemy death. Arrow hits briefly stagger survivors,
interrupting movement and attacks; heavier enemies recover sooner. Headshots
deal double damage and flash a gold hit marker.
All assets are procedural or use the vendored Three.js r128. `maze.js` handles
layouts and collision, `combat.js` handles enemy simulation and depth scaling,
and `game.js` handles rendering, input, travel, and session progression.

## Verification

`node check-syntax.js` checks both games pages and their first-party scripts.
`node tools/loadtest/run.js` includes the games directory in its startup checks.
After installing the existing `tools/loadtest` dependencies:

```sh
NODE_PATH=tools/loadtest/node_modules node --test games/lantern-labyrinth/tests/*.test.js
```

Tests cover 120 generated mazes, exit reachability, loops, collision, a complete
walk to the exit, pause/resume, regeneration, camera heading and wall clearance,
paint raycasting and lifetime, jumping and landing, captured mouse and strafing,
arrow occlusion, enemy pursuit and rewards, shop limits, run resets, touch
cancellation, and the WebGL fallback.
They use real Three.js geometry and raycasting with a stub renderer; GPU output
still requires hands-on browser playtesting.

Enemy health, damage, and coin rewards grow with a quadratic depth curve. Deeper floors favor hunters and sentinels, including opening encounters and reinforcements. Movement speed grows gradually toward a 35% bonus so positioning remains viable.
