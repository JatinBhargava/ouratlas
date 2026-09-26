import { Sheet } from "@/components/poster/box-view";
import { MARGIN, PAGE } from "@/lib/magazine/geometry";
import type { PosterPage } from "@/lib/poster/model";
import { cn } from "@/lib/utils";
import { isPosterDesign, type LayoutDesign, type MagazineDesign, type MagazinePageData } from "@/types";

/**
 * A layout drawn as the template it is: empty frames, placeholder words. Shown
 * beside a sample so the submitter sees exactly what will be published, and
 * in the directory when a sample is gone.
 */

const NO_PHOTOS = {};

function PosterPreview({ page, width }: { page: PosterPage; width: number }) {
  const scale = width / PAGE.width;
  return (
    <div className="relative overflow-hidden rounded-sm ring-1 ring-stone-200" style={{ width, height: PAGE.height * scale }}>
      <div className="pointer-events-none origin-top-left" style={{ transform: `scale(${scale})` }}>
        <Sheet page={page} photos={NO_PHOTOS} />
      </div>
    </div>
  );
}

const MAGAZINE_TONE: Record<MagazinePageData["boxes"][number]["kind"], string> = {
  text: "bg-[repeating-linear-gradient(to_bottom,#a8a29e_0_1px,transparent_1px_5px)]",
  plate: "bg-stone-300",
  sketch: "border border-dashed border-emerald-500 bg-emerald-50",
  quote: "",
};

function MagazinePage({ page, design, width, label }: { page: MagazinePageData; design: MagazineDesign; width: number; label: string }) {
  const scale = width / PAGE.width;
  const paper = design.palette?.paper ?? "#fbf8f2";
  const accent = design.palette?.accent ?? "#b4532a";
  const ink = design.palette?.ink ?? "#1b1a17";
  return (
    <figure className="flex flex-col items-center gap-1">
      <div className="relative overflow-hidden rounded-sm ring-1 ring-stone-200" style={{ width, height: PAGE.height * scale, background: paper }}>
        {page.boxes.map(box => (
          <div
            key={box.id}
            className={cn("absolute", MAGAZINE_TONE[box.kind])}
            style={{
              // Magazine boxes are measured inside the margins, so the margin is added back to place them on the page.
              left: (page.bleed ? box.x : box.x + MARGIN) * scale,
              top: (page.bleed ? box.y : box.y + MARGIN) * scale,
              width: box.width * scale,
              height: box.height * scale,
              background: box.kind === "quote" ? (box.tone === "ink" ? ink : box.tone === "paper" ? paper : accent) : undefined,
              outline: box.kind === "quote" && box.tone === "paper" ? `1px solid ${ink}` : undefined,
            }}
          />
        ))}
      </div>
      <figcaption className="text-[10px] tracking-wide text-stone-500 uppercase">{label}</figcaption>
    </figure>
  );
}

export function LayoutPreview({ design, width = 200 }: { design: LayoutDesign; width?: number }) {
  if (isPosterDesign(design)) {
    const first = design.pages[0];
    return first ? <PosterPreview page={first as unknown as PosterPage} width={width} /> : null;
  }
  const page = Math.round((width - 16) / 3);
  return (
    <div className="flex gap-2">
      <MagazinePage page={design.left} design={design} width={page} label="Left" />
      <MagazinePage page={design.right} design={design} width={page} label="Right" />
      <MagazinePage page={design.special} design={design} width={page} label="Opener" />
    </div>
  );
}
