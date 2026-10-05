# Every Omi mode

Omi has 49 modes, each a set of rectangles with a looping
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
- **A screen reader says** is the mode's `label` in the pack: the
  accessible name every app gives the picture, so Omi is announced the same
  way everywhere. It is each still's own name on this page.
- "Use it for" is advice for app authors; [docs/omarchy.md](omarchy.md)
  has the rules of thumb behind it (react to what the user did, never
  guilt the user, keep reactions short while they concentrate).

| | id | Name | Kind | Loop | A screen reader says | Use it for |
| --- | --- | --- | --- | --- | --- | --- |
| ![The Omarchy logo](modes/mark.svg) | `mark` | The mark | state | still | The Omarchy logo | The plain logo: a brand mark, and the entrance (set idle from it) |
| ![Omi](modes/idle.svg) | `idle` | Idle | state | 4 s | Omi | Nothing going on |
| ![Omi is thinking](modes/thinking.svg) | `thinking` | Thinking | state | 4 s | Omi is thinking | Checking, loading, waiting on the network (family: thinking) |
| ![Omi is thinking](modes/thinking-drift.svg) | `thinking-drift` | Thinking, drift | state | 4 s | Omi is thinking | A variation of thinking for a long wait (family: thinking) |
| ![Omi is thinking](modes/thinking-sideeye.svg) | `thinking-sideeye` | Thinking, side-eye | state | 3 s | Omi is thinking | A variation of thinking, with a glance aside (family: thinking) |
| ![Omi is thinking](modes/thinking-hmm.svg) | `thinking-hmm` | Thinking, hmm | state | 4 s | Omi is thinking | A variation of thinking: weighing something (family: thinking) |
| ![Omi is thinking](modes/thinking-stack.svg) | `thinking-stack` | Thinking, rising | state | 4 s | Omi is thinking | A variation of thinking: something building up (family: thinking) |
| ![Omi is thinking](modes/thinking-snake.svg) | `thinking-snake` | Thinking, snake | state | 4.7 s | Omi is thinking | A variation of thinking that fits a terminal (an easter egg of sorts) (family: thinking) |
| ![Omi is updating](modes/updating.svg) | `updating` | Updating / downloading | state | 4.7 s | Omi is updating | Downloading or installing (family: transfer) |
| ![Omi is uploading](modes/uploading.svg) | `uploading` | Uploading | state | 4.7 s | Omi is uploading | Sending something away (family: transfer) |
| ![Omi is working](modes/working.svg) | `working` | Working | state | 3.2 s | Omi is working | Busy doing it for the user |
| ![Omi succeeded](modes/success.svg) | `success` | Success | reaction, 1.2 s | 1.6 s | Omi succeeded | Done, then back |
| ![Omi has a warning](modes/warning.svg) | `warning` | Warning | state | 2.8 s | Omi has a warning | Something needs a look, but nothing is broken |
| ![Omi hit an error](modes/error.svg) | `error` | Error | state | 2.2 s | Omi hit an error | Failed: as a reaction, or the mode while it stays failed |
| ![Omi is offline](modes/offline-standby.svg) | `offline-standby` | Offline, standby | state | 3 s | Omi is offline | Offline and not trying (family: offline) |
| ![Omi is offline, looking for a network](modes/offline-searching.svg) | `offline-searching` | Offline, searching | state | 7.9 s | Omi is offline, looking for a network | Offline, looking for a network (family: offline) |
| ![Omi is low on battery](modes/low-battery.svg) | `low-battery` | Low battery | state | 5 s | Omi is low on battery | The battery is low |
| ![Omi is asleep](modes/sleeping.svg) | `sleeping` | Sleeping | state | 4.3 s | Omi is asleep | Paused, put off until later, or the night light |
| ![Omi has a question](modes/asking.svg) | `asking` | Asking | state | 3 s | Omi has a question | Waiting for the user to decide: an agent wants approval, a dialog needs an answer |
| ![Omi wants your attention](modes/attention.svg) | `attention` | Attention | reaction, 1.2 s | 1.2 s | Omi wants your attention | A ping: a notification arrived, a background job finished, then back |
| ![Omi is recording the screen](modes/recording.svg) | `recording` | Recording | state | 4 s | Omi is recording the screen | The screen is being shared or recorded, as long as it lasts |
| ![Omi is typing](modes/typing.svg) | `typing` | Typing | state | 3.1 s | Omi is typing | The user is typing, or something is being written for them |
| ![Omi is listening](modes/listening.svg) | `listening` | Listening | state | 1 s | Omi is listening | Waiting for the user to press a key |
| ![Omi says hello](modes/hello.svg) | `hello` | Hello | reaction, 1.6 s | 1.6 s | Omi says hello | A greeting: first boot, a first open, then back |
| ![Omi says goodbye](modes/goodbye.svg) | `goodbye` | Goodbye | reaction, 1.4 s | 1.4 s | Omi says goodbye | Logout, shutdown, reboot: a tilt and the eyes close, then the host shows the plain logo |
| ![Omi nods: yes](modes/nod.svg) | `nod` | Nod | reaction, 0.9 s | 0.7 s | Omi nods: yes | Yes: a small agreement, lighter than success, then back |
| ![Omi shakes its head: no](modes/shake.svg) | `shake` | Shake | reaction, 0.9 s | 0.7 s | Omi shakes its head: no | No: the gentle no that error is too strong for, then back |
| ![Omi is happy](modes/happy.svg) | `happy` | Happy | reaction, 1.8 s | 4 s | Omi is happy | Pleased, then back |
| ![Omi is laughing](modes/laughing.svg) | `laughing` | Laughing | reaction, 1.6 s | 0.7 s | Omi is laughing | A joke landed, then back |
| ![Omi is excited](modes/excited.svg) | `excited` | Excited | reaction, 1.8 s | 0.9 s | Omi is excited | Something good is about to happen (a theme picker, a download that's nearly done) |
| ![Omi loves it](modes/love.svg) | `love` | Love | reaction, 2 s | 1.2 s | Omi loves it | A favourite, a thank-you, then back |
| ![Omi winks](modes/wink.svg) | `wink` | Wink | reaction, 1.2 s | 2.8 s | Omi winks | A small aside, then back |
| ![Omi is shy](modes/shy.svg) | `shy` | Shy | reaction, 2 s | 6 s | Omi is shy | A compliment received, then back |
| ![Omi is surprised](modes/surprised.svg) | `surprised` | Surprised | reaction, 1.4 s | 1.6 s | Omi is surprised | Something unexpected, then back |
| ![Omi is confused](modes/confused.svg) | `confused` | Confused | state | 3.4 s | Omi is confused | Not sure what happened; a stall |
| ![Omi is skeptical](modes/skeptical.svg) | `skeptical` | Skeptical | state | 5 s | Omi is skeptical | Doubt: an odd input, an unusual request |
| ![Omi is bored](modes/bored.svg) | `bored` | Bored | state | 10 s | Omi is bored | Nothing has happened for a long while |
| ![Omi is sad](modes/sad.svg) | `sad` | Sad | state | 4 s | Omi is sad | Something was lost; never for a cancel or a skip |
| ![Omi is crying](modes/crying.svg) | `crying` | Crying | state | 1.2 s | Omi is crying | Something went badly; never to guilt the user |
| ![Omi is scared](modes/scared.svg) | `scared` | Scared | reaction, 1.6 s | 2.2 s | Omi is scared | A risky action is about to run, then back |
| ![Omi is angry](modes/angry.svg) | `angry` | Angry | state | 2 s | Omi is angry | Blocked by something outside the user's control |
| ![Omi needs your password](modes/sudo.svg) | `sudo` | Sudo | state | 3.6 s | Omi needs your password | About to ask for a password |
| ![Omi is peeking in](modes/peek.svg) | `peek` | Peek | state | 4.5 s | Omi is peeking in | Looking in from the edge: a hint, a quick check-in |
| ![Omi is celebrating](modes/party.svg) | `party` | Party | state | 3.1 s | Omi is celebrating | A real milestone, like finishing setup |
| ![Omi glitches](modes/glitch.svg) | `glitch` | Glitch | reaction, 1.8 s | 4 s | Omi glitches | An easter egg: something went strange (easter egg) |
| ![Omi is raining code](modes/code-rain.svg) | `code-rain` | Code rain | state | 4 s | Omi is raining code | An easter egg for the terminal (easter egg) |
| ![Omi can’t quit vim](modes/vim.svg) | `vim` | Can’t quit vim | state | 2.2 s | Omi can’t quit vim | An easter egg: can't quit vim (easter egg) |
| ![Omi is tiling windows](modes/tiling.svg) | `tiling` | Tiling | state | 3.7 s | Omi is tiling windows | Windows being arranged (the Omarchy tiling tutorial) |
| ![Omi’s mind is blown](modes/mind-blown.svg) | `mind-blown` | Mind blown | reaction, 2.4 s | 2.4 s | Omi’s mind is blown | Something impressive just happened, then back |
