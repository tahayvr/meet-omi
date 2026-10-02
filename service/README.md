# Omi state service

A reference implementation of the [Omi state protocol](../protocol/README.md)
in Node, with no dependencies: one Omi, shared by every app on the machine.

    node service/omi-service.js --pack pack/omi.json      # start it
    node service/omictl.js set thinking                   # change Omi
    node service/omictl.js set success --for 3 --then idle
    node service/omictl.js get
    node service/omictl.js watch                          # print changes

    node examples/terminal/omi-tty.js --follow            # show it; run a
                                                          # few, they move
                                                          # together

- [omi-service.js](omi-service.js): the service. One per user; it refuses to
  start if another is already running, and cleans up a socket left by one
  that crashed.
- [omictl.js](omictl.js): change or read the state from a shell or script.
- [client.js](client.js): `connect()` to change or watch the state from Node,
  and `follow(player)` to keep an Omi player in sync with it.

[`../tools/check-service.js`](../tools/check-service.js) checks all of it
against the protocol, with real sockets and players.

Anything that can open a Unix socket can be a client: write a JSON line,
read JSON lines. To set Omi from a shell without Node:

    echo '{"type":"set","mode":"thinking"}' | nc -U "$XDG_RUNTIME_DIR/omi.sock"
