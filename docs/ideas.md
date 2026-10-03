# Ideas for Omi

New modes, reactions and behaviour that came up while building Omi into
Omarchy apps. Each says where it came from, so it can be judged against a
real use. Move an idea to the jig when it's picked up, and mark it in the
pack once it ships there.

Status: **idea** (written down), **designing** (in the jig), **in pack**
(in pack/omi.json).

## Modes

| Idea | What Omi does | Came from | Status |
|---|---|---|---|
| Hello | A greeting as `mark` comes to life on first boot. Design: a head tilt with the eyes alone, one up a cell and the other down, swap, level, then a quick blink. (A hand waving beside the frame was tried first and didn't belong: nothing else on Omi is a limb.) Kind: reaction, hold 1.6. | Onboarding: the welcome page | in pack |
| Pointing | Omi looks or points in a direction: up, down, left, right. Draws the eye to something on screen, such as the workspace numbers in the bar or a window that just opened. | Onboarding: teaching where things are | looking: in the pack (gaze, `look()`); pointing with a limb: idea |
| Pressing a key | Omi presses down, as if on a key, while waiting for a shortcut. Between `listening` and `typing`. | Onboarding: "press Super + Space" | idea |
| Night | Omi with dimmed eyes, calm, when the night light turns on. Close to `sleeping`, but awake. | Onboarding: the display step | idea |
| Asking | Omi waiting for the user to decide: an agent wants approval, a dialog needs an answer. `sudo` is for passwords and `listening` for a key; this is a question. Design: the idle eyes with one brow piece raised (20 × 20 above the right eye, y 80), and a 20-unit "?" of extra pieces drawn above the frame (x 230..270, y −60..0) that pulses `op` 0.6..1 every 1.6 s. The eyes alternate between the question mark and ahead with `look`-style keys every 3 s. Kind: state. | Omarchy agents and confirm dialogs | in pack |
| Attention | A short ping: a notification arrived, a background job finished, something wants a look. Design: idle, with one 20 × 20 extra piece at the frame's top-right corner (x 300, y −20) that pops in with `sx`/`sy` 0→1.4→1 over 0.5 s and rings outward as two 60 × 60 outlines (`op` 1→0, `sx`/`sy` 1→2) staggered 0.2 s. No body motion, so it works at bar size. Kind: reaction, hold 1.2. | Notifications, finished updates | in pack |
| Recording | Omarchy is sharing the screen or recording. A trust signal: shown as long as it lasts. Design: idle eyes at rest with a 20 × 20 extra piece inside the frame at the top-left (x 60, y 60) that blinks `op` 1→0.2→1 every 1.6 s with "steps" easing, like a camera light. Nothing else moves. Kind: state. | Screen share, omarchy-cmd-screenrecord | in pack |
| Goodbye | Logout, shutdown and reboot, so the day ends the way it started. Design: one head tilt, level again, then the eyes close and stay closed; the host morphs to `mark` after it. Kind: reaction, hold 1.4. | The power menu | in pack |
| Nod | Yes: a quick agreement, lighter than `success`. Design: the idle eyes `ty` 0→6→0→6→0 over 0.7 s, the frame still. Kind: reaction, hold 0.9. Covers the "Got it" idea below. | Drills with several sub-tasks, agent confirmations | in pack |
| Shake | No: the gentle no that `error` is too strong for. Design: the idle eyes `tx` 0→−6→6→−6→0 over 0.7 s, the frame still, no sad brows. Kind: reaction, hold 0.9. | A refused action, a wrong key in a drill | in pack |

## Reactions

| Idea | What Omi does | Came from | Status |
|---|---|---|---|
| Got it | A small nod, quicker than `success`, for each correct key press in a row of them. `success` for every press is too much. | Onboarding: drills with several sub-tasks | see Nod, above |
| New colors | When the theme changes, the new accent sweeps across Omi from the face outwards, instead of every piece switching at once. Needs a player change: a color transition, since Omi is one color. | Onboarding: the theme step | done, in the hosts: Omi.qml fades a new color in (`colorFade`, 350 ms) and the web example transitions the canvas's color. A sweep from the face would need the player to color pieces one by one, and the whole point of Omi is one color, so it stays a fade. |
| Mind blown, once | `mind-blown` the first time someone sees something tile or move by itself, never again after. Behaviour, not a mode: a note for app authors. | Onboarding: the tiling drill | idea |

## The format

| Idea | Why | Came from | Status |
|---|---|---|---|
| Reactions in the pack | Each mode could say whether it's a reaction and for how long it plays, so every app reacts for the same time and returns the same way. Today each app picks (Omi.qml uses 1.4 s). | Building Omi.qml's `react()` | in pack: `kind` and `hold` on each mode, `hold(mode)` in the player |
| Families | Modes that mean the same thing (six thinkings, two offlines) grouped, so an app picks one per situation and the rest are variations. | Reviewing the 42 modes for apps | in pack: `family`, and `easter` on the jokes |
| Eyes inside the logo | Wide eyes (success, error) reach the frame at a full look; apps had to cap their looks. The pack says where the eyes may go and the player keeps them there. | Onboarding capping diagonals at 0.6 | in pack: `gaze.inside` |
| A player in another language | The only proof the pack is a contract is a player that never read omi.js. | Reviewing the examples | done: player/rust, and the 14 gaps it found in the README are fixed |
