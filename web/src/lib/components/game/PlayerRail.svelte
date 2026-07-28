<script lang="ts">
  import { Flag, LockKeyhole } from "@lucide/svelte";
  import { DRAW_TURN_LIMIT, type PlayerId } from "@shaxda/game-engine";
  import { messages } from "@shaxda/i18n";
  import type { RailInstructionKey, RailState } from "$lib/game/seating";
  import type { GameStatus } from "$lib/game/status";
  import ReserveTray from "./ReserveTray.svelte";

  interface Props {
    player: PlayerId;
    status: GameStatus;
    name: string;
    railState: RailState;
    instruction: RailInstructionKey | null;
    rotate?: boolean;
    onResign?: (() => void) | null;
    notice?: string | null;
  }

  let {
    player,
    status,
    name,
    railState,
    instruction,
    rotate = false,
    onResign = null,
    notice = null,
  }: Props = $props();

  const copy = messages.so.localGame;
  const drawWarningThreshold = Math.ceil(DRAW_TURN_LIMIT * 0.75);
</script>

<section
  class="rail"
  class:acting={railState === "acting"}
  class:space-making={railState === "spaceMaking"}
  class:blocked={railState === "blocked"}
  class:winner={railState === "winner"}
  class:loser={railState === "loser"}
  data-testid={`player-rail-${player}`}
  data-player={player}
  data-rail-state={railState}
  data-rotated={rotate ? "true" : "false"}
>
  <div class="orientation" class:rotated={rotate}>
    <div
      class="avatar"
      class:light={player === "A"}
      class:dark={player === "B"}
      aria-hidden="true"
    >
      {player}
      {#if railState === "blocked"}
        <span class="lock"><LockKeyhole size={11} /></span>
      {/if}
    </div>

    <div class="copy">
      <h2>{name}</h2>
      <p>
        {instruction === null
          ? copy.tabletop.states[railState]
          : copy.tabletop.instructions[instruction]}
      </p>
      {#if notice !== null}
        <span class="rail-notice">{notice}</span>
      {/if}
      {#if (railState === "acting" || railState === "spaceMaking") && status.turnsSinceCapture >= drawWarningThreshold}
        <span class="draw-warning" data-testid="draw-warning">
          {DRAW_TURN_LIMIT - status.turnsSinceCapture}
          {copy.tabletop.turnsRemaining}
        </span>
      {/if}
    </div>

    {#if onResign !== null}
      <button
        class="resign"
        type="button"
        aria-label={copy.controls.resign}
        onclick={onResign}
      >
        <Flag size={16} aria-hidden="true" />
      </button>
    {:else if status.phase === "placement"}
      <ReserveTray {player} count={status.players[player].inHand} />
    {:else}
      <dl>
        <div>
          <dt>{copy.onBoardLabel}</dt>
          <dd>{status.players[player].onBoard}</dd>
        </div>
        <div>
          <dt>{copy.capturedLabel}</dt>
          <dd>{status.players[player].captured}</dd>
        </div>
      </dl>
    {/if}
  </div>
</section>

<style>
  .rail {
    min-height: 0;
    overflow: hidden;
    border: 1px solid rgb(106 61 37 / 0.22);
    border-radius: 0.8rem;
    background: rgb(255 250 243 / 0.94);
    box-shadow: 0 3px 12px rgb(68 38 22 / 0.08);
  }

  .rail.acting,
  .rail.space-making {
    border-color: #176b55;
    background: #d8eee5;
    box-shadow: inset 0 0 0 1px rgb(23 107 85 / 0.2);
  }

  .rail.blocked {
    border-color: #875a12;
    background: #f8e9bd;
  }

  .rail.winner {
    border-color: #176b55;
    background: #d8eee5;
  }

  .rail.loser {
    opacity: 0.72;
  }

  .orientation {
    display: grid;
    grid-template-columns: 2rem minmax(0, 1fr) auto;
    gap: 0.45rem;
    align-items: center;
    height: 100%;
    padding: 0.25rem 0.45rem;
  }

  .orientation.rotated {
    transform: rotate(180deg);
  }

  .avatar {
    position: relative;
    display: grid;
    width: 2rem;
    height: 2rem;
    place-items: center;
    border: 2px solid transparent;
    border-radius: 999px;
    font-size: 0.7rem;
    font-weight: 900;
  }

  .acting .avatar,
  .space-making .avatar,
  .winner .avatar {
    border-color: #176b55;
  }

  .blocked .avatar {
    border-color: #875a12;
  }

  .avatar.light {
    background: radial-gradient(
      circle at 33% 28%,
      #fffaf1,
      #f3dfbf 68%,
      #a8886d
    );
    color: #604b3c;
  }

  .avatar.dark {
    background: radial-gradient(
      circle at 33% 28%,
      #9f6d4d,
      #5b3020 66%,
      #25120d
    );
    color: #fff4e5;
  }

  .lock {
    position: absolute;
    right: -0.3rem;
    bottom: -0.2rem;
    display: grid;
    width: 1rem;
    height: 1rem;
    place-items: center;
    border: 1px solid white;
    border-radius: 999px;
    background: #875a12;
    color: white;
  }

  .copy {
    min-width: 0;
  }

  h2,
  p {
    overflow: hidden;
    margin: 0;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .draw-warning {
    display: inline-block;
    margin-top: 0.1rem;
    border-radius: 999px;
    background: #f8e9bd;
    padding: 0.1rem 0.35rem;
    color: #713f12;
    font-size: 0.6rem;
    font-weight: 800;
    white-space: nowrap;
  }

  .rail-notice {
    display: block;
    overflow: hidden;
    color: #713f12;
    font-size: 0.62rem;
    font-weight: 700;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  h2 {
    font-size: 0.75rem;
    font-weight: 800;
  }

  p {
    color: #765e50;
    font-size: 0.65rem;
  }

  .acting p,
  .space-making p {
    color: #214d41;
    font-weight: 700;
  }

  dl {
    display: grid;
    grid-template-columns: repeat(2, auto);
    gap: 0.2rem;
    margin: 0;
  }

  .resign {
    display: grid;
    width: 2.75rem;
    height: 2.75rem;
    place-items: center;
    border: 1px solid rgb(153 27 27 / 0.3);
    border-radius: 0.6rem;
    background: rgb(254 242 242 / 0.75);
    color: #991b1b;
  }

  dl div {
    min-width: 2.25rem;
    border-radius: 0.45rem;
    background: rgb(255 255 255 / 0.5);
    padding: 0.15rem 0.25rem;
    text-align: center;
  }

  dt {
    display: none;
    color: #765e50;
    font-size: 0.55rem;
  }

  dd {
    margin: 0;
    font-size: 0.75rem;
    font-weight: 800;
  }

  @container tabletop (min-height: 380px) {
    .orientation {
      grid-template-columns: 2.5rem minmax(0, 1fr) auto;
      padding: 0.35rem 0.55rem;
    }

    .avatar {
      width: 2.5rem;
      height: 2.5rem;
    }

    h2 {
      font-size: 0.85rem;
    }

    p {
      font-size: 0.7rem;
    }
  }

  @container tabletop (min-height: 460px) {
    .orientation {
      grid-template-columns: 2.75rem minmax(0, 1fr) auto;
      padding: 0.45rem 0.65rem;
    }

    .avatar {
      width: 2.75rem;
      height: 2.75rem;
    }

    h2 {
      font-size: 0.95rem;
    }

    p {
      font-size: 0.75rem;
    }

    dt {
      display: block;
    }
  }
</style>
