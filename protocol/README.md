# Omi state protocol

One Omi, shared by every app on a machine. A small service holds what Omi is
doing; any app or script can change it; every app showing Omi follows along,
in sync. Each app still draws Omi itself, with its own player and the Omi pack
(see [`../pack/README.md`](../pack/README.md)): the service only shares the
state, never pixels.

This file describes protocol version 1. Any language can implement either
side. [`../service`](../service) has a reference service and client in Node.

## The state

The service holds one state:

    { "mode": "thinking", "from": "idle", "since": 1767225600000, "instant": false }

- `mode`: the mode Omi is in, or morphing to. An id from the pack.
- `from`: the mode before it (null at the start).
- `since`: when the change happened, in Unix time milliseconds.
- `instant`: true if Omi jumped instead of morphing.

At the start, the state is the plain logo: mode "mark", from null, instant
true.

Because every change carries `since`, apps don't have to receive it at the
same moment to show the same thing: at any time `now`, the change is
`now - since` milliseconds old, and every app works out the same frame from
that.

## Transport

A stream socket, carrying one JSON object per line (UTF-8, `\n` after each).

- Path: `$OMI_SOCKET` if set, else `$XDG_RUNTIME_DIR/omi.sock`, else
  `omi-<uid>.sock` in the system's temporary directory.
- The socket is the user's own (mode 0600): any of the user's apps may read
  and change the state.

Messages are objects with a `type`. Both sides ignore types and fields they
don't know, so later versions can add to them.

## Messages to the service

`set`: change the state.

    { "type": "set", "mode": "success" }
    { "type": "set", "mode": "error", "instant": true }
    { "type": "set", "mode": "success", "for": 3, "then": "idle" }

- `instant` (optional): jump instead of morphing.
- `for` and `then` (optional, together): after `for` seconds, change to
  `then`, unless something else changed the state first. For short reactions:
  a success, an error, a wink.

Setting the mode Omi is already in doesn't change the state (`since` stays,
so apps showing it don't restart), but its `for`/`then` replaces any pending
one. The service always answers a `set` with a `state` (or an `error`) to the
app that sent it, so a command line tool knows when it is done.

`get`: ask for the state. The service answers with a `state` message.

    { "type": "get" }

`hello` (optional): say who you are, for the service's logs.

    { "type": "hello", "name": "my-app" }

## Messages from the service

`state`: the state, sent when an app connects, to every app after every
change, and in answer to `get` and `set`.

    { "type": "state", "protocol": 1, "mode": "thinking", "from": "idle",
      "since": 1767225600000, "instant": false }

`error`: a message the service could not act on. The state is unchanged.

    { "type": "error", "message": "no mode \"thinkng\"" }

A service that knows the pack rejects modes the pack doesn't have. One that
doesn't accepts any mode id, and players skip ids they don't know.

## Following the state in an app

When a `state` arrives, hand it to the player as a change that happened at
`since`:

- If `instant`, jump to `mode`. Its loops have been running for
  `now - since`.
- Else, morph to `mode` from whatever is on screen, as if the morph started
  at `since`: it is `now - since` along already (it may even have landed,
  and then its loops are that much past landing). The reference player does
  this with `omi.set(mode, { since })`.
- An app that connects while a morph is still running has nothing on screen
  to morph from yet: show `from` at rest first, then morph to `mode` with
  `since`. Its first frames can differ slightly from apps that were already
  watching; from the landing on, they are the same.

Work that out from the clock on every frame, not once and then by counting
frames: an app that stalls for a moment is back in step on its next frame.

All apps share the pack's morph timing, so all land at the same moment and
their loops stay together. For the same reason, apps that want to stay in
sync play at speed 1.

## Notes for service authors

- Keep one state, and send it to every connected app after each change,
  including the app that made it. Answer every `set` and `get` with the
  state, even when nothing changed.
- A `for`/`then` timer belongs to the change that started it: any later
  change cancels it.
- Set `since` from the service's clock when the change arrives, not from the
  message.
- If the socket file exists but nothing answers on it, it is left over from
  a service that stopped: remove it and listen.
