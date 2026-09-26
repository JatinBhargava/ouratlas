/**
 * The browser's side of the layout directory: the calls, and turning a
 * picture into the sample a submission carries.
 */

import { api } from "@/lib/api";
import {
  LAYOUT_LIMITS,
  type LayoutKind,
  type LayoutList,
  type LayoutSort,
  type LayoutStatus,
  type LayoutSubmission,
  type LikeResult,
  type OwnLayout,
  type OwnLayoutList,
  type ReviewDecision,
  type ReviewList,
  type ReviewResult,
} from "@/types";

export const listLayouts = (kind: LayoutKind, sort: LayoutSort) => api.get<LayoutList>(`/api/layouts?kind=${kind}&sort=${sort}`);
export const myLayouts = () => api.get<OwnLayoutList>("/api/layouts/mine");
export const getLayout = (id: string) => api.get<OwnLayout>(`/api/layouts/${encodeURIComponent(id)}`);
export const submitLayout = (submission: LayoutSubmission) => api.post<OwnLayout>("/api/layouts", submission);
export const withdrawLayout = (id: string) => api.delete<{ ok: true }>(`/api/layouts/${encodeURIComponent(id)}`);
export const toggleLike = (id: string) => api.post<LikeResult>(`/api/layouts/${encodeURIComponent(id)}/like`);
export const reviewQueue = (status: LayoutStatus) => api.get<ReviewList>(`/api/admin/layouts?status=${status}`);
export const reviewLayout = (id: string, decision: ReviewDecision) =>
  api.post<ReviewResult>(`/api/admin/layouts/${encodeURIComponent(id)}/review`, decision);

/** The longest side a sample is kept at: plenty for a directory card, small enough to send. */
const SAMPLE_EDGE = 1600;

/** Decoded size of a data URL, near enough. */
const bytesOf = (dataUrl: string) => Math.ceil(((dataUrl.length - dataUrl.indexOf(",") - 1) * 3) / 4);

/** A canvas as a JPEG data URL under the server's limit, stepping quality down if it has to. */
export function canvasToSample(canvas: HTMLCanvasElement): string {
  for (const quality of [0.86, 0.76, 0.66, 0.55]) {
    const url = canvas.toDataURL("image/jpeg", quality);
    if (bytesOf(url) <= LAYOUT_LIMITS.sampleBytes) return url;
  }
  throw new Error("That picture is too detailed to send. Try a smaller one.");
}

/** A picture the reader attached, scaled down and re-encoded, so a 12-megapixel photo becomes a sample. */
export async function fileToSample(file: File): Promise<string> {
  if (!file.type.startsWith("image/")) throw new Error("Attach a picture: a JPEG, PNG or WebP.");
  const bitmap = await createImageBitmap(file).catch(() => {
    throw new Error(`${file.name} could not be opened. Try a JPEG or PNG.`);
  });
  const scale = Math.min(1, SAMPLE_EDGE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const context = canvas.getContext("2d");
  if (!context) throw new Error("This browser could not prepare the picture.");
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  try {
    return canvasToSample(canvas);
  } finally {
    canvas.width = 0;
    canvas.height = 0;
  }
}
