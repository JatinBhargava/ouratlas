/**
 * Scheduled work inside the API process.
 *
 * There is one job today — a keep-alive ping — but it is written as a small
 * scheduler rather than a bare `setInterval` so a second job (pruning, a
 * digest, a reconciliation sweep) is a few lines rather than a refactor.
 *
 * Deliberately no cron library. Every job here runs on a fixed interval, and a
 * dependency that parses "* /10 * * * *" would earn its place only once a job
 * needs to run at a wall-clock time rather than every N minutes.
 */

import { KEEPALIVE_INTERVAL_MS, keepAliveUrl } from "@api/env";

type Job = {
  name: string;
  everyMs: number;
  /** Run once at startup as well as on the interval. */
  immediate?: boolean;
  run: () => Promise<void>;
};

/**
 * Pings this service's own public URL.
 *
 * It has to be the *public* address, not localhost. Hosts that idle a service
 * out — Render's free tier spins down after roughly fifteen minutes — count
 * inbound requests through their proxy. A loopback request never reaches that
 * proxy, so it would keep the event loop busy and let the service sleep anyway.
 *
 * This cannot wake a service that has already stopped: the process is not
 * running, so neither is this timer. It only prevents the idle window from
 * being reached in the first place.
 */
async function keepAlive(url: string): Promise<void> {
  const target = new URL("/api/health", url).toString();

  // Long enough to cover a cold TLS handshake, short enough that a hung
  // request cannot overlap the next tick.
  const response = await fetch(target, {
    signal: AbortSignal.timeout(30_000),
    headers: { "user-agent": "atlas-keepalive" },
  });

  if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
}

/**
 * Starts a job's timer.
 *
 * A failure is logged and the schedule continues — a job that throws should not
 * take the API down with it, and a missed keep-alive is not worth crashing for.
 * The timer is unref'd so it never keeps the process alive on its own, which
 * matters for a clean shutdown.
 */
function schedule(job: Job): void {
  const tick = () => {
    void job
      .run()
      .catch(error => console.error(`[cron] ${job.name} failed:`, error instanceof Error ? error.message : error));
  };

  const timer = setInterval(tick, job.everyMs);
  timer.unref();

  if (job.immediate) tick();
}

/**
 * Starts everything scheduled, and reports what is running.
 *
 * Called once from the entry point. Returns the jobs it started so the boot log
 * can say so — a cron that silently does not run is worse than no cron.
 */
export function startCron(): string[] {
  const jobs: Job[] = [];
  const url = keepAliveUrl();

  if (url) {
    jobs.push({
      name: "keep-alive",
      everyMs: KEEPALIVE_INTERVAL_MS,
      run: () => keepAlive(url),
    });
  }

  for (const job of jobs) schedule(job);

  return jobs.map(job => `${job.name} every ${Math.round(job.everyMs / 60_000)}m`);
}
