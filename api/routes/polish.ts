/**
 * The copy desk endpoint.
 *
 * Streams the edited story back as plain text so a long trip does not sit
 * behind a spinner. The engine lives in `../polish.ts`; this file is only the
 * HTTP shape of it.
 */

import { Router } from "express";

import { asyncRoute, HttpError } from "@api/http";
import { activeProvider, editPass, isMode, MAX_CHARS, toPasses, UpstreamError } from "@api/polish";
import { authenticate, getActiveSubscription } from "@api/supabase";
import { hasCopyDesk } from "@/types";

export const polishRoutes = Router();

polishRoutes.post(
  "/polish",
  // The only route in the app that costs money per call, so it is the only
  // one that needs to know who is asking.
  authenticate,
  asyncRoute(async (req, res) => {
    // Entitlement before configuration: someone on the free plan should be
    // told about their plan, not about this server's API keys.
    //
    // Checked here against the database rather than trusted from the request,
    // because the browser is told the same thing only so it can grey a button
    // out — the copy desk itself is bought and sold here.
    const subscription = await getActiveSubscription(req.user!.id);
    if (!subscription || !hasCopyDesk(subscription.plan)) {
      throw new HttpError(
        402,
        "The copy desk comes with Traveller and Cartographer. Everything else — the pages, the layout, the export — stays yours on Wanderer.",
      );
    }

    // Either provider will do. Which one is settled in `api/env.ts` from the
    // keys present, so this route only needs to know whether there is one.
    const provider = activeProvider();
    if (!provider) {
      throw new HttpError(503, "Polishing is switched off: this server has no OPENAI_API_KEY or ANTHROPIC_API_KEY set.");
    }

    const body = req.body as { story?: unknown; mode?: unknown } | undefined;
    const story = body?.story;

    // An unknown or absent mode falls back to the editing pass rather than
    // being rejected: it is the older behaviour and the harmless one, and a
    // client too old to send a mode should still get its copy edit.
    const mode = isMode(body?.mode) ? body.mode : "edit";

    if (typeof story !== "string" || story.trim().length === 0) throw new HttpError(400, "Nothing to edit.");
    if (story.length > MAX_CHARS) throw new HttpError(413, "That story is too long to edit in one go.");

    const passes = toPasses(story, mode);

    // Run the first pass far enough to know it works. A bad key or a rate
    // limit discovered after the response has started can only break the
    // stream; found here it is still an ordinary error with a status and a
    // message somebody can read.
    const opening = editPass(passes[0]!.text, provider, mode);
    let head: IteratorResult<string>;
    try {
      head = await opening.next();
    } catch (error) {
      if (error instanceof UpstreamError) throw new HttpError(error.status === 429 ? 429 : 502, error.message);
      throw new HttpError(502, "The copy desk could not be reached.");
    }

    res.status(200);
    res.setHeader("content-type", "text/plain; charset=utf-8");
    res.setHeader("cache-control", "no-store");
    // Nothing between here and the browser should buffer the passes back into
    // one lump; the point of streaming is that the text appears as it is set.
    res.setHeader("x-accel-buffering", "no");
    res.flushHeaders();

    try {
      if (!head.done) res.write(head.value);
      for await (const delta of opening) res.write(delta);

      for (const pass of passes.slice(1)) {
        res.write(pass.separator);
        for await (const delta of editPass(pass.text, provider, mode)) res.write(delta);
      }
      res.end();
    } catch (error) {
      // The response has already begun, so a status is no longer available.
      // Breaking the connection is the only signal left, and the client reads
      // a truncated stream as a failed edit.
      console.error("[polish] stream failed mid-flight:", error);
      res.destroy(error instanceof Error ? error : new Error("stream failed"));
    }
  }),
);
