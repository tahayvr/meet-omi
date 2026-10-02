#!/usr/bin/env node
/* Change or read the shared Omi state from the command line or a script.

     node service/omictl.js set thinking
     node service/omictl.js set success --for 3 --then idle
     node service/omictl.js set error --instant
     node service/omictl.js get
     node service/omictl.js watch          print every change as it happens */
const { connect } = require("./client.js");

const [cmd, mode, ...rest] = process.argv.slice(2),
  opt = (name) => {
    const i = rest.indexOf("--" + name);
    return i >= 0 ? rest[i + 1] : undefined;
  },
  show = (st) =>
    console.log(
      `${st.mode}${st.instant ? " (instant)" : ""}${st.from ? ` from ${st.from}` : ""}, since ${new Date(st.since).toLocaleTimeString()}`,
    ),
  fail = (e) => {
    console.error(
      e.code === "ENOENT" || e.code === "ECONNREFUSED"
        ? "No Omi service is running. Start one: node service/omi-service.js"
        : e.message,
    );
    process.exit(1);
  };

if (cmd === "watch") {
  connect({ name: "omictl watch", onState: show, onError: fail });
} else if (cmd === "get" || cmd === "set") {
  if (cmd === "set" && !mode) fail(new Error("Which mode? omictl set <mode>"));
  const omi = connect({ name: "omictl", onError: () => {} }),
    req =
      cmd === "get"
        ? omi.get()
        : omi.set(mode, {
            ...(rest.includes("--instant") ? { instant: true } : {}),
            ...(opt("for") != null ? { for: +opt("for"), then: opt("then") } : {}),
          });
  req.then(show, fail).finally(() => omi.close());
} else {
  console.log(
    "usage: omictl set <mode> [--instant] [--for <seconds> --then <mode>]\n       omictl get\n       omictl watch",
  );
  process.exit(cmd ? 1 : 0);
}
