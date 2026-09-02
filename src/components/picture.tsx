import type { ImgHTMLAttributes } from "react";

import type { SamplePhoto } from "@/lib/sample-photos";

type PictureProps = Omit<ImgHTMLAttributes<HTMLImageElement>, "alt"> & {
  photo: SamplePhoto;
  /**
   * Overrides the photograph's own description — pass "" where the picture is
   * purely decorative and a screen reader should skip it.
   */
  alt?: string;
};

/**
 * One photograph offered in two formats, the browser taking whichever it can.
 *
 * AVIF first because it is a little over half the weight; the JPEG on the
 * `<img>` is what any browser that does not understand AVIF loads instead —
 * and it is the `<img>`, not the `<source>`, that carries the alt text, the
 * loading hint and the styling, because that is the element that ends up
 * being displayed either way.
 */
export function Picture({ photo, alt = photo.alt, ...rest }: PictureProps) {
  return (
    <picture>
      <source srcSet={photo.avif} type="image/avif" />
      <img src={photo.jpg} alt={alt} {...rest} />
    </picture>
  );
}
