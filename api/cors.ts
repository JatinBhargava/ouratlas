/**
 * CORS for the Android and iPhone apps.
 *
 * The website never needs this: Vercel and nginx forward `/api` from the
 * site's own origin, so the browser sees one address. The apps load the same
 * bundle from the phone (`https://localhost`, `capacitor://localhost`) and call
 * the API across origins, and a browser engine refuses to hand them the answer
 * unless the API says that origin may read it.
 *
 * Hand-written rather than the `cors` package: it is one list and three
 * headers, and a dependency would be more to audit than this file.
 */

import type { RequestHandler } from "express";

import { appOrigins } from "@api/env";

/**
 * Every header a client sends on its own. `content-type` covers the JSON and
 * the WAV pieces; `x-transcribe-context` is the tail of the story that
 * `transcribe-file.ts` sends along with each piece of an uploaded recording.
 */
const ALLOWED_HEADERS = "authorization, content-type, x-transcribe-context";

export const cors: RequestHandler = (req, res, next) => {
  const origin = req.headers.origin;

  // The answer depends on who asked, so a cache between here and the phone
  // must not hand one origin's answer to another.
  res.vary("Origin");

  if (origin && appOrigins.has(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    // No Allow-Credentials: sign-in is a bearer token, never a cookie, so there
    // is nothing for the browser to attach and nothing to allow.
  }

  // A preflight asks only whether the real request may follow. Answered here,
  // before any route, so it never reaches `notFound` or a handler that would
  // insist on a body. An origin not on the list gets the same empty 204 without
  // the allow headers, and the browser stops there.
  if (req.method === "OPTIONS") {
    if (origin && appOrigins.has(origin)) {
      res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE");
      res.setHeader("Access-Control-Allow-Headers", ALLOWED_HEADERS);
      // A day: long enough that an app does not preflight every call, short
      // enough that a new header added here reaches phones by tomorrow.
      res.setHeader("Access-Control-Max-Age", "86400");
    }
    res.status(204).end();
    return;
  }

  next();
};
