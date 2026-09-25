/**
 * How much AI one person may use: a short burst limit on every AI route, and
 * a monthly allowance per plan on the two that cost the most.
 *
 * Two layers because they guard against different things. The burst limit
 * stops a script or a stuck button from firing a hundred calls in a minute; it
 * lives in memory, is cheap, and needs no account. The allowance is what
 * actually caps spend: it is counted in Postgres (`claim_ai` in `schema.sql`)
 * in one statement, so it holds across restarts, deploys and instances, and a
 * double-click cannot slip two claims past it.
 *
 * Nothing about what was sent is kept by either: a key, a count and a time.
 */

import type { Request, RequestHandler } from "express";

import { HttpError } from "@api/http";
import { admin, getActiveSubscription } from "@api/supabase";
import { PLAN_LIMITS, type AiAllowance, type AiKind, type Meter, type Plan } from "@/types";

/**
 * Who a limit is counted against: the account when there is one, otherwise
 * the address the request came from.
 *
 * The address is only as good as `trust proxy` in `app.ts`, which believes
 * any `X-Forwarded-For` — right for traffic through Vercel, which overwrites
 * the header, but spoofable by anyone calling the API host directly. That is
 * acceptable for the open routes (voice, cheap per call); anything expensive
 * is behind sign-in and counted per account instead.
 */
function who(req: Request): string {
  return req.user?.id ? `u:${req.user.id}` : `ip:${req.ip ?? "unknown"}`;
}

/** Recent hits per key, for every limiter at once; swept as it is used. */
const hits = new Map<string, number[]>();
let lastSweep = 0;

function sweep(now: number, longestMs: number) {
  if (now - lastSweep < 60_000) return;
  lastSweep = now;
  for (const [key, times] of hits) {
    if (times.length === 0 || now - times[times.length - 1]! > longestMs) hits.delete(key);
  }
}

/**
 * At most `max` calls per `windowMs` per person, on a sliding window.
 *
 * Per process: with two instances the effective limit doubles, which is fine
 * for a guard against bursts. The allowance, which is what money depends on,
 * is not per process.
 */
export function burst(name: string, max: number, windowMs: number): RequestHandler {
  return (req, res, next) => {
    const now = Date.now();
    sweep(now, 24 * 60 * 60_000);
    const key = `${name}:${who(req)}`;
    const recent = (hits.get(key) ?? []).filter(at => now - at < windowMs);

    if (recent.length >= max) {
      const wait = Math.ceil((windowMs - (now - recent[0]!)) / 1000);
      res.setHeader("Retry-After", String(wait));
      hits.set(key, recent);
      next(new HttpError(429, `That was a lot at once. Try again in ${wait < 90 ? `${wait} seconds` : `${Math.ceil(wait / 60)} minutes`}.`));
      return;
    }

    recent.push(now);
    hits.set(key, recent);
    next();
  };
}

/**
 * At most `max` calls per person per UTC day, for the open voice routes that
 * have no account to hang a monthly allowance on. In memory, like `burst`: a
 * restart forgives the day, which costs little on routes this cheap.
 */
export function daily(name: string, max: number, what: string): RequestHandler {
  return (req, _res, next) => {
    const day = new Date().toISOString().slice(0, 10);
    const key = `${name}:${day}:${who(req)}`;
    const used = hits.get(key)?.length ?? 0;
    if (used >= max) {
      next(new HttpError(429, `That is today's ${what}. It resets at midnight UTC.`));
      return;
    }
    hits.set(key, [...(hits.get(key) ?? []), Date.now()]);
    next();
  };
}

/** The plan this account is on, as the subscriptions table says. */
export async function planOf(userId: string): Promise<Plan> {
  return (await getActiveSubscription(userId))?.plan ?? "free";
}

const NAMES: Record<AiKind, { one: string; many: string }> = {
  editor: { one: "design", many: "designs from the editor" },
  polish: { one: "pass", many: "copy-desk passes" },
};

/**
 * Spends one of this month's `kind`, or refuses with a 402 that says what the
 * plan includes. Returns the meter after the claim.
 */
export async function claimAi(userId: string, plan: Plan, kind: AiKind): Promise<Meter> {
  const limit = PLAN_LIMITS[plan][kind];
  if (limit <= 0) {
    throw new HttpError(402, `${NAMES[kind].many[0]!.toUpperCase()}${NAMES[kind].many.slice(1)} come with Traveller and Cartographer.`);
  }

  const { data, error } = await admin().rpc("claim_ai", { p_user: userId, p_kind: kind, p_limit: limit });
  if (error) throw new HttpError(500, `Could not check your allowance: ${error.message}`);
  const claim = (Array.isArray(data) ? data[0] : data) as { used: number; granted: boolean } | undefined;
  if (!claim) throw new HttpError(500, "Could not check your allowance.");

  if (!claim.granted) {
    const next = plan === "free" ? " Traveller includes more each month." : plan === "traveller" ? " Cartographer includes more each month." : "";
    throw new HttpError(402, `That is all ${limit} of this month's ${NAMES[kind].many}.${next} The count starts again on the 1st.`);
  }
  return { used: claim.used, limit, remaining: Math.max(0, limit - claim.used) };
}

/**
 * Gives back a claim whose call failed before the reader got anything. Best
 * effort: a failed release leaves the reader one short, which is the lesser
 * error than failing the request a second time over it.
 */
export async function releaseAi(userId: string, kind: AiKind): Promise<void> {
  const { error } = await admin().rpc("release_ai", { p_user: userId, p_kind: kind });
  if (error) console.error(`[limits] could not release a ${kind} claim:`, error.message);
}

/** This month's use of every allowance, without spending any of it. */
export async function allowanceOf(userId: string): Promise<AiAllowance> {
  const plan = await planOf(userId);
  const month = new Date().toISOString().slice(0, 7) + "-01";
  const { data, error } = await admin().from("ai_usage").select("kind, used, period_start").eq("user_id", userId);
  if (error) throw new HttpError(500, `Could not read your allowance: ${error.message}`);

  const meter = (kind: AiKind): Meter => {
    const row = (data ?? []).find(entry => entry.kind === kind && entry.period_start === month);
    const limit = PLAN_LIMITS[plan][kind];
    const used = row?.used ?? 0;
    return { used, limit, remaining: Math.max(0, limit - used) };
  };
  return { plan, words: PLAN_LIMITS[plan].words, editor: meter("editor"), polish: meter("polish") };
}
