<script lang="ts">
  import { siteContent } from "@shaxda/i18n";
  import MatchParticipant from "$components/history/MatchParticipant.svelte";
  import RatedLabel from "$components/game/RatedLabel.svelte";
  import PageMeta from "$components/PageMeta.svelte";
  import ShareLink from "$components/ShareLink.svelte";
  import { formatDuration, formatMatchDateTime } from "$lib/history/format";
  import { participantName } from "$lib/history/presentation";
  import { matchPath, matchUrl } from "$lib/site/metadata";
  import type { PageData } from "./$types";

  let { data }: { data: PageData } = $props();
  const copy = siteContent.so.pages.match;
  const seats = ["A", "B"] as const;
  const match = $derived(data.match);
</script>

<PageMeta {...data.meta} path={matchPath(match.id)} />

<section
  class="mx-auto flex w-full max-w-4xl flex-col gap-6 px-4 py-10 sm:px-6 sm:py-14"
>
  <header
    class="rounded-2xl border border-board-700/20 bg-board-50 p-5 text-center sm:p-8"
  >
    <RatedLabel
      rated={match.rated}
      decision={match.ratingDecision}
      corrected={match.ratingCorrected}
      showDetail={match.rated}
    />
    <h1 class="mt-3 text-3xl leading-tight font-semibold sm:text-4xl">
      {data.headline}
    </h1>
    <p class="mt-2 text-board-700">{data.reason}</p>
    <div
      class="mx-auto mt-6 grid max-w-xl grid-cols-1 gap-3 text-left min-[380px]:grid-cols-2"
    >
      {#each seats as seat (seat)}
        {@const player = data.players[seat]}
        <div
          class="min-w-0 rounded-xl border border-board-700/20 px-3 py-4"
          data-testid="match-player-{seat}"
        >
          <div class="mb-2 flex flex-wrap items-center gap-2 text-sm">
            <span
              class="grid size-6 place-items-center rounded-full font-bold {seat ===
              'A'
                ? 'bg-board-200 text-board-900'
                : 'bg-board-800 text-board-50'}">{seat}</span
            >
            <span class="font-semibold">{copy.playerResult[player.result]}</span
            >
            {#if player.isViewer}
              <span class="text-board-700">({copy.youLabel})</span>
            {/if}
          </div>
          <MatchParticipant participant={player.participant} />
        </div>
      {/each}
    </div>
  </header>

  <!-- H3 replay and H4 statistics render here after the server access check. -->

  <section
    class="rounded-2xl border border-board-700/20 bg-board-50 p-5 sm:p-8"
    aria-labelledby="match-details"
  >
    <h2 id="match-details" class="text-xl font-semibold">
      {copy.details.heading}
    </h2>
    <dl class="mt-5 grid gap-x-6 gap-y-4 text-sm sm:grid-cols-2">
      <div>
        <dt class="font-bold">{copy.details.playedAt}</dt>
        <dd>
          <time datetime={new Date(match.endedAt).toISOString()}
            >{formatMatchDateTime(match.endedAt)}</time
          >
          {copy.details.utc}
        </dd>
      </div>
      <div>
        <dt class="font-bold">{copy.details.duration}</dt>
        <dd>{formatDuration(match.endedAt - match.startedAt)}</dd>
      </div>
      <div>
        <dt class="font-bold">{copy.details.mode}</dt>
        <dd>{copy.modes[match.mode]}</dd>
      </div>
      <div>
        <dt class="font-bold">{copy.details.startingSeat}</dt>
        <dd>
          {match.startingSeat} · {participantName(
            data.players[match.startingSeat].participant,
          )}
        </dd>
      </div>
      <div class="sm:col-span-2">
        <dt class="font-bold">{copy.details.firstAdvantage}</dt>
        <dd>
          {#if match.firstAdvantageSeat && match.firstAdvantageBy}
            {match.firstAdvantageSeat} · {participantName(
              data.players[match.firstAdvantageSeat].participant,
            )}
            ({copy.details.firstAdvantageBy[match.firstAdvantageBy]})
          {:else}
            {copy.details.undecided}
          {/if}
        </dd>
      </div>
      <div>
        <dt class="font-bold">{copy.details.pieces}</dt>
        <dd>
          A · {data.players.A.piecesLeft} / B · {data.players.B.piecesLeft}
        </dd>
      </div>
      <div>
        <dt class="font-bold">{copy.details.captures}</dt>
        <dd>A · {data.players.A.captured} / B · {data.players.B.captured}</dd>
      </div>
      <div>
        <dt class="font-bold">{copy.details.actions}</dt>
        <dd>{match.actionCount}</dd>
      </div>
    </dl>
  </section>
  {#if data.visibility === "public" && data.shareTitle}
    <ShareLink
      copy={copy.share}
      payload={{
        title: data.shareTitle,
        text: copy.share.shareText,
        url: matchUrl(match.id),
      }}
      testId="share-match"
    />
  {:else}
    <p class="text-sm text-board-700">{copy.privateNote}</p>
  {/if}
</section>
