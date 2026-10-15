# Party Arena — Neon Rumble (2D Multiplayer)

A polished real-time browser arena for **2–8 players**. This edition replaces every quiz, trivia question, and pattern puzzle with shared top-down 2D action.

## Live game
Render deployment: https://party-arena-2.onrender.com/

If your Render service uses another hostname, open its URL in the Render dashboard.

## How to play

1. Open the same website on each device.
2. The host creates a room; other players join using its six-character code.
3. When 2–8 players have joined, the host clicks **Start Match**.
4. After a four-second countdown, players compete in a 150-second arena match.
5. Earn **100 points per elimination** and **10 points per successful hit**. Collect power-ups and use cover.
6. The highest score wins. The host can start a rematch or return everyone to the lobby.

### Controls
**Desktop:** WASD or arrow keys to move; mouse to aim; hold left-click or Space to fire; Shift / E to dash.

**Mobile:** On-screen movement joystick, FIRE (auto-aim at nearest opponent), and DASH.

### Power-ups
- Green: restore health
- Cyan: temporary protective shield
- Violet: temporary speed boost

Eliminated players respawn after a short delay. New joiners during a match wait as spectators until the next match.

## Running locally

Requires Node.js 18 or newer.

```bash
node server.js
```

Open http://localhost:3000.

## Deploying on Render

- Service type: **Web Service**
- Runtime: **Node**
- Build command: `npm install`
- Start command: `node server.js`
- Publish on the `main` branch

No external npm dependencies are required.

The server handles player movement, collision, projectiles, hit detection, power-ups, respawns, rounds and scores. Browsers receive live snapshots using Server-Sent Events (SSE) and send controls via HTTP API.

## Limitations

Rooms and scores currently live in server memory; a Render free-tier restart will clear active rooms. Revisit the page to create a new room. No account system or persistent matchmaking is implemented yet. A stable Render deployment needs persistent storage to preserve rooms across restarts.
