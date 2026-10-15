# Party Arena — local multiplayer prototype

## Requirements
- Node.js 18 or newer. No npm dependencies or package installation needed.

## Run
1. Extract the ZIP file.
2. Open a terminal in the `party-arena` folder.
3. Run `node server.js` (or `npm start`).
4. Open **http://localhost:3000** on the same computer.
5. Open a second browser/incognito window to join with a room code and test 2 players.

## Playing on multiple devices
All devices must be on the same Wi-Fi network. Find the computer's LAN IPv4 address, for example `192.168.1.25`, and visit `http://192.168.1.25:3000` on the other devices. Your firewall may ask you to allow Node.js connections. `localhost` only works on the host computer. To play across the internet, deploy the Node.js server to a hosting provider with a public HTTPS address.

## Features
- 2–8 players, 6-character room codes, 6 rounds, live leaderboard
- Trivia Blitz, Memory Flash, Quick Guess, Pattern Dash
- 30-second rounds, 3-second countdown, 8-second results
- Up to 150 points per round, 900 total
- Server authoritative timers and scoring
- Late joins as spectators; reconnect using the same browser/session
- Host reassignment when host disconnects; rematches

## Prototype limitations
- Rooms and scores are in memory: server restart clears them.
- Reconnection is best effort; closed tabs can reconnect with the browser's saved token.
- No public hosting, user accounts, chat, matchmaking, or moderation dashboard.
- Sudden-death tie breaker resolves closest answer; exact ties share victory in this prototype.
