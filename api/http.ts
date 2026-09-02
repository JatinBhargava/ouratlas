/**
 * Express plumbing: one error shape, one way to write a handler.
 *
 * Handlers throw `HttpError` for anything the caller should read and let
 * ordinary exceptions bubble; `errorHandler` turns both into the `{ error }`
 * body the client already expects from `/api/polish`.
 */

import type { ErrorRequestHandler, NextFunction, Request, RequestHandler, Response } from "express";
import type { User } from "@supabase/supabase-js";

/** Attached by `authenticate`; present only on routes behind it. */
declare global {
  namespace Express {
    interface Request {
      user?: User;
    }
  }
}

/** Carries the status a failure should be reported with. */
export class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "HttpError";
  }
}

/**
 * A feature switched off because the server was not given its keys.
 *
 * `feature` carries its own verb ("Billing is", "Accounts are") so each call
 * site reads as a sentence rather than forcing every feature to be singular.
 */
export function unconfigured(feature: string, vars: string): HttpError {
  return new HttpError(503, `${feature} switched off: this server has no ${vars} set.`);
}

/**
 * Wraps an async handler so a rejected promise reaches `errorHandler`.
 *
 * Express 5 forwards rejections on its own, but saying so at each route keeps
 * that guarantee visible rather than resting on framework version.
 */
export function asyncRoute(handler: (req: Request, res: Response) => Promise<unknown>): RequestHandler {
  return (req, res, next) => {
    handler(req, res).catch(next);
  };
}

/**
 * The single place a failure becomes a response.
 *
 * An `HttpError` was written for the person using the site, so it is sent on
 * as-is. Anything else is unexpected and may quote an upstream body we have
 * not vetted for secrets, so it is logged in full and reported as a generic
 * 500.
 */
export const errorHandler: ErrorRequestHandler = (error, _req, res, next) => {
  if (res.headersSent) {
    // The response is already streaming; the only remaining signal is to break
    // the connection, which is what Express's default handler does.
    next(error);
    return;
  }

  if (error instanceof HttpError) {
    res.status(error.status).json({ error: error.message });
    return;
  }

  console.error("[api] unhandled:", error);
  res.status(500).json({ error: "Something went wrong on our end." });
};

/** Unmatched `/api/*` paths, so a typo returns JSON rather than the SPA shell. */
export const notFound = (_req: Request, res: Response, _next: NextFunction) => {
  res.status(404).json({ error: "No such endpoint." });
};
