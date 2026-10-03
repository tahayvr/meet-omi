# Every Omi mode

Omi has 42 modes, each a set of rectangles with a looping
animation, and it morphs from any one to any other. This page is made by
`node tools/modes-doc.js` from the pack, so it always matches
`pack/omi.json`; the stills are each mode at rest (time 0 of its loops),
drawn by the reference player.

![Every mode](modes/sheet.svg)

- **state or reaction** is what the mode is for (`kind` in the pack). A
  state stays as long as what it stands for lasts. A reaction is shown for
  its hold after its morph lands, then Omi goes back: `react("success")`
  in Omi.qml, or `omi.hold(mode)` in your own host.
- **loop** is how long the mode takes to play every piece's loop once
  (`loopSeconds`): show a mode at least that long in a tour.
- A **family** groups modes that mean the same thing: pick one per
  situation and treat the rest as variations. **Easter eggs** are jokes;
  leave them out of anything generic.
- "Use it for" is advice for app authors; [docs/omarchy.md](omarchy.md)
  has the rules of thumb behind it (react to what the user did, never
  guilt the user, keep reactions short while they concentrate).

| | id | Name | Kind | Loop | Use it for |
| --- | --- | --- | --- | --- | --- |
| ![The mark](modes/mark.svg) | `mark` | The mark | state | still | The plain logo: a brand mark, and the entrance (set idle from it) |
| ![Idle](modes/idle.svg) | `idle` | Idle | state | 4 s | Nothing going on |
| ![Thinking](modes/thinking.svg) | `thinking` | Thinking | state | 4 s | Checking, loading, waiting on the network (family: thinking) |
| ![Thinking, drift](modes/thinking-drift.svg) | `thinking-drift` | Thinking, drift | state | 4 s | A variation of thinking for a long wait (family: thinking) |
| ![Thinking, side-eye](modes/thinking-sideeye.svg) | `thinking-sideeye` | Thinking, side-eye | state | 3 s | A variation of thinking, with a glance aside (family: thinking) |
| ![Thinking, hmm](modes/thinking-hmm.svg) | `thinking-hmm` | Thinking, hmm | state | 4 s | A variation of thinking: weighing something (family: thinking) |
| ![Thinking, rising](modes/thinking-stack.svg) | `thinking-stack` | Thinking, rising | state | 4 s | A variation of thinking: something building up (family: thinking) |
| ![Thinking, snake](modes/thinking-snake.svg) | `thinking-snake` | Thinking, snake | state | 4.7 s | A variation of thinking that fits a terminal (an easter egg of sorts) (family: thinking) |
| ![Updating / downloading](modes/updating.svg) | `updating` | Updating / downloading | state | 4.7 s | Downloading or installing (family: transfer) |
| ![Uploading](modes/uploading.svg) | `uploading` | Uploading | state | 4.7 s | Sending something away (family: transfer) |
| ![Working](modes/working.svg) | `working` | Working | state | 3.2 s | Busy doing it for the user |
| ![Success](modes/success.svg) | `success` | Success | reaction, 1.2 s | 1.6 s | Done, then back |
| ![Warning](modes/warning.svg) | `warning` | Warning | state | 2.8 s | Something needs a look, but nothing is broken |
| ![Error](modes/error.svg) | `error` | Error | state | 2.2 s | Failed: as a reaction, or the mode while it stays failed |
| ![Offline, standby](modes/offline-standby.svg) | `offline-standby` | Offline, standby | state | 3 s | Offline and not trying (family: offline) |
| ![Offline, searching](modes/offline-searching.svg) | `offline-searching` | Offline, searching | state | 7.9 s | Offline, looking for a network (family: offline) |
| ![Low battery](modes/low-battery.svg) | `low-battery` | Low battery | state | 5 s | The battery is low |
| ![Sleeping](modes/sleeping.svg) | `sleeping` | Sleeping | state | 4.3 s | Paused, put off until later, or the night light |
| ![Typing](modes/typing.svg) | `typing` | Typing | state | 3.1 s | The user is typing, or something is being written for them |
| ![Listening](modes/listening.svg) | `listening` | Listening | state | 1 s | Waiting for the user to press a key |
| ![Happy](modes/happy.svg) | `happy` | Happy | reaction, 1.8 s | 4 s | Pleased, then back |
| ![Laughing](modes/laughing.svg) | `laughing` | Laughing | reaction, 1.6 s | 0.7 s | A joke landed, then back |
| ![Excited](modes/excited.svg) | `excited` | Excited | reaction, 1.8 s | 0.9 s | Something good is about to happen (a theme picker, a download that's nearly done) |
| ![Love](modes/love.svg) | `love` | Love | reaction, 2 s | 1.2 s | A favourite, a thank-you, then back |
| ![Wink](modes/wink.svg) | `wink` | Wink | reaction, 1.2 s | 2.8 s | A small aside, then back |
| ![Shy](modes/shy.svg) | `shy` | Shy | reaction, 2 s | 6 s | A compliment received, then back |
| ![Surprised](modes/surprised.svg) | `surprised` | Surprised | reaction, 1.4 s | 1.6 s | Something unexpected, then back |
| ![Confused](modes/confused.svg) | `confused` | Confused | state | 3.4 s | Not sure what happened; a stall |
| ![Skeptical](modes/skeptical.svg) | `skeptical` | Skeptical | state | 5 s | Doubt: an odd input, an unusual request |
| ![Bored](modes/bored.svg) | `bored` | Bored | state | 10 s | Nothing has happened for a long while |
| ![Sad](modes/sad.svg) | `sad` | Sad | state | 4 s | Something was lost; never for a cancel or a skip |
| ![Crying](modes/crying.svg) | `crying` | Crying | state | 1.2 s | Something went badly; never to guilt the user |
| ![Scared](modes/scared.svg) | `scared` | Scared | reaction, 1.6 s | 2.2 s | A risky action is about to run, then back |
| ![Angry](modes/angry.svg) | `angry` | Angry | state | 2 s | Blocked by something outside the user's control |
| ![Sudo](modes/sudo.svg) | `sudo` | Sudo | state | 3.6 s | About to ask for a password |
| ![Peek](modes/peek.svg) | `peek` | Peek | state | 4.5 s | Looking in from the edge: a hint, a quick check-in |
| ![Party](modes/party.svg) | `party` | Party | state | 3.1 s | A real milestone, like finishing setup |
| ![Glitch](modes/glitch.svg) | `glitch` | Glitch | reaction, 1.8 s | 4 s | An easter egg: something went strange (easter egg) |
| ![Code rain](modes/code-rain.svg) | `code-rain` | Code rain | state | 4 s | An easter egg for the terminal (easter egg) |
| ![Can’t quit vim](modes/vim.svg) | `vim` | Can’t quit vim | state | 2.2 s | An easter egg: can't quit vim (easter egg) |
| ![Tiling](modes/tiling.svg) | `tiling` | Tiling | state | 3.7 s | Windows being arranged (the Omarchy tiling tutorial) |
| ![Mind blown](modes/mind-blown.svg) | `mind-blown` | Mind blown | reaction, 2.4 s | 2.4 s | Something impressive just happened, then back |
