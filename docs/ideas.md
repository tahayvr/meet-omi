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
| Hello | Omi waves, or the frame opens like a greeting, once. The first thing a new user sees on first boot, as `mark` comes to life. | Onboarding: the welcome page | idea |
| Pointing | Omi looks or points in a direction: up, down, left, right. Draws the eye to something on screen, such as the workspace numbers in the bar or a window that just opened. One mode per direction, or one mode with a direction. | Onboarding: teaching where things are | idea |
| Pressing a key | Omi presses down, as if on a key, while waiting for a shortcut. Between `listening` and `typing`. | Onboarding: "press Super + Space" | idea |
| Night | Omi with dimmed eyes, calm, when the night light turns on. Close to `sleeping`, but awake. | Onboarding: the display step | idea |

## Reactions

| Idea | What Omi does | Came from | Status |
|---|---|---|---|
| Got it | A small nod, quicker than `success`, for each correct key press in a row of them. `success` for every press is too much. | Onboarding: drills with several sub-tasks | idea |
| New colors | When the theme changes, the new accent sweeps across Omi from the face outwards, instead of every piece switching at once. Needs a player change: a color transition, since Omi is one color. | Onboarding: the theme step | idea |
| Mind blown, once | `mind-blown` the first time someone sees something tile or move by itself, never again after. Behaviour, not a mode: a note for app authors. | Onboarding: the tiling drill | idea |

## The format

| Idea | Why | Came from | Status |
|---|---|---|---|
| Reactions in the pack | Each mode could say whether it's a reaction and for how long it plays, so every app reacts for the same time and returns the same way. Today each app picks (Omi.qml uses 1.4 s). | Building Omi.qml's `react()` | idea |
