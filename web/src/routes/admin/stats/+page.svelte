<script lang="ts">
  import { siteContent } from "@shaxda/i18n";
  import type { PageData } from "./$types";

  let { data }: { data: PageData } = $props();
  const copy = siteContent.so.adminStats;
  const windows = ["1d", "7d", "30d"] as const;
  const localNames = ["local_started", "local_completed"] as const;
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

  function recordedSince(events: readonly string[]) {
    const dates = events
      .flatMap((event) => data.recordedSince[event] ?? [])
      .sort();
    return dates[0] ? `${copy.recordedSince} ${dates[0]}` : copy.unrecorded;
  }

  function localTotal(days: number, event: string) {
    return data.days
      .slice(0, days)
      .reduce((sum, day) => sum + (count(day, event) ?? 0), 0);
  }

  function completion(days: number) {
    const started = localTotal(days, "local_started");
    const completed = localTotal(days, "local_completed");
    const rate = started === 0 ? "—" : percent.format(completed / started);
    return `${rate} (${completed} / ${started})`;
  }

  function localCount(day: string, event: string) {
    const start = data.recordedSince[event];
    return start && day >= start ? (count(day, event) ?? 0) : "—";
  }
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
            <td>{localCount(day, "local_started")}</td>
            <td>{localCount(day, "local_completed")}</td>
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

  {#each [copy.online, copy.saved, copy.weeklyReturning, copy.cohorts] as title (title)}
    <section class="space-y-2">
      <h2 class="text-xl font-semibold">{title}</h2>
      <p class="text-sm">{copy.unrecorded}</p>
    </section>
  {/each}
</div>
