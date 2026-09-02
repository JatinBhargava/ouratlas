import { Picture } from "@/components/picture";
import { cn } from "@/lib/utils";
import { PHOTO_SWATCHES } from "@/lib/palette";
import { SAMPLE_PHOTOS, type SamplePhoto } from "@/lib/sample-photos";

/**
 * Body copy on the mock page. Set small and justified so it reads as a column
 * of a real magazine rather than as filler.
 */
function Column({ children, dropCap = false }: { children: string; dropCap?: boolean }) {
  return (
    <p
      className={cn(
        "hyphens-auto text-justify text-[8px] leading-[1.6] text-stone-600 sm:text-[7.5px]",
        // A true drop cap: the letter floats and the copy sets around it.
        dropCap &&
          "[&::first-letter]:font-editorial [&::first-letter]:float-left [&::first-letter]:mr-1 [&::first-letter]:pt-px [&::first-letter]:text-[26px] [&::first-letter]:leading-[0.78] [&::first-letter]:text-stone-800",
      )}
    >
      {children}
    </p>
  );
}

/**
 * A photograph in the mock spread. The swatch sits behind as a coloured
 * placeholder so the layout never flashes white while the file loads.
 */
function Plate({ src, swatch, className }: { src: SamplePhoto; swatch: string; className?: string }) {
  return (
    <Picture
      photo={src}
      alt=""
      decoding="async"
      className={cn("w-full bg-linear-to-br object-cover", swatch, className)}
    />
  );
}

/**
 * Shows what the product makes: an open magazine spread — rubric, headline,
 * byline, drop cap, columns and folios — with a few loose prints drifting in.
 */
export function AlbumPreview() {
  return (
    <div className="relative mx-auto w-full max-w-3xl select-none" aria-hidden>
      {/* Loose prints, as if not yet placed on the page. */}
      <div className="animate-drift-slow absolute -top-6 -left-4 z-20 hidden sm:block">
        <div className="w-28 rotate-[-9deg] rounded-lg bg-white p-1.5 shadow-xl shadow-black/20">
          <Plate src={SAMPLE_PHOTOS.rooftops} swatch={PHOTO_SWATCHES[1]} className="aspect-4/5 rounded" />
        </div>
      </div>
      <div className="animate-drift absolute -right-7 -bottom-12 z-20 hidden sm:block">
        <div className="w-24 rotate-[7deg] rounded-lg bg-white p-1.5 shadow-xl shadow-black/20">
          <Plate src={SAMPLE_PHOTOS.palms} swatch={PHOTO_SWATCHES[2]} className="aspect-square rounded" />
        </div>
      </div>

      {/* The spread. */}
      <div className="animate-drift-slower grid grid-cols-1 overflow-hidden rounded-2xl bg-white shadow-2xl shadow-black/25 ring-1 ring-black/5 sm:grid-cols-2">
        {/* Verso: the picture, given the whole page. */}
        <div className="flex flex-col gap-2.5 border-stone-200 p-5 sm:border-r">
          <Plate src={SAMPLE_PHOTOS.gull} swatch={PHOTO_SWATCHES[0]} className="aspect-4/3 rounded-lg" />
          <p className="text-[10px] tracking-[0.2em] text-stone-400 uppercase">Plate I — the ridge at dawn</p>
          <Column>
            He came out of the glare without a sound and hung there, close enough that we could see the wind moving
            through his feathers. Nobody reached for a camera until it was nearly too late.
          </Column>
          <span className="mt-auto pt-3 text-[10px] text-stone-400 tabular-nums">14</span>
        </div>

        {/* Recto: the feature itself. */}
        <div className="flex flex-col gap-2.5 p-5">
          <span className="text-[10px] font-medium tracking-[0.24em] text-stone-400 uppercase">Feature</span>
          <p className="font-editorial text-2xl leading-[1.15] text-stone-900">
            We walked out before the light came up
          </p>
          <p className="text-[11px] tracking-wide text-stone-400 italic">Words and pictures — you</p>

          <Column dropCap>
            We left the hut at four, when the valley below was still only a rumour and the loudest thing on the mountain
            was our own boots on the loose stone. For the first hour nobody spoke. There was nothing worth saying that
            the light was not already saying better, and we had all agreed, without agreeing, to let it.
          </Column>

          <div className="grid grid-cols-2 gap-2 pt-0.5">
            <Plate src={SAMPLE_PHOTOS.daisies} swatch={PHOTO_SWATCHES[2]} className="aspect-square rounded-lg" />
            <Plate src={SAMPLE_PHOTOS.cafeTerrace} swatch={PHOTO_SWATCHES[3]} className="aspect-square rounded-lg" />
          </div>

          <Column>
            By eight we were down among the olive terraces and somebody produced a thermos. That is the part of the day
            I remember most clearly, and the part I took no pictures of at all.
          </Column>

          <span className="mt-auto pt-3 text-[10px] text-stone-400 tabular-nums">15</span>
        </div>
      </div>
    </div>
  );
}
