/**
 * A PDF writer that knows exactly one kind of page: a full-bleed JPEG.
 *
 * That is all a phone export needs, and it is small enough to write out by
 * hand. A general PDF library would add hundreds of kilobytes to the bundle
 * every reader downloads — Bun builds this app without code splitting, so a
 * dynamic import would not keep it out — for features never used here.
 *
 * JPEG bytes go into the file untouched (`/DCTDecode` is JPEG), so nothing is
 * re-encoded and there is no compression to get wrong.
 */

export type JpegLeaf = {
  /** The encoded file, straight from `canvas.toBlob`. */
  bytes: Uint8Array<ArrayBuffer>;
  /** Pixel size. PDF wants it declared; it does not read it out of the JPEG. */
  width: number;
  height: number;
};

/** A page size in PDF points, 1/72 inch. */
export type PointSize = { width: number; height: number };

export function writePdf(leaves: JpegLeaf[], size: PointSize, title: string): Blob {
  const parts: Uint8Array<ArrayBuffer>[] = [];
  const offsets: number[] = [];
  let length = 0;
  const ascii = new TextEncoder();

  const put = (chunk: string | Uint8Array<ArrayBuffer>) => {
    const bytes = typeof chunk === "string" ? ascii.encode(chunk) : chunk;
    parts.push(bytes);
    length += bytes.length;
  };
  // Every object's byte position goes into the cross-reference table at the
  // end, and a reader that finds one of them wrong calls the whole file damaged.
  const begin = (id: number) => {
    offsets[id] = length;
    put(`${id} 0 obj\n`);
  };

  // Objects 1–3 are the catalogue, the page tree and the document info; each
  // leaf then takes three in a row: the page, its picture, and the one-line
  // content stream that draws the picture across the page.
  const pageId = (index: number) => 4 + index * 3;
  const count = pageId(leaves.length);

  put("%PDF-1.4\n");
  // Four bytes above 127, which is how a PDF tells transfer tools it is binary.
  put(Uint8Array.of(0x25, 0xe2, 0xe3, 0xcf, 0xd3, 0x0a));

  begin(1);
  put("<< /Type /Catalog /Pages 2 0 R >>\nendobj\n");
  begin(2);
  put(`<< /Type /Pages /Kids [${leaves.map((_, index) => `${pageId(index)} 0 R`).join(" ")}] /Count ${leaves.length} >>\nendobj\n`);
  begin(3);
  put(`<< /Title ${textString(title)} /Producer ${textString("Atlas")} >>\nendobj\n`);

  leaves.forEach((leaf, index) => {
    const page = pageId(index);
    const draw = `q ${size.width} 0 0 ${size.height} 0 0 cm /Leaf Do Q\n`;

    begin(page);
    put(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${size.width} ${size.height}] ` +
        `/Resources << /XObject << /Leaf ${page + 1} 0 R >> >> /Contents ${page + 2} 0 R >>\nendobj\n`,
    );

    begin(page + 1);
    put(
      `<< /Type /XObject /Subtype /Image /Width ${leaf.width} /Height ${leaf.height} ` +
        `/ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${leaf.bytes.length} >>\nstream\n`,
    );
    put(leaf.bytes);
    put("\nendstream\nendobj\n");

    begin(page + 2);
    put(`<< /Length ${draw.length} >>\nstream\n${draw}endstream\nendobj\n`);
  });

  const table = length;
  put(`xref\n0 ${count}\n0000000000 65535 f \n`);
  for (let id = 1; id < count; id++) put(`${String(offsets[id]).padStart(10, "0")} 00000 n \n`);
  put(`trailer\n<< /Size ${count} /Root 1 0 R /Info 3 0 R >>\nstartxref\n${table}\n%%EOF\n`);

  return new Blob(parts, { type: "application/pdf" });
}

/**
 * A PDF text string that survives any title.
 *
 * UTF-16BE behind a byte-order mark is the one encoding every reader agrees on
 * for text outside Latin-1, and a trip is as likely to be titled in Tamil as in
 * English. Written as hex, a title's brackets and backslashes need no escaping.
 */
function textString(value: string): string {
  let hex = "FEFF";
  for (let index = 0; index < value.length; index++) {
    hex += value.charCodeAt(index).toString(16).padStart(4, "0").toUpperCase();
  }
  return `<${hex}>`;
}
