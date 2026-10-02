/**
 * The shape of a Journal post (`/blog`), shared by the compiler that writes
 * the posts (`scripts/blog.ts`), the build that gives each its own HTML, and
 * the pages that draw them.
 *
 * Plain data and one type import, so `scripts/blog.ts` and `build.ts` can
 * read it without pulling in React.
 */

import type { Head } from "../seo";

/**
 * What a post is for, which decides how it is written and where it is filed.
 *
 * - `guide`: answers something people search for (making a wedding album,
 *   what to do with trip photos), and shows Atlas only where it genuinely
 *   answers it.
 * - `essay`: about keeping memories at all — print, family, writing — read
 *   for its own sake and shared rather than searched.
 * - `engineering`: how a feature of Atlas works and why it was built that way,
 *   from the code itself.
 */
export type PostKind = "guide" | "essay" | "engineering";

export const POST_KINDS: Record<PostKind, { label: string; plural: string }> = {
  guide: { label: "Guide", plural: "Guides" },
  essay: { label: "Essay", plural: "Essays" },
  engineering: { label: "From the press room", plural: "From the press room" },
};

/** Everything about a post except its body, which is a chunk of its own. */
export type PostMeta = {
  /** The file's name and the address: /blog/<slug>. */
  slug: string;
  /** At most 60 characters, because it is also the page's <title>. */
  title: string;
  /** At most 155 characters, because it is also the page's description. */
  description: string;
  kind: PostKind;
  /** ISO day, "2026-10-01": what the sitemap, the feed and JSON-LD want. */
  date: string;
  /** ISO day of the last real revision, when there has been one. */
  updated?: string;
  tags: string[];
  /** The search the post was written to answer, kept so no two posts chase the same one. */
  keyword?: string;
  /** For engineering posts: the version in `versions.json` whose feature the post explains. */
  feature?: string;
  /** At about 220 words a minute, rounded up. */
  minutes: number;
};

/**
 * A post's head. `build.ts` writes it into the post's HTML and the post page
 * writes it into the live document, so the two cannot disagree.
 */
export function postHead(meta: PostMeta): Head {
  return { title: meta.title, description: meta.description, index: true };
}

/** "2026-10-01" as the rest of the site prints a date: "1 October 2026". */
export function printDate(iso: string): string {
  const [year, month, day] = iso.split("-").map(Number);
  const months = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
  ];
  return `${day} ${months[(month ?? 1) - 1]} ${year}`;
}
