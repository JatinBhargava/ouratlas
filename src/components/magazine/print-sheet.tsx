import type { CSSProperties, Ref } from "react";

import { MagazinePage } from "@/components/magazine/pages";
import { PAGE } from "@/lib/magazine/geometry";
import type { Issue } from "@/lib/magazine/types";

/**
 * Where the sheet sits while a phone draws it into a PDF.
 *
 * Drawing a leaf to an image needs it laid out, and `display: none` lays out
 * nothing. Nor `visibility: hidden`, the way the fitter hides its measuring
 * box: the capture copies each element's computed style, inherited visibility
 * included, and would draw blank pages. So it is fully rendered, just far off
 * the left edge. The width is set so each leaf's wrapper is exactly one page wide.
 */
const OFFSCREEN: CSSProperties = { position: "fixed", top: 0, left: -10000, width: PAGE.width, pointerEvents: "none" };

/**
 * The issue as a stack of leaves, one to a sheet.
 *
 * Hidden on screen and only laid out for print: the reader gets the spread
 * viewer, the printer gets single pages at full size, which is how a PDF of a
 * magazine is actually put together.
 *
 * On a phone, whose print dialog will not keep the page size, the same sheet
 * is laid out `offscreen` instead while its leaves are drawn into a PDF — each
 * direct child of the sheet is one leaf.
 */
export function PrintSheet({
  issue,
  tilt,
  sketches,
  offscreen,
  ref,
}: {
  issue: Issue;
  tilt?: number;
  sketches?: Record<string, string>;
  offscreen?: boolean;
  ref?: Ref<HTMLDivElement>;
}) {
  return (
    <div
      ref={ref}
      aria-hidden={offscreen || undefined}
      className={offscreen ? undefined : "hidden print:block"}
      style={offscreen ? OFFSCREEN : undefined}
    >
      {issue.pages.map(page => (
        <div key={page.id} className="break-inside-avoid break-after-page last:break-after-auto">
          <MagazinePage
            page={page}
            title={issue.title}
            dateline={issue.dateline}
            polished={issue.polished}
            theme={issue.theme}
            tilt={tilt}
            type={issue.type}
            palette={issue.palette}
            sketches={sketches}
          />
        </div>
      ))}
    </div>
  );
}
