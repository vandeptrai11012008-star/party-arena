# Party Arena — Four Worlds (2–8 Players)

Four playable minigames, selected by the room host from a shared lobby:

1. **Tank Survival (2D):** Original-style tracked tanks based on the Explore & Earn v21 HTML model. Drive, aim the rotating cannon, shoot scout/standard/heavy enemy tanks, dodge red shells, use repair/speed/shield pickups, destroy crates/barrels, and ricochet shells off steel. Enemy waves increase every 30 seconds (up to wave 5). The whole battle can be played in fullscreen (F key).
2. **Fishing 3D (first person):** The first-person WebGL lake experience from the original fishing prototype. Aim, cast, wait for a bite and reel using Space while managing line tension. Each successful catch awards room points. Everyone fishes in their own first-person lake view with a shared scoreboard, not a synchronized 3D world.
3. **Skybound Jumping (2D):** Jump across platforms, collect stars and reach the finish flag for lap points. A/D and Space (or mobile move and JUMP).
4. **Space Evolution (2D):** Fly around a star field, avoid asteroids, collect boosts and shoot asteroids for points.

## Live page

Render URL previously configured: https://party-arena-2.onrender.com/ (verify service URL and latest deployment in the Render dashboard).

## How to play

- Host creates a private room with a six-character code.
- Other friends join from their own browsers (up to 8 players).
- Host selects one of the four games from the **CHOOSE YOUR WORLD** cards.
- With two or more players, press **START MATCH**. To test alone, press **TEST SOLO**.
- Match length varies with mode (120–150 seconds). Host can replay or go back to lobby.
- Scoreboard and game rules are synchronized by the server. Fishing uses a first-person local simulation and reports catches to the room server with a minimum 6-second claim cooldown.
- Sound is opt-in: press **MUSIC ON** for a low-volume, original procedural synth loop. No licensed music is included.

## Development

Pure Node.js server (no npm dependencies):

```bash
node server.js
```

Open http://localhost:3000, then join with another tab or device.

Files: `server.js` handles room codes, movement, match timing and scoring; `index.html` contains the lobby and 2D Canvas games; `fishing.html` contains the original first-person WebGL fishing experience, integrated into the match as an iframe.

Tank controls: **WASD / arrows** to drive, **mouse** to aim, **hold left-click / Space** to fire, **Shift** to dash, **F** to toggle fullscreen. On mobile, use virtual movement / FIRE with auto-aim at enemy tanks.

## Free Render deployment

Runtime: Node, Build: `npm install`, Start: `node server.js`. Rooms and scores are stored in server memory only. They disappear when the server restarts or the Render free instance sleeps. This project is a functional prototype, not a production-grade scalable multiplayer service; players should expect some network delay.
