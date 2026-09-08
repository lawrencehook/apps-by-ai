# Dungeon: possible next steps

Working notes, September 8, 2026. These are candidates for future iterations, not committed scope.

## Direction

Progression is the central source of fun: a long endgame with reasons to descend, return to town, improve, and try again. Favor reusable systems over bespoke content that needs extensive attention per floor. Keep changes small enough to play and judge individually.

The shared mood board is a combination of Valorant, RuneScape, FATE, and Myst: readable combat, lasting advancement, a safe town above dangerous depths, and an atmospheric world worth exploring. These are creative references, not a requirement to reproduce any one game.

## Suggested next gameplay experiment

Add persistent Archery XP and uncapped levels alongside coin upgrades.

- Award XP for kills, scaled by enemy tier and dungeon depth.
- Try geometrically increasing XP requirements; `100 × 1.12^(level − 1)` is an initial tuning example, not a final balance decision.
- Give each level a modest permanent benefit. Decide how it combines with purchased damage before implementation.
- Retain earned XP on death, so unsuccessful expeditions still advance the character.
- Balance XP requirements against deeper-floor rewards and enemy strength. Easy-floor farming should remain possible, while pushing deeper should be worthwhile.
- Store progression defensively: extreme levels must not overflow numeric calculations or corrupt saves.

First playtest questions: How long does the first level take? When does another floor feel worth the risk? Do later upgrades produce a noticeable improvement? Does the player have a clear next objective without a crowded HUD?

## Later progression candidates

- Random bows with growing item levels and a small modifier pool: attack speed, critical chance, stagger strength. Start with one equipment slot.
- Compare new equipment clearly; avoid inventory management becoming the main activity.
- Reusable floor modifiers that change tactics and rewards, rather than only increasing enemy health.
- Tune the economy over multiple expeditions, especially damage upgrades, vitality, multishot, and checkpoint travel.

Unique bosses and individually designed ability unlocks are lower priority: their bespoke design and animation cost is high compared with reusable progression systems.

## World and presentation follow-ups

- Give interiors a little more purpose and variety: workshop furnishings, inn rooms, and a tower lookout, with stairs and movement paths kept clear.
- Review door opening, stair landings, window glass, and interior lighting during actual play, including upgraded movement speed.
- Extend the town's visual consistency to dungeon materials and lighting without compromising enemy readability.
- Profile shadows and decorative geometry on a modest machine; reduce cost if the visual improvements affect responsiveness.
- Continue browser comparisons at consistent viewpoints, plus movement checks. GPU shader failures are not caught by JavaScript syntax tests.

## Parked idea: real-world inputs

The user explicitly tabled this. Possible future experiments include public building footprints, terrain, or weather influencing a dungeon. A single location-inspired checkpoint floor would be a smaller experiment than a geographic generation system. No location data or integration has been added.

## Current stopping point

Five varied town buildings, walkable interiors and upper floors, transparent windows, automatic hinged doors, a fully revealed town map, and one gateway for floor 1 and unlocked checkpoints. Recent visual passes added shadows, roof texture, lanterns, flower boxes, a raised fountain, softer hills, and a working cloud shader.

Dungeon progression currently uses coins and upgrades, depth-scaled enemies and rewards, and checkpoints. Archery XP and equipment drops above are proposals, not implemented features.
