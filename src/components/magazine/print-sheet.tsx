import { MagazinePage } from "@/components/magazine/pages";
import type { Issue } from "@/lib/magazine/types";

/**
 * The issue as a stack of leaves, one to a sheet.
 *
 * Hidden on screen and only laid out for print: the reader gets the spread
 * viewer, the printer gets single pages at full size, which is how a PDF of a
 * magazine is actually put together.
 */
export function PrintSheet({
  issue,
  tilt,
  sketches,
}: {
  issue: Issue;
  tilt?: number;
  sketches?: Record<string, string>;
}) {
  return (
    <div className="hidden print:block">
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
            sketches={sketches}
          />
        </div>
      ))}
    </div>
  );
}
