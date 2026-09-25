/**
 * The editor endpoint: photographs and story in, a plan for the issue out.
 *
 * The engine lives in `../editor.ts`; this file checks what arrived before any
 * of it is sent anywhere. The body is larger than any other JSON the API takes
 * — ten small previews — so `app.ts` gives this path its own parser.
 */

import { Router, type RequestHandler } from "express";

import { planIssue } from "@api/editor";
import { asyncRoute, HttpError } from "@api/http";
import { allowanceOf, burst, claimAi, planOf, releaseAi } from "@api/limits";
import { authenticate } from "@api/supabase";
import { countWords, EDITOR_MAX_PHOTOS, EDITOR_NEEDS_SIGN_IN, MAX_STORY_WORDS, PLAN_LIMITS, type EditorRequest } from "@/types";

export const editorRoutes = Router();

/** Largest JSON body this path accepts; `app.ts` mounts the parser with it. */
export const EDITOR_BODY_LIMIT = "4mb";

/** A preview is a few tens of kilobytes; this refuses a full-size photograph sent by mistake. */
const MAX_PREVIEW_CHARS = 400_000;
/** Room for the longest story any plan allows, at a generous eight characters a word. */
const MAX_STORY_CHARS = MAX_STORY_WORDS * 8;

const gate: RequestHandler = EDITOR_NEEDS_SIGN_IN ? authenticate : (_req, _res, next) => next();

const text = (value: unknown, limit: number) => typeof value === "string" && value.length <= limit;

/** Checks the request field by field; anything off is the client's mistake, so it is a 400. */
function read(body: unknown): EditorRequest {
  const input = (body ?? {}) as Partial<Record<keyof EditorRequest, unknown>>;

  if (!text(input.title, 200)) throw new HttpError(400, "The title could not be read.");
  if (!text(input.story, MAX_STORY_CHARS)) throw new HttpError(413, "That story is too long for the editor.");
  if (!Number.isInteger(input.words) || (input.words as number) < 0) throw new HttpError(400, "The word count could not be read.");
  if (
    !Array.isArray(input.rhythm) ||
    input.rhythm.length > 40 ||
    !input.rhythm.every(slot => slot === "special" || slot === "left" || slot === "right")
  ) {
    throw new HttpError(400, "The page rhythm could not be read.");
  }

  const photos = input.photos;
  if (!Array.isArray(photos) || photos.length === 0) throw new HttpError(400, "Add a photograph for the editor to look at.");
  if (photos.length > EDITOR_MAX_PHOTOS) throw new HttpError(400, `The editor looks at ${EDITOR_MAX_PHOTOS} photographs at most.`);
  for (const photo of photos) {
    const ok =
      text(photo?.id, 8) &&
      text(photo?.preview, MAX_PREVIEW_CHARS) &&
      /^data:image\/(jpeg|png|webp);base64,/.test(photo.preview) &&
      Number.isFinite(photo?.width) &&
      Number.isFinite(photo?.height);
    if (!ok) throw new HttpError(400, "One of the photographs could not be read.");
  }
  if (new Set(photos.map(photo => photo.id)).size !== photos.length) throw new HttpError(400, "Two photographs share a label.");

  const themes = input.themes;
  if (
    !Array.isArray(themes) ||
    themes.length === 0 ||
    themes.length > 12 ||
    !themes.every(
      theme => text(theme?.id, 32) && text(theme?.name, 60) && text(theme?.blurb, 400) && text(theme?.suits, 400),
    )
  ) {
    throw new HttpError(400, "The list of styles could not be read.");
  }

  const faces = input.faces;
  if (
    !Array.isArray(faces) ||
    faces.length === 0 ||
    faces.length > 16 ||
    !faces.every(face => text(face?.id, 32) && text(face?.name, 60) && typeof face?.body === "boolean") ||
    !faces.some(face => face.body)
  ) {
    throw new HttpError(400, "The list of typefaces could not be read.");
  }

  const layouts = input.layouts;
  if (
    !Array.isArray(layouts) ||
    layouts.length === 0 ||
    layouts.length > 20 ||
    !layouts.every(
      layout =>
        text(layout?.id, 32) &&
        text(layout?.name, 60) &&
        text(layout?.description, 400) &&
        Number.isInteger(layout?.plates) &&
        Number.isInteger(layout?.quotes) &&
        Number.isFinite(layout?.minShare) &&
        Number.isFinite(layout?.maxShare),
    )
  ) {
    throw new HttpError(400, "The list of page layouts could not be read.");
  }

  return input as EditorRequest;
}

editorRoutes.post(
  "/editor",
  gate,
  // Three in ten minutes is more than anyone asks for by hand — a design takes
  // half a minute to arrive — and fewer than a script would like.
  burst("editor", 3, 10 * 60_000),
  asyncRoute(async (req, res) => {
    // Read before anything is spent: a malformed request is the client's
    // mistake and should not cost the reader a design.
    const request = read(req.body);
    const userId = req.user?.id;

    // Counted when there is someone to count against. With sign-in switched
    // off (`EDITOR_NEEDS_SIGN_IN`) there is no account, and the burst limit
    // above is the only guard — which is why it is on.
    if (!userId) {
      res.setHeader("cache-control", "no-store");
      res.json(await planIssue(request));
      return;
    }

    const plan = await planOf(userId);
    const words = countWords(request.story);
    if (words > PLAN_LIMITS[plan].words) {
      throw new HttpError(413, `Your plan sets stories of up to ${PLAN_LIMITS[plan].words.toLocaleString("en")} words; this one has ${words.toLocaleString("en")}.`);
    }

    await claimAi(userId, plan, "editor");
    let result;
    try {
      result = await planIssue(request);
    } catch (error) {
      // Nothing reached the reader, so the design is not theirs to lose.
      await releaseAi(userId, "editor");
      throw error;
    }
    res.setHeader("cache-control", "no-store");
    res.json(result);
  }),
);

/** What this account has left this month, for the desk to show beside the buttons. */
editorRoutes.get(
  "/ai/allowance",
  authenticate,
  asyncRoute(async (req, res) => {
    res.setHeader("cache-control", "no-store");
    res.json(await allowanceOf(req.user!.id));
  }),
);
