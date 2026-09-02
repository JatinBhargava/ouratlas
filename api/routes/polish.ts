/**
 * The copy desk endpoint.
 *
 * Streams the edited story back as plain text so a long trip does not sit
 * behind a spinner. The engine lives in `../polish.ts`; this file is only the
 * HTTP shape of it.
 */

import { Router } from "express";

import { asyncRoute, HttpError } from "@api/http";
import { editPass, MAX_CHARS, toPasses, UpstreamError } from "@api/polish";

export const polishRoutes = Router();

polishRoutes.post(
  "/polish",
  asyncRoute(async (req, res) => {
    const key = process.env.ANTHROPIC_API_KEY;
    if (!key) throw new HttpError(503, "Polishing is switched off: this server has no ANTHROPIC_API_KEY set.");

    const story = (req.body as { story?: unknown } | undefined)?.story;

    if (typeof story !== "string" || story.trim().length === 0) throw new HttpError(400, "Nothing to edit.");
    if (story.length > MAX_CHARS) throw new HttpError(413, "That story is too long to edit in one go.");

    const passes = toPasses(story);

    // Run the first pass far enough to know it works. A bad key or a rate
    // limit discovered after the response has started can only break the
    // stream; found here it is still an ordinary error with a status and a
    // message somebody can read.
    const opening = editPass(passes[0]!.text, key);
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
        for await (const delta of editPass(pass.text, key)) res.write(delta);
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
