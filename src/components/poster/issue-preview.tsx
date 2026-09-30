import { useMemo } from "react";
import { Dialog } from "radix-ui";
import { Download, Loader2, X } from "lucide-react";

import { IssueView } from "@/components/magazine/issue-view";
import { Sheet } from "@/components/poster/box-view";
import { Button } from "@/components/ui/button";
import { DEFAULT_THEME } from "@/lib/magazine/themes";
import type { Issue, Page } from "@/lib/magazine/types";
import type { Photo, PosterDoc } from "@/lib/poster/model";

/**
 * The whole issue as a reader will hold it: the cover on its own, then every
 * page after it as verso and recto, turned like the finished magazine.
 *
 * It is the desk's own book (`IssueView`, the one `/read` opens a saved issue
 * in) rather than a second viewer built for the studio, so a page turns here
 * exactly as it will once it is printed or shared. The book asks for an issue
 * but, handed `drawPage`, reads only each page's place and folio from it; the
 * pages themselves are drawn by `Sheet`, the same renderer as the editor and
 * the press, so the preview cannot show a page the PDF would not.
 */
export function IssuePreview({
  doc,
  photos,
  exporting,
  onDownload,
  onClose,
}: {
  doc: PosterDoc;
  photos: Record<string, Photo>;
  exporting: boolean;
  onDownload: () => void;
  onClose: () => void;
}) {
  const issue = useMemo<Issue>(
    () => ({
      // Read only by a page the book sets itself; these are all drawn.
      title: "",
      dateline: "",
      // Keyed by the studio page's own id, so a page turned to stays put if
      // the document changes under the preview.
      pages: doc.pages.map<Page>((item, index) => ({
        id: item.id,
        index,
        template: index === 0 ? "cover" : "blank",
        plates: [],
        plate: { width: 0, height: 0 },
        slices: [],
        folio: index === 0 ? null : index,
      })),
      words: 0,
      overflowWords: 0,
      polished: false,
      theme: DEFAULT_THEME,
    }),
    [doc.pages],
  );

  const byId = useMemo(() => new Map(doc.pages.map(item => [item.id, item])), [doc.pages]);
  const spreads = doc.pages.length <= 1 ? 1 : 1 + Math.ceil((doc.pages.length - 1) / 2);

  return (
    <Dialog.Root open onOpenChange={open => !open && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-70 bg-stone-950/85 backdrop-blur-sm" />
        <Dialog.Content
          className="fixed inset-0 z-70 flex flex-col gap-6 overflow-y-auto px-4 py-5 sm:px-8 sm:py-8"
          onOpenAutoFocus={event => event.preventDefault()}
        >
          <header className="flex items-start justify-between gap-4">
            <div className="flex flex-col gap-1">
              <span className="text-[10px] font-medium tracking-[0.28em] text-white/60 uppercase">The proof</span>
              <Dialog.Title className="font-editorial text-3xl tracking-tight text-white">Your issue, bound</Dialog.Title>
              <Dialog.Description className="text-sm text-white/75">
                {doc.pages.length} {doc.pages.length === 1 ? "page" : "pages"} in {spreads} {spreads === 1 ? "spread" : "spreads"}: the cover
                stands alone, and every page after it faces its neighbour as it will in print.
              </Dialog.Description>
            </div>
            <div className="flex shrink-0 gap-2">
              <Button size="sm" className="h-9 rounded-full px-4" disabled={exporting} onClick={onDownload} aria-label="Download PDF">
                {exporting ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
                <span className="hidden sm:inline">Download PDF</span>
              </Button>
              <Dialog.Close asChild>
                <Button variant="secondary" size="icon" className="size-9 rounded-full" aria-label="Back to editing" title="Back to editing">
                  <X className="size-4" />
                </Button>
              </Dialog.Close>
            </div>
          </header>

          <IssueView
            issue={issue}
            className="my-auto"
            drawPage={leaf => {
              const page = byId.get(leaf.id);
              return page ? <Sheet page={page} photos={photos} /> : null;
            }}
          />
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
