import cafeTerraceAvif from "@/assets/slideshow/pexels-zak-mogel-2158251013-39106482.avif";
import cafeTerraceJpg from "@/assets/slideshow/pexels-zak-mogel-2158251013-39106482.jpg";
import cityFromHillAvif from "@/assets/slideshow/pexels-iamllwyd-34392991.avif";
import cityFromHillJpg from "@/assets/slideshow/pexels-iamllwyd-34392991.jpg";
import daisiesAvif from "@/assets/slideshow/pexels-sidorov2512-24440809.avif";
import daisiesJpg from "@/assets/slideshow/pexels-sidorov2512-24440809.jpg";
import farmhouseAvif from "@/assets/slideshow/pexels-leefinvrede-32506088.avif";
import farmhouseJpg from "@/assets/slideshow/pexels-leefinvrede-32506088.jpg";
import gullAvif from "@/assets/slideshow/pexels-toulouse-3098600.avif";
import gullJpg from "@/assets/slideshow/pexels-toulouse-3098600.jpg";
import palmsAvif from "@/assets/slideshow/pexels-vince-38550041.avif";
import palmsJpg from "@/assets/slideshow/pexels-vince-38550041.jpg";
import rooftopsAvif from "@/assets/slideshow/pexels-efeliiz-282933088-29846135.avif";
import rooftopsJpg from "@/assets/slideshow/pexels-efeliiz-282933088-29846135.jpg";

/**
 * One photograph in both formats.
 *
 * AVIF is a little over half the weight of the JPEG at the size these are
 * drawn, but it is not understood everywhere — Safari only from 16.4 — so the
 * JPEG stays as what any browser can fall back to. `<Picture>` offers both and
 * lets the browser choose.
 */
export type SamplePhoto = { avif: string; jpg: string };

/**
 * Stand-in photographs for the mock spreads and step scenes. One import site
 * so the same picture can appear on the cover and inside the feature.
 *
 * Regenerate the AVIF files with `bun scripts/avif.ts` after changing a JPEG.
 */
export const SAMPLE_PHOTOS = {
  cafeTerrace: { avif: cafeTerraceAvif, jpg: cafeTerraceJpg },
  cityFromHill: { avif: cityFromHillAvif, jpg: cityFromHillJpg },
  daisies: { avif: daisiesAvif, jpg: daisiesJpg },
  farmhouse: { avif: farmhouseAvif, jpg: farmhouseJpg },
  gull: { avif: gullAvif, jpg: gullJpg },
  palms: { avif: palmsAvif, jpg: palmsJpg },
  rooftops: { avif: rooftopsAvif, jpg: rooftopsJpg },
} as const satisfies Record<string, SamplePhoto>;
