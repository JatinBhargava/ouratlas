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
import { authenticate } from "@api/supabase";
import { EDITOR_MAX_PHOTOS, EDITOR_NEEDS_SIGN_IN, type EditorRequest } from "@/types";

export const editorRoutes = Router();

/** Largest JSON body this path accepts; `app.ts` mounts the parser with it. */
export const EDITOR_BODY_LIMIT = "4mb";

/** A preview is a few tens of kilobytes; this refuses a full-size photograph sent by mistake. */
const MAX_PREVIEW_CHARS = 400_000;
const MAX_STORY_CHARS = 80_000;

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
  // Costs money per call, like the copy desk; open to everyone for now.
  gate,
  asyncRoute(async (req, res) => {
    const plan = await planIssue(read(req.body));
    res.setHeader("cache-control", "no-store");
    res.json(plan);
  }),
);
