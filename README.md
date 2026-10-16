# Party Arena — Four Worlds

Four browser games share room codes, a host-controlled lobby, a timer and a live scoreboard. The **Tank Survival Online** mode now has a **real-time shared world** where players see and interact with one another.

## Tank Survival Online — real-time multiplayer

- **One shared map:** 4,200 × 2,600 pixels. The server owns world position and state.
- **2–8 players:** each drives a separate coloured tank, visible to everyone with their nickname, armour and position.
- **Interaction:** battle other players (PvP), attack shared red/orange AI tanks (PvE), collide with other tanks and terrain, and pick up upgrades.
- **Tank behaviour:** tracked body and independent turret visuals based on the original Explore & Earn v21 Tank model.
- **Server-side authority:** driving, shells, collision, hit points, score, respawning, NPCs and destructible cover are all decided by the server, not by a player's browser.
- **Enemy tanks:** Scouts require one direct hit; Standard/Heavy red AI tanks require three.
- **Destructible obstacles:** wooden crates and barrels take two hits, sandbags take three, and regenerate **12 seconds** after destruction if the space is clear. Additional cover can appear every **16 seconds**, with a cap of 9 new obstacles per match. Steel supports one shell ricochet.
- **Extras:** minimap, camera tracking, mobile joystick and buttons, ammo effects, 5 increasingly challenging waves, and a five-minute round.
- **Join while playing:** new friends can join a running Tank match immediately when a room has an available player slot.

### Tank controls

**Desktop:** WASD / arrow keys move; move the mouse to aim; hold left click or Space to fire; Shift or E to dash.

**Phone:** left joystick to move; FIRE (auto-aims at a nearby tank) and DASH buttons on the right.

## The other three modes

These **retain the original HTML gameplay on each player's device** and compete on shared room scores; they are **not yet shared-world multiplayer**.

- **Fishing 3D:** the original first-person WebGL lake, fishing rod and line-tension mechanic. Successful catches contribute room points.
- **Skybound Trials (Jumping):** original v21 platform challenges, checkpoints and local progression.
- **Nebula Endless (Space):** original v21 ship, space exploration, enemies, regional bosses and upgrades.

## Getting started

1. Open the Party Arena website, enter your name and create a room.
2. Share the six-character room code with friends. Other players join on their devices.
3. Host selects **Tank Survival Online** and starts when at least two people have joined. **TEST SOLO** lets one person check controls and AI.
4. In Tank mode, everyone fights on the **same map**. New players may join an active game.
5. Host can choose **BACK TO LOBBY** or **PLAY AGAIN** to reset the world.

## Project files

- `server.js`: HTTP server, room membership, global timer and score state, server-sent events.
- `tank-world.js`: authoritative shared-world multiplayer simulation (new).
- `tank-shared.html`: scrolling Tank client inspired by the original tracked tank art, interpolated rendering at browser frame rate, joystick and minimap (new).
- `index.html`: lobby, game selection, shared scoreboard, iframe game container and state relay.
- `classic.html`: original Explore & Earn v21 HTML for Jumping and Space.
- `fishing.html`: original first-person Fishing WebGL HTML.

Run with Node.js 18+ using `node server.js`, then visit http://localhost:3000. No extra npm dependencies are required. Render build command: `npm install`; start command: `node server.js`.

Previously used Render URL: https://party-arena-2.onrender.com/ . Deployment must reach **Live** before changes appear.

**Limitations:** Rooms live in process memory and vanish when the free Render server restarts or sleeps; the server is a single-instance prototype. Movement uses 20-Hz server simulation and 10-Hz snapshots with browser-side interpolation, and may exhibit latency depending on the internet connection. Fishing / Jumping / Space remain local gameplay with shared scores.
