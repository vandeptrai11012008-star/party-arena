# Party Arena — Original HTML Worlds

Party Arena offers **four games with their original HTML interfaces**, one lobby, 2–8 room members, and a shared live score table.

## Original sources preserved

- **Tank Survival:** uses the original Tank Survival engine and visual layout from `Explore_and_Earn_Space_Evolution_Fixed_v21(2).html`. Standard and Heavy **red enemy tanks take 3 direct cannon hits** (orange Scout tanks take 1). Wooden crates and barrels take 2 hits, sandbags take 3; when destroyed, these covers regenerate **12 seconds later** if the spawn area is clear. New destructible crates/barrels appear about every **16 seconds** (capped at 9 added covers per match). Concrete and steel remain permanent.
- **Skybound Trials (Jumping):** uses the original v21 platforms, controls, progression and visual scene.
- **Nebula Endless (Space):** uses the original v21 space world, HUD, bosses and exploration.
- **Fishing 3D:** uses the original first-person WebGL fishing HTML prototype supplied in this project, shown as a separate full-page game.

Unlike earlier rough Canvas recreations, Tank / Jumping / Space open the source HTML in `classic.html?partyMode=tank|jumping|space`; Fishing opens `fishing.html`. The parent `index.html` keeps a compact header with the room code, timer, current scores and buttons to return to lobby or exit.

## Multiplayer scope and limitations

Each person controls **their own instance of the original HTML game**. The shared room provides real-time score competition and a synchronized match timer, **not a synchronized game world** in which players' tanks/ships/characters see or interact with one another. This is a deliberate trade-off to retain the original interfaces and mechanics without rewriting each game engine. Local scores are browser-reported and rate-capped; they are **not tamper-proof competitive rankings**.

Fishing catches are reported to the room for points. The original local unlocks, shop, progress and personal records remain local to that browser; they do not synchronize among players.

## Playing online

1. On the homepage, enter a name and create a room.
2. Friends enter the same website and join using the six-character room code.
3. Host selects **Tank**, **Fishing 3D**, **Jumping** or **Space** in the lobby.
4. With at least two people, choose **START MATCH**, or choose **TEST SOLO** to practice alone.
5. The selected original HTML interface opens automatically after the countdown. The shared room header includes the score, remaining time and **LOBBY** (host-only). **EXIT** leaves the room.
6. The match ends after 120–150 seconds depending on game. The host can return everyone to lobby or start another game.

Optional synthesized background music is off by default; tap **MUSIC ON** to hear it.

## Files

- `server.js`: room codes, host authority, match clock, score collection, server events and static HTML routes.
- `index.html`: lobby, mode selection, room header, score table, iframe transition.
- `classic.html`: original Explore & Earn v21 (Tank Survival, Skybound Trials, Nebula Endless) with a small Party Arena score-message bridge.
- `fishing.html`: original first-person 3D fishing WebGL page with a catch-message bridge.

## Local run / Render

Node.js 18+: `node server.js`. Open http://localhost:3000. No third-party npm dependencies.

Render Web Service: build `npm install`, start `node server.js`, branch `main`. Previously used public URL: https://party-arena-2.onrender.com/ .

Rooms and scores are stored in memory: they disappear if the free Render instance sleeps or restarts. Rendering quality depends on the browser and graphics acceleration.