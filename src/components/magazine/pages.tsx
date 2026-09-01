import { COPY_CLASS, paragraphsHtml, type Slice } from "@/lib/magazine/copy";
import {
  CAPTION,
  COLUMN_WIDTH,
  GUTTER,
  MARGIN,
  PAGE,
  TEXT_HEIGHT,
  TEXT_WIDTH,
} from "@/lib/magazine/geometry";
import { HALF_PLATE, OPENER_HEAD, OPENER_PLATE, STACK_GAP, type TemplateId } from "@/lib/magazine/templates";
import type { Page, Plate } from "@/lib/magazine/types";
import { cn } from "@/lib/utils";

/**
 * The printed page. Every layout here draws from the same constants the fitter
 * measured against, so what was measured is what appears.
 */

/** A box of body copy, clipped to the height it was fitted to. */
function Copy({ slice, height, dropCap }: { slice: Slice | undefined; height: number; dropCap?: boolean }) {
  if (!slice) return null;
  return (
    <div
      className={cn(COPY_CLASS, "flow-root overflow-hidden")}
      style={{ width: COLUMN_WIDTH, height }}
      dangerouslySetInnerHTML={{ __html: paragraphsHtml(slice, { dropCap }) }}
    />
  );
}

/** The two-column text row shared by most layouts. */
function Columns({ page, height, from = 0 }: { page: Page; height: number; from?: number }) {
  return (
    <div className="flex" style={{ gap: GUTTER }}>
      <Copy slice={page.slices[from]} height={height} dropCap={page.dropCap} />
      <Copy slice={page.slices[from + 1]} height={height} />
    </div>
  );
}

const CAPTION_CLASS = "truncate text-[7px] tracking-[0.14em] text-stone-400 uppercase";

/** A photograph with its plate number set beneath it. */
function PlateFigure({ plate, width, height }: { plate: Plate | undefined; width: number; height: number }) {
  if (!plate) return <div style={{ width, height }} />;
  return (
    <figure className="flex flex-col" style={{ width, height }}>
      <img
        src={plate.photo.url}
        alt=""
        className="w-full rounded-[2px] bg-stone-200 object-cover"
        style={{ height: height - CAPTION }}
      />
      <figcaption className={cn(CAPTION_CLASS, "pt-[5px]")} style={{ height: CAPTION }}>
        {plate.label}
      </figcaption>
    </figure>
  );
}

const KICKER = "text-[8px] font-medium tracking-[0.28em] text-stone-400 uppercase";
const HEADLINE = "font-editorial text-stone-900";

function Cover({ page, title, dateline }: { page: Page; title: string; dateline: string }) {
  const plate = page.plates[0];
  return (
    <div className="relative size-full overflow-hidden bg-stone-900">
      {plate && <img src={plate.photo.url} alt="" className="size-full object-cover" />}
      {/* Keeps the masthead legible whatever the photograph is doing. */}
      <div className="absolute inset-0 bg-linear-to-b from-black/55 via-black/10 to-black/70" />
      <div className="absolute inset-0 flex flex-col justify-between" style={{ padding: MARGIN }}>
        <div className="flex items-baseline justify-between text-white/85">
          <span className="font-editorial text-[22px] leading-none">Atlas</span>
          <span className="text-[8px] tracking-[0.28em] uppercase">{dateline}</span>
        </div>
        <div className="flex flex-col gap-2">
          <span className="text-[8px] font-medium tracking-[0.28em] text-white/70 uppercase">The issue</span>
          <h1 className="font-editorial text-[40px] leading-[1.02] text-balance text-white">{title}</h1>
        </div>
      </div>
    </div>
  );
}

function Contents({ page, title, dateline }: PageProps) {
  return (
    <div className="flex h-full flex-col">
      <span className="font-editorial text-[30px] leading-none text-stone-900">Atlas</span>
      <p className="mt-2 text-[8px] tracking-[0.28em] text-stone-400 uppercase">{dateline}</p>
      <div className="mt-5 h-px bg-stone-300" style={{ width: COLUMN_WIDTH }} />

      {/* Set well below the opener's headline: this page faces it, and two
          headlines of the same size on one spread read as a mistake. */}
      <span className={cn(KICKER, "mt-6")}>In this issue</span>
      <h2 className={cn(HEADLINE, "mt-2 text-[17px] leading-[1.2] text-balance")} style={{ width: COLUMN_WIDTH * 1.3 }}>
        {title}
      </h2>

      {(page.entries?.length ?? 0) > 0 && (
        <div className="mt-auto flex flex-col gap-1" style={{ width: COLUMN_WIDTH }}>
          <span className={cn(KICKER, "mb-1")}>Plates</span>
          {page.entries!.map(entry => (
            <span key={entry.label} className="flex items-baseline gap-2 text-[9px] text-stone-500">
              {entry.label}
              <span aria-hidden className="min-w-4 grow border-b border-dotted border-stone-300" />
              <span className="tabular-nums">{entry.folio}</span>
            </span>
          ))}
        </div>
      )}

      <p className="mt-6 text-[8px] tracking-[0.14em] text-stone-400 uppercase">
        Words and pictures — you · Set with Atlas
      </p>
    </div>
  );
}

function Opener({ page, title }: { page: Page; title: string }) {
  return (
    <div className="flex h-full flex-col" style={{ gap: STACK_GAP }}>
      {/* Fixed height, so the columns below start where the fitter expects.
          The headline is clamped for the same reason: a long title would
          otherwise push the copy off the page. */}
      <div className="flex flex-col justify-end" style={{ height: OPENER_HEAD }}>
        <span className={KICKER}>Feature</span>
        <h2 className={cn(HEADLINE, "mt-2 line-clamp-2 text-[34px] leading-[1.04] text-balance")}>{title}</h2>
        <p className="mt-2 text-[9px] text-stone-400 italic">Words and pictures — you</p>
      </div>
      <PlateFigure plate={page.plates[0]} width={TEXT_WIDTH} height={OPENER_PLATE} />
      <Columns page={page} height={TEXT_HEIGHT - OPENER_HEAD - OPENER_PLATE - STACK_GAP * 2} />
    </div>
  );
}

function PlateAbove({ page }: { page: Page }) {
  return (
    <div className="flex h-full flex-col" style={{ gap: STACK_GAP }}>
      <PlateFigure plate={page.plates[0]} width={TEXT_WIDTH} height={HALF_PLATE} />
      <Columns page={page} height={TEXT_HEIGHT - HALF_PLATE - STACK_GAP} />
    </div>
  );
}

function PlateBelow({ page }: { page: Page }) {
  return (
    <div className="flex h-full flex-col" style={{ gap: STACK_GAP }}>
      <Columns page={page} height={TEXT_HEIGHT - HALF_PLATE - STACK_GAP} />
      <PlateFigure plate={page.plates[0]} width={TEXT_WIDTH} height={HALF_PLATE} />
    </div>
  );
}

function PlateBeside({ page }: { page: Page }) {
  return (
    <div className="flex h-full" style={{ gap: GUTTER }}>
      <PlateFigure plate={page.plates[0]} width={COLUMN_WIDTH} height={TEXT_HEIGHT} />
      <Copy slice={page.slices[0]} height={TEXT_HEIGHT} />
    </div>
  );
}

/** A plate given the whole page, run to the trim on every side. */
function FullPlate({ page }: { page: Page }) {
  const plate = page.plates[0];
  if (!plate) return <div className="size-full bg-stone-100" />;
  return (
    <div className="relative size-full overflow-hidden bg-stone-200">
      <img src={plate.photo.url} alt="" className="size-full object-cover" />
      <span
        className="absolute bottom-0 left-0 bg-white/85 px-2 py-1 text-[7px] tracking-[0.14em] text-stone-500 uppercase"
        style={{ marginLeft: MARGIN, marginBottom: MARGIN }}
      >
        {plate.label}
      </span>
    </div>
  );
}

function PairedPlates({ page }: { page: Page }) {
  const half = (TEXT_HEIGHT - STACK_GAP) / 2;
  return (
    <div className="flex h-full flex-col" style={{ gap: STACK_GAP }}>
      <PlateFigure plate={page.plates[0]} width={TEXT_WIDTH} height={half} />
      <PlateFigure plate={page.plates[1]} width={TEXT_WIDTH} height={half} />
    </div>
  );
}

/** A leaf left empty to keep the colophon on a recto. Folio still prints. */
function Blank() {
  return <div className="size-full" />;
}

function Colophon({ page, title, dateline }: { page: Page; title: string; dateline: string }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
      <span className={KICKER}>Colophon</span>
      <h2 className={cn(HEADLINE, "text-[22px] leading-[1.1] text-balance")}>{title}</h2>
      <p className="text-[9px] text-stone-500">{dateline}</p>
      <div className="my-2 h-px w-16 bg-stone-300" />
      <p className="max-w-[300px] text-[9px] leading-[1.6] text-stone-500">
        Set with Atlas. The photographs and the words were laid out in your browser and were never uploaded to us.
      </p>
    </div>
  );
}

type PageProps = { page: Page; title: string; dateline: string };

const LAYOUTS: Record<TemplateId, (props: PageProps) => React.ReactNode> = {
  cover: Cover,
  contents: Contents,
  opener: ({ page, title }) => <Opener page={page} title={title} />,
  "two-column": ({ page }) => <Columns page={page} height={TEXT_HEIGHT} />,
  "plate-above": ({ page }) => <PlateAbove page={page} />,
  "plate-below": ({ page }) => <PlateBelow page={page} />,
  "plate-beside": ({ page }) => <PlateBeside page={page} />,
  "full-plate": ({ page }) => <FullPlate page={page} />,
  "paired-plates": ({ page }) => <PairedPlates page={page} />,
  blank: Blank,
  colophon: Colophon,
};

/** Layouts that run to the trim and so take no margin or folio. */
const BLEEDS = new Set<TemplateId>(["cover", "full-plate"]);

/** One page of the issue, drawn at full size. Scale it from the outside. */
export function MagazinePage({ page, title, dateline }: PageProps) {
  const Layout = LAYOUTS[page.template];
  const bleeds = BLEEDS.has(page.template);

  return (
    <div
      className="relative shrink-0 overflow-hidden bg-white"
      style={{ width: PAGE.width, height: PAGE.height }}
    >
      <div className="size-full" style={bleeds ? undefined : { padding: MARGIN, paddingBottom: MARGIN }}>
        {bleeds ? (
          <Layout page={page} title={title} dateline={dateline} />
        ) : (
          <div style={{ height: TEXT_HEIGHT }}>
            <Layout page={page} title={title} dateline={dateline} />
          </div>
        )}
      </div>

      {!bleeds && page.folio !== null && (
        <span
          className="absolute text-[8px] text-stone-400 tabular-nums"
          style={{ left: MARGIN, bottom: MARGIN / 2 }}
        >
          {page.folio}
        </span>
      )}
    </div>
  );
}
