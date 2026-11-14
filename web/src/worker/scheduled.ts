import { ANALYTICS_JOB_NAME, runAnalyticsNightly } from "@shaxda/db/analytics";
import { UTC_DAY_MS } from "@shaxda/shared/analytics/events";

type Environment = Pick<App.Platform["env"], "DB">;
type JobState = {
  name: string;
  last_success_at: number | null;
};

interface ScheduledJob {
  name: string;
  testCron: string;
  due(time: number, state: JobState | undefined): boolean;
  run(env: Environment, now: number): Promise<void>;
}

const NIGHTLY_START_MS = 15 * 60_000;

export const jobs: readonly ScheduledJob[] = [
  {
    name: ANALYTICS_JOB_NAME,
    testCron: "15 0 * * *",
    due(time, state) {
      const start = time - (time % UTC_DAY_MS) + NIGHTLY_START_MS;
      return time >= start && (state?.last_success_at ?? -1) < start;
    },
    run: (env, now) => runAnalyticsNightly(env.DB, now),
  },
];

export function scheduled(
  controller: { cron: string; scheduledTime: number },
  env: Environment,
  ctx: { waitUntil(promise: Promise<unknown>): void },
): void {
  const now = controller.scheduledTime;
  const eligible = jobs.filter(
    (job) => controller.cron === job.testCron || job.due(now, undefined),
  );
  if (eligible.length === 0) return;

  ctx.waitUntil(dispatch(eligible, controller.cron, env, now));
}

async function dispatch(
  eligible: ScheduledJob[],
  cron: string,
  env: Environment,
  now: number,
): Promise<void> {
  const { results } = await env.DB.prepare(
    `SELECT name, last_success_at FROM job_state WHERE name IN (${eligible.map(() => "?").join(", ")})`,
  )
    .bind(...eligible.map(({ name }) => name))
    .all<JobState>();
  const states = new Map<string, JobState>(
    results.map((state: JobState) => [state.name, state] as const),
  );

  const outcomes = await Promise.allSettled(
    eligible
      .filter(
        (job) => cron === job.testCron || job.due(now, states.get(job.name)),
      )
      .map((job) => job.run(env, now)),
  );
  if (outcomes.some((outcome) => outcome.status === "rejected")) {
    // Errors from leased work are recorded with a code. Keep uncaught D1
    // error messages, which may contain query arguments, out of Worker logs.
    throw new Error("Scheduled job failed.");
  }
}
