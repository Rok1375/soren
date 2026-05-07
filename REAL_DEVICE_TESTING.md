# Walkie Talking Real-Device Testing

This checklist verifies the parts of Walkie Talking that browser automation cannot fully prove: real microphones, speaker playback, mobile browser behavior, WebRTC connectivity, Wi-Fi/cellular NAT behavior, and TURN readiness.

## Current QA status

- Desktop two-browser audio test: PASS
  - Scenario: Chrome Alpha + Edge Bravo on Channel `272`.
  - Confirmed: both users joined, USERS showed `2`, PTT state changed to `TRANSMITTING` / `RECEIVING`, WebRTC reached `connected`, `audio.play()` succeeded, and real voice audio was heard.

## Test rules

- Use exact numeric string channels only.
- Valid channels are 3 to 6 digits.
- Leading zeros must be preserved.
- `007` is valid.
- `7` is invalid.
- Channel numbers are virtual internet rooms, not real radio frequencies.
- Only one user should transmit at a time.
- When another user is transmitting naturally, listeners should see `RECEIVING`.
- When a user tries to talk over another transmitter, they should briefly see `CHANNEL BUSY`.

## Evidence to capture for every test

Capture these items for each scenario:

- Screenshot of both devices after joining the channel.
- Screenshot of User A transmitting.
- Screenshot of User B receiving.
- Screenshot of User B attempting to transmit over User A, showing `CHANNEL BUSY`.
- Browser console logs from desktop Chrome when available.
- Server logs around join, leave, disconnect, and PTT events if available.
- Notes on browser, device, OS, network type, and channel number.
- Whether audio was heard clearly, delayed, distorted, or not heard.

Recommended note format:

```text
Test scenario:
Date/time:
Build/version/commit:
Device A:
Browser A:
Network A:
Device B:
Browser B:
Network B:
Channel:
Result: PASS / FAIL / PARTIAL
Audio result:
Screenshots captured:
Console/server logs captured:
Notes:
```

---

# 1. Two browser tabs on the same laptop

## Setup steps

1. Start the app locally or open the deployed HTTPS app.
2. Open desktop Chrome.
3. Open Tab A and Tab B.
4. In Tab A, enter username `Laptop Alpha`.
5. In Tab B, enter username `Laptop Bravo`.
6. Allow microphone permission when prompted.
7. Join the same channel in both tabs.

## Channel number to use

Use:

```text
272
```

Also quickly verify:

- `007` joins as `007`.
- `7` is rejected.

## Expected behavior

- Both tabs join Channel `272`.
- Online user count becomes `2` in both tabs.
- Each tab shows the other user in the channel.
- When Tab A holds Push-to-Talk, Tab A shows `TRANSMITTING`.
- Tab B shows `RECEIVING`.
- When Tab B tries to talk while Tab A is transmitting, Tab B briefly shows `CHANNEL BUSY`.
- After Tab A releases, both tabs return to `LISTENING`.
- Leave button removes the user and online count updates.

## Pass

- Presence count is correct.
- PTT state changes are correct.
- `RECEIVING` and `CHANNEL BUSY` are separate.
- Audio is heard from the other tab or the browser clearly shows audio output is active.
- No console errors from app code.

## Fail

- Online count is wrong.
- Both users can transmit at once.
- `RECEIVING` never appears.
- `CHANNEL BUSY` appears without the user trying to interrupt.
- Channel `007` becomes `7`.
- Channel `7` is accepted.
- The app crashes or PTT gets stuck.

## Logs/screenshots to capture

- Screenshot of both tabs showing Channel `272` and `2` users.
- Screenshot of Tab A `TRANSMITTING`.
- Screenshot of Tab B `RECEIVING`.
- Screenshot of Tab B `CHANNEL BUSY` after trying to interrupt.
- Chrome DevTools Console from both tabs.
- Backend logs if running locally.

## If audio does not connect

1. Confirm both tabs have microphone permission.
2. Confirm browser tab audio is not muted.
3. Try headphones to avoid echo cancellation suppressing playback.
4. Refresh both tabs and rejoin Channel `272`.
5. Test in two separate browser windows instead of two tabs.
6. Check Chrome console for WebRTC, autoplay, or permission errors.
7. If state works but audio does not, mark as `PARTIAL` and continue to the two-device tests.

---

# 2. Laptop Chrome + phone on same Wi-Fi

## Setup steps

1. Connect the laptop and phone to the same Wi-Fi network.
2. Open the app in desktop Chrome on the laptop.
3. Open the app in the phone browser.
4. Use HTTPS if testing a deployed app. Local IP testing may require special browser permission handling.
5. Enter username `Laptop Alpha` on the laptop.
6. Enter username `Phone Bravo` on the phone.
7. Allow microphone permission on both devices.
8. Join the same channel.

## Channel number to use

Use:

```text
808
```

## Expected behavior

- Both devices join Channel `808`.
- Online user count is `2`.
- Laptop and phone see each other.
- Laptop PTT transmits to phone.
- Phone PTT transmits to laptop.
- Receiving device shows `RECEIVING`.
- Interrupting device shows `CHANNEL BUSY`.
- Audio should be clear enough to understand speech.

## Pass

- Both directions of audio work.
- PTT lock works.
- Status labels match the real action.
- Leaving on one device updates the count on the other.
- No visible layout break on phone.

## Fail

- One device never appears online.
- Audio only works in one direction.
- Phone cannot start mic capture.
- PTT remains stuck after release.
- Phone UI overflows or the PTT button is hard to use.

## Logs/screenshots to capture

- Laptop screenshot showing Channel `808` and `2` users.
- Phone screenshot showing Channel `808` and `2` users.
- Screenshot/video of laptop transmitting and phone receiving.
- Screenshot/video of phone transmitting and laptop receiving.
- Chrome desktop console logs.
- Phone browser console if available through remote debugging.

## If audio does not connect

1. Verify both devices are on the same Wi-Fi.
2. Confirm the app is served over HTTPS, or that local testing permissions allow microphone access.
3. Toggle mute off on both devices.
4. Leave and rejoin from both devices.
5. Refresh both browsers.
6. Try Chrome on the phone if Safari/other browser fails.
7. Check whether peer status is stuck at `CONNECTING`, moves to `FAILED`, or shows `AUDIO LINKED` with no sound.
8. If same-Wi-Fi fails consistently, capture logs before moving to cellular tests.

---

# 3. Laptop Wi-Fi + phone cellular

## Setup steps

1. Connect the laptop to Wi-Fi.
2. Disable Wi-Fi on the phone so the phone uses cellular data.
3. Open the deployed HTTPS app on both devices.
4. Enter username `WiFi Alpha` on the laptop.
5. Enter username `Cell Bravo` on the phone.
6. Allow microphone permission on both devices.
7. Join the same channel.

## Channel number to use

Use:

```text
909
```

## Expected behavior

- Both devices join Channel `909` over the internet.
- Online user count is `2`.
- Laptop can transmit to phone.
- Phone can transmit to laptop.
- Receiving device shows `RECEIVING`.
- Trying to interrupt shows `CHANNEL BUSY`.

## Pass

- Presence works across Wi-Fi and cellular.
- Audio works both directions.
- PTT lock remains reliable.
- Peer status becomes `AUDIO LINKED` or otherwise indicates a successful connection.

## Fail

- Users can join but audio never connects.
- Peer status stays `CONNECTING` indefinitely.
- Peer status becomes `FAILED`.
- Audio works on Wi-Fi tests but fails on cellular.
- Significant audio delay or dropouts make conversation unusable.

## Logs/screenshots to capture

- Screenshots of both devices in Channel `909`.
- Screenshot of `RECEIVING` on the opposite device.
- Screenshot of `CHANNEL BUSY` when interrupting.
- Desktop Chrome console logs.
- Server logs around signaling events.
- Note the phone carrier and signal strength.

## If audio does not connect

1. Retry once after refreshing both devices.
2. Try switching which device joins first.
3. Try a different cellular location or stronger signal.
4. Confirm the signaling server is public HTTPS and reachable from cellular.
5. Check if WebRTC peer status stays `CONNECTING` or becomes `FAILED`.
6. If STUN-only is being used, mark this as likely NAT/cellular traversal failure.
7. Configure TURN credentials and repeat this test.

---

# 4. iPhone Safari + desktop Chrome

## Setup steps

1. Use an iPhone with Safari.
2. Use desktop Chrome on laptop/desktop.
3. Prefer the deployed HTTPS app.
4. Put both devices on the same Wi-Fi for the first pass.
5. Enter username `Safari Alpha` on iPhone.
6. Enter username `Chrome Bravo` on desktop.
7. Allow microphone permission on both devices.
8. Join the same channel.

## Channel number to use

Use:

```text
515
```

## Expected behavior

- iPhone Safari and desktop Chrome both join Channel `515`.
- Online user count is `2`.
- Safari can receive desktop audio.
- Desktop can receive Safari audio.
- PTT touch behavior on iPhone feels responsive.
- Safari does not block audio playback after a user gesture.

## Pass

- Two-way audio works.
- iPhone PTT starts on touch down and stops on release.
- No stuck transmitting state.
- `RECEIVING` and `CHANNEL BUSY` display correctly.
- Layout fits iPhone screen without horizontal scroll.

## Fail

- Safari blocks microphone permission.
- Safari captures mic but cannot play remote audio.
- PTT does not release properly on touch.
- Audio starts only after repeated taps with no clear user feedback.
- The UI is clipped by the Safari address bar or safe area.

## Logs/screenshots to capture

- iPhone screenshot of joined channel.
- iPhone screenshot of `RECEIVING`.
- Desktop screenshot of Chrome receiving Safari audio.
- Desktop Chrome console logs.
- iPhone Safari Web Inspector logs if available.
- Short screen recording if PTT touch behavior is inconsistent.

## If audio does not connect

1. Tap the iPhone page once, then retry PTT. Safari may require a user gesture for audio playback.
2. Confirm iPhone microphone permission in iOS Settings > Safari or site settings.
3. Turn off Silent Mode only if speaker output seems muted.
4. Try headphones.
5. Refresh Safari and rejoin.
6. If same-Wi-Fi Safari fails but Chrome-to-Chrome works, treat it as an iOS Safari compatibility issue and capture Web Inspector logs.
7. If same-Wi-Fi works but cellular fails, repeat with TURN enabled.

---

# 5. Android Chrome + desktop Chrome

## Setup steps

1. Use an Android phone with Chrome.
2. Use desktop Chrome on laptop/desktop.
3. Start on the same Wi-Fi network.
4. Open the deployed HTTPS app on both devices.
5. Enter username `Android Alpha` on phone.
6. Enter username `Desktop Bravo` on desktop.
7. Allow microphone permission on both devices.
8. Join the same channel.

## Channel number to use

Use:

```text
616
```

## Expected behavior

- Android Chrome and desktop Chrome both join Channel `616`.
- Online user count is `2`.
- Android can transmit and receive.
- Desktop can transmit and receive.
- Android touch PTT is responsive.
- No accidental long-press menu appears on the PTT button.

## Pass

- Two-way audio works.
- PTT starts and stops reliably on touch.
- `RECEIVING` appears naturally when the other user talks.
- `CHANNEL BUSY` appears only after trying to interrupt.
- Peer status reaches `AUDIO LINKED` or otherwise indicates connection success.

## Fail

- Android microphone prompt does not appear.
- PTT creates a long-press menu or selection behavior.
- Audio fails in one direction.
- Peer status remains `CONNECTING` or becomes `FAILED`.
- Layout breaks on Android viewport.

## Logs/screenshots to capture

- Android screenshot of Channel `616`.
- Android screenshot while receiving.
- Desktop screenshot while receiving Android audio.
- Desktop Chrome console logs.
- Android remote debugging console logs if available through `chrome://inspect`.
- Note Android model, OS version, and Chrome version.

## If audio does not connect

1. Confirm Android Chrome microphone permission.
2. Check Android system audio output and volume.
3. Try disabling Bluetooth devices if audio routes incorrectly.
4. Refresh both devices and rejoin.
5. Test phone-to-desktop and desktop-to-phone separately.
6. Use Android remote debugging to check WebRTC/permission errors.
7. If Wi-Fi works but cellular fails, repeat with TURN enabled.

---

# 6. Two phones on cellular

## Setup steps

1. Use two phones.
2. Turn Wi-Fi off on both phones.
3. Confirm both phones are using cellular data.
4. Open the deployed HTTPS app on both phones.
5. Enter username `Cell Alpha` on Phone A.
6. Enter username `Cell Bravo` on Phone B.
7. Allow microphone permission on both phones.
8. Join the same channel.

## Channel number to use

Use:

```text
777
```

## Expected behavior

- Both phones join Channel `777` from cellular data.
- Online user count is `2`.
- Phone A can transmit to Phone B.
- Phone B can transmit to Phone A.
- PTT lock prevents simultaneous talking.
- Audio remains usable under normal cellular conditions.

## Pass

- Two-way audio works on cellular.
- PTT lock works.
- `RECEIVING` and `CHANNEL BUSY` are correct.
- Releasing PTT reliably returns to `LISTENING`.
- Leave/rejoin works without ghost users.

## Fail

- Users can join but never hear audio.
- One carrier works and the other does not.
- Peer status stays `CONNECTING` or becomes `FAILED`.
- Audio delay/dropouts make PTT unusable.
- App disconnects or ghosts users after refresh/leave.

## Logs/screenshots to capture

- Screenshot from both phones showing Channel `777` and `2` users.
- Screenshot from receiving phone during Phone A transmission.
- Screenshot from receiving phone during Phone B transmission.
- Screenshot of `CHANNEL BUSY` after an interrupt attempt.
- Carrier names and signal quality for both phones.
- Any server logs during the test window.
- Screen recordings if audio connects intermittently.

## If audio does not connect

1. Retry after refreshing both phones.
2. Try reversing join order.
3. Try a different channel such as `778` to rule out stale room state.
4. Test each phone against desktop Chrome to isolate which device/network fails.
5. If using STUN only, assume TURN may be required.
6. Configure TURN and repeat the same test.
7. If TURN is enabled and audio still fails, capture server logs, device/browser versions, peer status, and cellular carrier details.

---

# TURN SERVER DECISION

## STUN is enough for early testing

STUN is useful for early development and friendly network conditions. It helps peers discover their public network addresses and can work well for:

- two tabs on the same laptop
- two devices on the same Wi-Fi
- some home Wi-Fi to cellular tests
- quick MVP demos

The app now supports STUN by default with:

```env
VITE_STUN_URL=stun:stun.l.google.com:19302
```

This is enough to begin real-device QA, but it is not enough to guarantee reliable production audio.

## TURN is required for reliable cellular and strict-network use

TURN relays media through a server when direct peer-to-peer WebRTC cannot connect. TURN becomes important for:

- cellular networks
- carrier-grade NAT
- corporate Wi-Fi
- school/public Wi-Fi
- strict firewalls
- users on different network types
- production reliability expectations

If the app works on same Wi-Fi but fails on cellular, TURN should be the next production requirement, not a UI rewrite.

## Do not treat long-lived TURN credentials like normal frontend config

The current frontend env variables are acceptable for local development and controlled testing:

```env
VITE_TURN_URL=
VITE_TURN_USERNAME=
VITE_TURN_CREDENTIAL=
```

However, any `VITE_` variable is bundled into frontend code and can be inspected by users. That means long-lived TURN credentials in frontend config should be considered exposed.

For production, avoid shipping permanent TURN usernames/passwords directly in the frontend bundle.

## Production recommendation: backend-generated short-lived TURN credentials

For production, use backend-generated short-lived TURN credentials.

Recommended flow:

1. User opens the app.
2. Frontend requests temporary ICE credentials from your backend.
3. Backend generates short-lived TURN credentials using your TURN provider or shared secret.
4. Frontend uses those temporary credentials to create WebRTC peer connections.
5. Credentials expire automatically after a short time window.

This keeps TURN abuse lower-risk and makes it easier to rotate credentials without redeploying the frontend.

Recommended production standard:

- STUN in frontend config is fine.
- TURN URL may be public.
- TURN credentials should be short-lived.
- Long-lived TURN secrets should stay backend-only.
- Add rate limiting if the backend exposes an endpoint for ICE credentials.

---

# Final testing order recommendation

Run tests in this order:

1. Two browser tabs on the same laptop.
2. Laptop Chrome + phone on same Wi-Fi.
3. iPhone Safari + desktop Chrome.
4. Android Chrome + desktop Chrome.
5. Laptop Wi-Fi + phone cellular.
6. Two phones on cellular.

This order separates simple app-state bugs from true network traversal problems. If tests 1–4 pass but tests 5–6 fail, prioritize TURN setup before changing application logic.
