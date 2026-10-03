# Omi in Omarchy

Omi is the Omarchy logo, brought to life. This guide is for anyone building
Omi into something that runs in Omarchy, most often an Omarchy shell plugin
(Quickshell, Qt 6). It covers getting Omi on screen, choosing what Omi shows,
and keeping it in step with the rest of the system.

## Add Omi to a shell plugin

Copy three files into your plugin:

- `examples/omarchy/Omi.qml`: the Omi item.
- `pack/omi.js`: the player.
- `pack/omi.json`: every mode, animation and morph setting.

Then use the item:

```qml
import qs.Commons

Omi {
    width: 96
    height: 96
    color: Color.accent   // follows the theme, live, even mid-animation
    mode: "idle"          // change it and Omi morphs there
}
```

- **Color.** Omi is one color, by design. Bind it to `Color.accent` from
  `qs.Commons`, so it changes with the theme like the rest of the shell.
- **Size.** Omi stays crisp at any size and scale: its pieces are snapped to
  device pixels. Below about 40 px the face gets hard to read.
- **Cost.** Omi only animates while its window is on screen. Hidden, it costs
  nothing.
- **Calmer motion.** In small places, such as next to a title or in the bar,
  set `bodyMotion: false` to keep the face's motion and drop the whole-body
  bobs and hops. `animate: false` shows each mode at rest.

`examples/omarchy` is a working plugin built this way. Install it with
`examples/omarchy/install.sh` and try every mode with ← and →.

## Choose what Omi shows

Omi has two layers:

- **`mode` is what's going on.** Set it from your app's state, and leave it
  there as long as that state lasts: checking for updates, offline, waiting
  for a key press.
- **`react(mode)` is something that just happened.** It plays a mode for a
  moment, 1.4 s by default, then goes back to `mode`. Use it for events: a
  step done, a file saved, a command failed.

So that Omi means the same thing in every Omarchy app, use the same modes for
the same situations:

| Situation | Omi |
|---|---|
| Nothing going on | `idle` |
| Checking, loading, waiting on the network | `thinking` |
| Downloading or installing | `updating` |
| Busy doing it for the user | `working` |
| Offline | `offline-searching` |
| Waiting for the user to press a key | `listening` |
| About to ask for a password | `sudo` |
| Paused, or put off until later | `sleeping` |
| Done (reaction) | `success` |
| Failed (reaction, or the mode while it stays failed) | `error` |
| Not sure what happened | `confused` |
| A real milestone, like finishing setup | `party` |

Some rules of thumb:

- **React to what the user did, not to everything.** A reaction on every
  event turns Omi into noise.
- **Never guilt the user.** No `sad` or `crying` when someone cancels, skips
  or closes something. Leave Omi as it is.
- **Keep reactions short** where the user is concentrating, such as while
  learning a shortcut.
- **Show the plain logo when Omi is just a brand mark.** `mark` is the
  logo with nothing in the middle, and it morphs into any mode, which makes a
  good entrance: start at `mark`, then set `idle`.

## One Omi for the whole machine

When several apps show Omi at once, they can share one state so they move
together: see the [Omi state protocol](../protocol/README.md). An app sets
the mode over a socket; every app showing Omi follows with its own player. In
Omarchy this is not wired up yet. Until it is, each plugin owns its Omi.

## Writing JavaScript that runs in the shell

The shell runs Qt 6's JavaScript engine, which is behind Node and browsers.
It has no object spread (`{ ...o }`), `Object.fromEntries`,
`Array.prototype.flat`, `flatMap` or `at`, or `String.prototype.replaceAll`.
Use `Object.assign`, loops and `concat` instead. Array spread (`[...a]`),
arrow functions, classes, `?.` and `??` all work.

The player is held to this:

- `node tools/check-player.js` runs the conformance checks in Node, again
  without those built-ins, and fails on object spread in the source.
- `node tools/check-quickshell.js` runs the same checks inside Quickshell
  itself (in a Wayland session).
