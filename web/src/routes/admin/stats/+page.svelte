<script lang="ts">
  import { siteContent } from "@shaxda/i18n";
  import { onlineFunnelNames } from "@shaxda/shared/analytics/events";
  import type { PageData } from "./$types";

  let { data }: { data: PageData } = $props();
  const copy = siteContent.so.adminStats;
  const windows = ["1d", "7d", "30d"] as const;
  const cohortTitles: Record<string, string> = {
    cohort_d7: copy.cohortD7,
    cohort_d30: copy.cohortD30,
    cohort_within_7d: copy.cohortWithin7,
  };
  const matureWeeks = $derived(
    data.weeks.filter(
      ({ day, mature }) =>
        mature &&
        (count(day, "week_players") ?? 0) > 0 &&
        count(day, "week_returning") !== undefined,
    ).length,
  );
  const localNames = ["local_started", "local_completed"] as const;
  const onlineBlocks = [
    {
      title: copy.onlineRooms,
      metrics: [
        { label: copy.created, prefix: "online_room_created" },
        { label: copy.joined, prefix: "online_room_joined" },
      ],
    },
    {
      title: copy.onlineInvite,
      metrics: [
        { label: copy.started, prefix: "online_started_invite" },
        { label: copy.completed, prefix: "online_completed_invite" },
      ],
    },
    {
      title: copy.onlineQuick,
      metrics: [
        { label: copy.started, prefix: "online_started_quick" },
        { label: copy.completed, prefix: "online_completed_quick" },
      ],
    },
  ] as const;
  const onlineKinds = [
    { label: copy.onlineGuest, suffix: "guest" },
    { label: copy.onlineAccount, suffix: "account" },
  ] as const;
  const onlineDays = $derived([data.todayDay, ...data.days]);
  const activity = [
    { title: copy.browsers, prefix: "active_browsers", kind: "guest" },
    { title: copy.accounts, prefix: "active_accounts", kind: "account" },
  ] as const;
  const counts = $derived(
    new Map(
      data.daily.map(({ day, event, count }) => [`${day}/${event}`, count]),
    ),
  );
  const latestDay = $derived(
    data.daily.findLast(({ event }) => event === "active_browsers_1d")?.day,
  );
  const dateTime = new Intl.DateTimeFormat("so-SO", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "UTC",
  });
  const percent = new Intl.NumberFormat("so-SO", {
    style: "percent",
    maximumFractionDigits: 1,
  });

  function count(day: string, event: string) {
    return counts.get(`${day}/${event}`);
  }

  function firstRecordedDay(events: readonly string[]) {
    return events.flatMap((event) => data.recordedSince[event] ?? []).sort()[0];
  }

  function recordedSince(events: readonly string[]) {
    const start = firstRecordedDay(events);
    return start ? `${copy.recordedSince} ${start}` : copy.unrecorded;
  }

  function localTotal(days: number, event: string) {
    return data.days
      .slice(0, days)
      .reduce((sum, day) => sum + (count(day, event) ?? 0), 0);
  }

  function completion(days: number) {
    const started = localTotal(days, "local_started");
    const completed = localTotal(days, "local_completed");
    return share(completed, started);
  }

  function share(
    numerator: number | undefined,
    denominator: number | undefined,
  ) {
    if (numerator === undefined || denominator === undefined) return "—";
    const rate =
      denominator === 0 ? "—" : percent.format(numerator / denominator);
    return `${rate} (${numerator} / ${denominator})`;
  }

  function recordedCount(
    day: string,
    event: string,
    start = data.recordedSince[event],
  ) {
    return start && day >= start ? (count(day, event) ?? 0) : "—";
  }

  const onlineStart = $derived(firstRecordedDay(onlineFunnelNames));
</script>

<svelte:head>
  <title>{copy.title} | Shaxda</title>
  <meta name="robots" content="noindex" />
</svelte:head>

<div class="mx-auto max-w-4xl space-y-8 px-4 py-10 sm:px-6">
  <header class="space-y-3">
    <h1 class="text-3xl font-semibold">{copy.title}</h1>
    <dl class="grid gap-x-4 gap-y-1 text-sm sm:grid-cols-[max-content_1fr]">
      <dt>{copy.lastRun}</dt>
      <dd>
        {data.lastSuccessAt === null
          ? copy.unrecorded
          : `${dateTime.format(data.lastSuccessAt)} UTC`}
      </dd>
      <dt>{copy.lastCompleteDay}</dt>
      <dd>{latestDay ?? copy.unrecorded}</dd>
    </dl>
    {#if count(data.days[0], "active_browsers_1d") === undefined}
      <p class="font-semibold text-board-800">{copy.missingYesterday}</p>
    {/if}
  </header>

  <p>{copy.activityNote}</p>
  {#each activity as block (block.kind)}
    <section class="space-y-2">
      <h2 class="text-xl font-semibold">{block.title}</h2>
      <p class="text-sm">
        {recordedSince(windows.map((window) => `${block.prefix}_${window}`))}
      </p>
      <p>{copy.today} ({data.todayDay}) · {data.today[block.kind]}</p>
      <table class="w-full text-sm tabular-nums" aria-label={block.title}>
        <thead class="border-b border-board-300 text-end">
          <tr>
            <th class="py-2 text-start" scope="col">{copy.day}</th>
            {#each windows as window (window)}
              <th scope="col">{copy.days[window]}</th>
            {/each}
          </tr>
        </thead>
        <tbody>
          {#each data.days as day (day)}
            <tr class="border-b border-board-200 text-end">
              <th scope="row" class="py-1 text-start font-normal">{day}</th>
              {#each windows as window (window)}
                <td>{count(day, `${block.prefix}_${window}`) ?? "—"}</td>
              {/each}
            </tr>
          {/each}
        </tbody>
      </table>
    </section>
  {/each}

  <section class="space-y-2">
    <h2 class="text-xl font-semibold">{copy.local}</h2>
    <p class="text-sm">{recordedSince(localNames)}</p>
    <dl class="grid gap-1 text-sm tabular-nums">
      <dt>{copy.completionRate}</dt>
      <dd>{copy.days["7d"]} · {completion(7)}</dd>
      <dd>{copy.days["30d"]} · {completion(30)}</dd>
    </dl>
    <table class="w-full text-sm tabular-nums" aria-label={copy.local}>
      <thead class="border-b border-board-300 text-end">
        <tr>
          <th scope="col" class="py-2 text-start">{copy.day}</th>
          <th scope="col">{copy.started}</th>
          <th scope="col">{copy.completed}</th>
        </tr>
      </thead>
      <tbody>
        {#each data.days as day (day)}
          <tr class="border-b border-board-200 text-end">
            <th scope="row" class="py-1 text-start font-normal">{day}</th>
            <td>{recordedCount(day, "local_started")}</td>
            <td>{recordedCount(day, "local_completed")}</td>
          </tr>
        {/each}
      </tbody>
    </table>
  </section>

  <section class="space-y-2">
    <h2 class="text-xl font-semibold">{copy.registrations}</h2>
    <p class="text-sm">{recordedSince(["registrations"])}</p>
    <table class="w-full text-sm tabular-nums" aria-label={copy.registrations}>
      <thead class="border-b border-board-300 text-end">
        <tr>
          <th scope="col" class="py-2 text-start">{copy.day}</th>
          <th scope="col">{copy.registrations}</th>
        </tr>
      </thead>
      <tbody>
        {#each data.days as day (day)}
          <tr class="border-b border-board-200 text-end">
            <th scope="row" class="py-1 text-start font-normal">{day}</th>
            <td>{count(day, "registrations") ?? "—"}</td>
          </tr>
        {/each}
      </tbody>
    </table>
  </section>

  <section class="space-y-2">
    <h2 class="text-xl font-semibold">{copy.online}</h2>
    <p class="text-sm">{recordedSince(onlineFunnelNames)}</p>
    {#if onlineStart}
      {#each onlineBlocks as block (block.title)}
        {@const start = firstRecordedDay(
          block.metrics.flatMap(({ prefix }) =>
            onlineKinds.map(({ suffix }) => `${prefix}_${suffix}`),
          ),
        )}
        <h3 class="font-semibold">{block.title}</h3>
        {#if start}
          <p class="text-sm">{copy.recordedSince} {start}</p>
          <div class="overflow-x-auto">
            <table class="w-full text-sm tabular-nums" aria-label={block.title}>
              <thead class="border-b border-board-300 text-end">
                <tr>
                  <th class="py-2 text-start" scope="col">{copy.day}</th>
                  {#each block.metrics as metric (metric.prefix)}
                    {#each onlineKinds as kind (kind.suffix)}
                      <th scope="col">
                        {metric.label} · {metric.prefix ===
                          "online_room_created" && kind.suffix === "account"
                          ? copy.onlineCreatorAccount
                          : kind.label}
                      </th>
                    {/each}
                  {/each}
                </tr>
              </thead>
              <tbody>
                {#each onlineDays as day (day)}
                  <tr class="border-b border-board-200 text-end">
                    <th scope="row" class="py-1 text-start font-normal"
                      >{day}</th
                    >
                    {#each block.metrics as metric (metric.prefix)}
                      {#each onlineKinds as kind (kind.suffix)}
                        <td
                          >{recordedCount(
                            day,
                            `${metric.prefix}_${kind.suffix}`,
                            start,
                          )}</td
                        >
                      {/each}
                    {/each}
                  </tr>
                {/each}
              </tbody>
            </table>
          </div>
        {:else}
          <p class="text-sm">{copy.unrecorded}</p>
        {/if}
      {/each}
    {/if}
  </section>

  <section class="space-y-2">
    <h2 class="text-xl font-semibold">{copy.saved}</h2>
    <p class="text-sm">{recordedSince(["saved_friendly", "saved_rated"])}</p>
    <table class="w-full text-sm tabular-nums" aria-label={copy.saved}>
      <thead class="border-b border-board-300 text-end">
        <tr>
          <th scope="col" class="py-2 text-start">{copy.day}</th>
          <th scope="col">{copy.savedFriendly}</th>
          <th scope="col">{copy.savedRated}</th>
        </tr>
      </thead>
      <tbody>
        {#each data.days as day (day)}
          <tr class="border-b border-board-200 text-end">
            <th scope="row" class="py-1 text-start font-normal">{day}</th>
            <td>{count(day, "saved_friendly") ?? "—"}</td>
            <td>{count(day, "saved_rated") ?? "—"}</td>
          </tr>
        {/each}
      </tbody>
    </table>
  </section>

  <section class="space-y-2">
    <h2 class="text-xl font-semibold">{copy.weeklyReturning}</h2>
    <p class="text-sm">{recordedSince(["week_players"])}</p>
    {#if matureWeeks < 2}
      <p class="text-sm">{copy.waitingForWeeks}</p>
    {/if}
    <table
      class="w-full text-sm tabular-nums"
      aria-label={copy.weeklyReturning}
    >
      <thead class="border-b border-board-300 text-end">
        <tr>
          <th scope="col" class="py-2 text-start">{copy.weekOf}</th>
          <th scope="col">{copy.players}</th>
          <th scope="col">{copy.returningShare}</th>
        </tr>
      </thead>
      <tbody>
        {#each data.weeks as { day, mature } (day)}
          <tr class="border-b border-board-200 text-end">
            <th scope="row" class="py-1 text-start font-normal">{day}</th>
            <td>{count(day, "week_players") ?? "—"}</td>
            <td
              >{mature
                ? share(
                    count(day, "week_returning"),
                    count(day, "week_players"),
                  )
                : copy.immature}</td
            >
          </tr>
        {/each}
      </tbody>
    </table>
  </section>

  <section class="space-y-4">
    <h2 class="text-xl font-semibold">{copy.cohorts}</h2>
    {#each data.cohortWindows as { event, days, pendingDay } (event)}
      <section class="space-y-2">
        <h3 class="font-semibold">{cohortTitles[event]}</h3>
        <p class="text-sm">{recordedSince([event])}</p>
        <table
          class="w-full text-sm tabular-nums"
          aria-label={cohortTitles[event]}
        >
          <thead class="border-b border-board-300 text-end">
            <tr>
              <th scope="col" class="py-2 text-start">{copy.day}</th>
              <th scope="col">{copy.players}</th>
              <th scope="col">{copy.returningShare}</th>
            </tr>
          </thead>
          <tbody>
            <tr class="border-b border-board-200 text-end">
              <th scope="row" class="py-1 text-start font-normal"
                >{pendingDay}</th
              >
              <td>{count(pendingDay, "cohort_size") ?? "—"}</td>
              <td>{copy.immature}</td>
            </tr>
            {#each days as day (day)}
              <tr class="border-b border-board-200 text-end">
                <th scope="row" class="py-1 text-start font-normal">{day}</th>
                <td>{count(day, "cohort_size") ?? "—"}</td>
                <td>{share(count(day, event), count(day, "cohort_size"))}</td>
              </tr>
            {/each}
          </tbody>
        </table>
      </section>
    {/each}
  </section>
</div>
