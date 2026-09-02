/**
 * The newsletter waitlist.
 *
 * Open to anyone — no account needed — so it is the one write path a stranger
 * can reach. It stores an address and where it was typed, and nothing else.
 * The table has no read policy, so the list cannot be enumerated with the
 * public key even though this endpoint can add to it.
 */

import { Router } from "express";

import { asyncRoute, HttpError } from "@api/http";
import { admin } from "@api/supabase";
import type { WaitlistResponse } from "@/types";

export const waitlistRoutes = Router();

/**
 * Deliberately loose. The point is to catch a typo before it becomes a row,
 * not to adjudicate RFC 5321 — the only real test of an address is sending to
 * it.
 */
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** Longest address the spec allows; anything above it is not a mistake. */
const MAX_EMAIL = 254;

/** Where on the site the address was typed, so a mailing can match the promise made. */
const SOURCES = new Set(["footer", "pricing", "create"]);

/** Postgres's unique-violation code. */
const UNIQUE_VIOLATION = "23505";

waitlistRoutes.post(
  "/waitlist",
  asyncRoute(async (req, res) => {
    const body = (req.body ?? {}) as { email?: unknown; source?: unknown };

    if (typeof body.email !== "string") throw new HttpError(400, "Enter an email address.");

    // Stored lower-cased so the unique index on lower(email) and the address
    // as written agree about who is already on the list.
    const email = body.email.trim().toLowerCase();

    if (email.length > MAX_EMAIL || !EMAIL.test(email)) {
      throw new HttpError(400, "That does not look like an email address.");
    }

    const source = typeof body.source === "string" && SOURCES.has(body.source) ? body.source : "footer";

    const { error } = await admin().from("waitlist").insert({ email, source });

    if (error) {
      // Signing up twice is not a failure worth showing anyone; it is the same
      // outcome as the first time.
      if (error.code === UNIQUE_VIOLATION) {
        res.json({ ok: true, alreadySubscribed: true } satisfies WaitlistResponse);
        return;
      }
      throw new HttpError(500, `Could not add you to the list: ${error.message}`);
    }

    res.json({ ok: true, alreadySubscribed: false } satisfies WaitlistResponse);
  }),
);
