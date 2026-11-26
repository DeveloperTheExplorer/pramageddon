# PRAMAGEDDON — Norwegian Nap Arcade

A low-poly, Overcooked-style Norwegian babysitting game starring **Inger** in **Gjerdrum**. The babies are asleep outside in their prams. Keep them that way for as long as you can.

**Play:** https://developertheexplorer.github.io/pramageddon/

## The arcade loop

There are no shifts or finish lines now. Every run is one endless arcade attempt:

- Start with **two prams**. A third arrives at about **0:42**, a fourth at **1:38**, and the fifth at **2:45**.
- As the run heats up, needs bite faster, calm periods get shorter, foxes get bolder, and the music speeds up and adds layers.
- Crying drains **Neighbourhood Peace**. At zero, the run ends and your score goes on the board.
- Throwing is manual: face a pram/crib and watch the ground arrow. It turns **mint** when you are aimed at a valid target, red when you are not. `R` or **THROW** sends whatever is in Inger's hands in that direction. Miss a baby throw and the run ends immediately.
- **Dash** with `Shift` or the lightning button (or double-tap the joystick) to cross the yard.

## Leaderboard

Scores are saved locally on the device automatically. On the game-over screen you can put a name on the run and send it to the global **Gjerdrum board**:

- The global board is a free [DreamLo](https://dreamlo.com/) leaderboard. DreamLo is HTTP-only, so the HTTPS game talks to it through [Jina Reader](https://r.jina.ai/) as a proxy.
- If either remote service is unavailable, the leaderboard falls back to local scores and the game remains fully playable.
- The leaderboard is available from the title screen and the game-over screen.

## Controls

| Input | Action |
| --- | --- |
| `WASD` / arrow keys | Move and aim |
| `E` / `Space` | Pick up, give, tuck in, shoo |
| `Q` | Drop what you're holding |
| `Shift` | Dash |
| `R` | Throw in the direction Inger is facing |
| `Esc` / `P` | Pause |
| `H` | Help |
| `M` | Mute |

On phones and tablets the game is portrait-first: virtual joystick, large `Q` / **THROW** / `E` buttons, a lightning dash button, a follow camera, off-screen pram locators, fullscreen, and notch-aware safe areas.

## Development

```bash
pnpm install
pnpm dev
pnpm build
pnpm preview
```

- **Three.js** — all geometry is procedural; no model or texture files.
- **Vite** — development and production builds.
- **Web Audio API** — all music and SFX are synthesized at runtime.
- **DreamLo + Jina Reader** — optional global leaderboard, with a local-storage fallback.

![Pramageddon title](docs/title.png)

![Pramageddon gameplay](docs/gameplay.png)
