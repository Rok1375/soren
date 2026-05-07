# Walkie Talking

A mobile-first internet walkie-talkie MVP. Users enter a username and virtual channel number, then communicate live with other users in the same channel via WebRTC audio. Socket.io handles presence, WebRTC signaling, and the push-to-talk channel lock so only one user transmits at a time.

## Stack

- React + Vite frontend
- Tailwind CSS tactical UI
- Node.js + Express backend
- Socket.io realtime rooms/signaling
- WebRTC peer-to-peer audio

## Project structure

```txt
walkie-talking/
  client/   React + Vite frontend
  server/   Express + Socket.io signaling server
```

## Run locally

```bash
npm install
npm run dev
```

Local URLs:

- Client: http://localhost:5173
- Server: http://localhost:3001
- Server health: http://localhost:3001/health

Local development works without a `.env` file because the client falls back to `http://localhost:3001` and the server allows `http://localhost:5173` / `http://127.0.0.1:5173` by default.

Open two browser windows, enter different usernames, join the same channel number, allow microphone access, then hold the Push-to-Talk button on one browser.

## Environment variables

### Frontend: `client/.env`

```bash
VITE_SIGNALING_URL=http://localhost:3001
VITE_STUN_URL=stun:stun.l.google.com:19302
VITE_TURN_URL=
VITE_TURN_USERNAME=
VITE_TURN_CREDENTIAL=
```

Production example for Vercel:

```bash
VITE_SIGNALING_URL=https://your-backend-url.onrender.com
```

### Backend: `server/.env`

```bash
PORT=3001
CLIENT_ORIGIN=http://localhost:5173
```

Production example for Render/Railway:

```bash
CLIENT_ORIGIN=https://your-frontend-url.vercel.app
PORT=3001
```

`CLIENT_ORIGIN` must be the exact frontend origin, with no trailing slash. Multiple origins can be comma-separated when needed:

```bash
CLIENT_ORIGIN=https://your-frontend-url.vercel.app,http://localhost:5173
```

## Deploy backend signaling server

Deploy the backend first so you have the public HTTPS signaling URL before configuring Vercel.

### Option A: Render

1. Push this repo to GitHub.
2. In Render, create a new Web Service.
3. Connect the GitHub repo.
4. Use these settings:
   - Root Directory: `server`
   - Runtime: Node
   - Build Command: `npm install`
   - Start Command: `npm start`
5. Add environment variables:
   - `CLIENT_ORIGIN=https://your-frontend-url.vercel.app`
   - `PORT=3001` if Render does not inject one automatically
6. Deploy.
7. Copy the Render service URL, for example:
   - `https://your-backend-url.onrender.com`
8. Test health in the browser:
   - `https://your-backend-url.onrender.com/health`

Important: after the Vercel frontend URL exists, come back to Render and replace `CLIENT_ORIGIN` with the real Vercel URL.

### Option B: Railway

1. Push this repo to GitHub.
2. In Railway, create a new project from the GitHub repo.
3. Select the backend service/root:
   - Root Directory: `server`
4. Use:
   - Install Command: `npm install`
   - Start Command: `npm start`
5. Add environment variables:
   - `CLIENT_ORIGIN=https://your-frontend-url.vercel.app`
   - `PORT=3001` if Railway does not inject one automatically
6. Generate or copy the public Railway domain, for example:
   - `https://your-backend-url.up.railway.app`
7. Test health:
   - `https://your-backend-url.up.railway.app/health`

Important: after the Vercel frontend URL exists, come back to Railway and replace `CLIENT_ORIGIN` with the real Vercel URL.

## Deploy frontend on Vercel

1. Push this repo to GitHub.
2. In Vercel, import the GitHub repo.
3. Use these settings:
   - Framework Preset: Vite
   - Root Directory: `client`
   - Build Command: `npm run build`
   - Output Directory: `dist`
   - Install Command: `npm install`
4. Add environment variable:
   - `VITE_SIGNALING_URL=https://your-backend-url.onrender.com`
   - or, for Railway: `VITE_SIGNALING_URL=https://your-backend-url.up.railway.app`
5. Deploy.
6. Copy the deployed frontend URL, for example:
   - `https://your-frontend-url.vercel.app`
7. Go back to the backend host and set:
   - `CLIENT_ORIGIN=https://your-frontend-url.vercel.app`
8. Redeploy/restart the backend after changing `CLIENT_ORIGIN`.
9. Redeploy the frontend if you changed `VITE_SIGNALING_URL` after the first build.

## Exact deployment URL paste map

Paste the backend URL into Vercel:

```bash
VITE_SIGNALING_URL=https://your-backend-url.onrender.com
```

Paste the frontend URL into Render/Railway:

```bash
CLIENT_ORIGIN=https://your-frontend-url.vercel.app
```

Use the deployed frontend URL as the public app link for laptop and phones:

```txt
https://your-frontend-url.vercel.app
```

Do not paste the frontend URL into `VITE_SIGNALING_URL`. Do not paste the backend URL into `CLIENT_ORIGIN`.

## Channel rules

- Channel number is a virtual internet room ID, not a real radio frequency.
- Channels are exact numeric strings: 3–6 digits, leading zeros preserved (`007` stays `007`).
- `007` and `7` are not the same channel; `7` is invalid.
- Public-style channels are typically `100–999`; private-style channels can use `000000–999999`.
- Users can be on Wi-Fi or cellular data anywhere as long as they can reach the signaling server.
- Push-to-talk locks the channel for one transmitter.
- Other users see `RECEIVING` when someone is transmitting.
- If a user tries to transmit over someone else, they briefly see `CHANNEL BUSY`.
- Start/end beeps and subtle generated static make the interaction feel like a real radio.

## Host, lock, and group-size rules

- Host ownership is temporary per live channel session only. There are no accounts, login, or saved host permissions.
- The first user to join an empty channel becomes the channel host.
- The host is marked with a `HOST` badge in the room UI.
- Only the host can lock or unlock the channel.
- A locked channel blocks new joins and returns `CHANNEL_LOCKED` to the joining client.
- Existing users stay inside and can keep using Push-to-Talk after the host locks the channel.
- If the host leaves or disconnects, host ownership transfers to the next oldest connected user in that channel.
- If everyone leaves, the in-memory channel state is deleted.
- There is no artificial hard user limit in this MVP; the app does not block users just because the room is large.
- Recommended MVP group size: up to 8 users for best audio performance because the current architecture uses peer-to-peer WebRTC.
- Larger future rooms may require an SFU/media-server architecture instead of every user connecting directly to every other user.

## WebRTC network note

WebRTC microphone access requires HTTPS in production. The Vercel frontend URL is HTTPS, so phones can request microphone access through the deployed app link.

STUN is enabled by default through `VITE_STUN_URL`. Do not add TURN yet unless real-device tests show that Wi-Fi/cellular or strict NAT connections fail. For reliable audio across cellular data, strict NAT, carrier-grade NAT, and corporate Wi-Fi, TURN may be needed later:

```bash
VITE_STUN_URL=stun:stun.l.google.com:19302
VITE_TURN_URL=turn:your-turn-server.example.com:3478
VITE_TURN_USERNAME=your-turn-username
VITE_TURN_CREDENTIAL=your-turn-credential
```

Multiple STUN or TURN URLs can be comma-separated.

## Real-device QA checklist

After deployment, test in this order:

1. Laptop Chrome + phone on same Wi-Fi using the Vercel HTTPS link.
2. iPhone Safari + desktop Chrome using the Vercel HTTPS link.
3. Android Chrome + desktop Chrome using the Vercel HTTPS link.
4. Laptop Wi-Fi + phone cellular using the Vercel HTTPS link.
5. Two phones on cellular using the Vercel HTTPS link.
6. Denied mic permission.
7. Refresh while in channel.
8. Leave and rejoin.
9. Rapid push-to-talk press/release.

For every device test, confirm:

- Both devices open the same HTTPS frontend URL.
- Both devices allow microphone permission.
- Both users join the same valid 3–6 digit channel.
- `USERS` shows `2`.
- Sender shows `TRANSMITTING`.
- Listener shows `RECEIVING`.
- Interrupt attempt shows `CHANNEL BUSY`.
- Audio works both directions.
- Peer status reaches `AUDIO LINKED` / connected.

For cellular tests, if users join but WebRTC stays `CONNECTING` or `FAILED`, suspect NAT/TURN before changing app logic.
