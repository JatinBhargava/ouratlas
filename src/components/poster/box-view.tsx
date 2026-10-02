import { useEffect, useRef, type CSSProperties, type Ref } from "react";
import { ImagePlus } from "lucide-react";

import { FILTERS, FONTS, SHEET, type Box, type Photo, type PhotoBox, type PosterPage, type TextBox } from "@/lib/poster/model";

/**
 * How a box is drawn, and nothing else: no selection, no handles, no pointer
 * handling. The editor, the page thumbnails and the PDF press all draw with
 * this, so the page on screen and the page in the file cannot drift apart.
 */

const JUSTIFY: Record<TextBox["valign"], CSSProperties["justifyContent"]> = {
  top: "flex-start",
  middle: "center",
  bottom: "flex-end",
};

/** Where the box sits and how it is turned: shared by every kind. */
export function frameStyle(box: Box): CSSProperties {
  return {
    position: "absolute",
    left: box.x,
    top: box.y,
    width: box.width,
    height: box.height,
    opacity: box.opacity,
    transform: box.rotation ? `rotate(${box.rotation}deg)` : undefined,
  };
}

export function textStyle(box: TextBox): CSSProperties {
  return {
    fontFamily: FONTS[box.font].stack,
    fontSize: box.size,
    fontWeight: box.weight,
    fontStyle: box.italic ? "italic" : "normal",
    textDecoration: box.underline ? "underline" : "none",
    textTransform: box.uppercase ? "uppercase" : "none",
    letterSpacing: box.tracking ? `${box.tracking}em` : "normal",
    lineHeight: box.leading,
    textAlign: box.align,
    color: box.color,
    textShadow: box.shadow ? "0 2px 8px rgba(0, 0, 0, 0.45)" : undefined,
    whiteSpace: "pre-wrap",
    overflowWrap: "break-word",
    ...(box.columns && box.columns > 1 ? { columnCount: box.columns, columnGap: box.gap ?? 16 } : {}),
  };
}

function TextView({
  box,
  editing,
  onCommit,
  bodyRef,
}: {
  box: TextBox;
  editing?: boolean;
  onCommit?: (text: string) => void;
  bodyRef?: Ref<HTMLDivElement>;
}) {
  const field = useRef<HTMLDivElement>(null);

  // Uncontrolled while editing: React rewriting the text on every keystroke
  // would put the caret back at the start each time.
  useEffect(() => {
    const node = field.current;
    if (!editing || !node) return;
    node.innerText = box.text;
    node.focus();
    const range = document.createRange();
    range.selectNodeContents(node);
    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
    // Only when editing starts; the text it reads is the text at that moment.
  }, [editing]);

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        boxSizing: "border-box",
        padding: box.padding,
        background: box.fill,
        display: "flex",
        flexDirection: "column",
        justifyContent: JUSTIFY[box.valign],
        overflow: editing ? "visible" : "hidden",
      }}
    >
      {editing ? (
        <div
          ref={field}
          contentEditable
          suppressContentEditableWarning
          role="textbox"
          aria-multiline="true"
          aria-label="Text box"
          onBlur={event => onCommit?.(event.currentTarget.innerText.replace(/\n$/, ""))}
          onPaste={event => {
            // Text only: a paste from a web page would otherwise bring its own fonts and colours with it.
            event.preventDefault();
            document.execCommand("insertText", false, event.clipboardData.getData("text/plain"));
          }}
          onPointerDown={event => event.stopPropagation()}
          onKeyDown={event => {
            event.stopPropagation();
            if (event.key === "Escape") event.currentTarget.blur();
          }}
          style={{ ...textStyle(box), outline: "none", cursor: "text", minHeight: "1em" }}
        />
      ) : (
        <div ref={bodyRef} style={textStyle(box)}>
          {box.text}
        </div>
      )}
    </div>
  );
}

function PhotoView({ box, photo, placeholder }: { box: PhotoBox; photo?: Photo; placeholder?: boolean }) {
  const scale = `scale(${box.zoom})${box.flip ? " scaleX(-1)" : ""}`;
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        boxSizing: "border-box",
        overflow: "hidden",
        borderRadius: box.arch ? `${box.radius}px ${box.radius}px 0 0` : box.radius,
        border: box.borderWidth ? `${box.borderWidth}px solid ${box.borderColor}` : undefined,
        background: photo ? "transparent" : "#e4dfd5",
        position: "relative",
      }}
    >
      {photo ? (
        <img
          src={photo.url}
          alt=""
          draggable={false}
          style={{
            width: "100%",
            height: "100%",
            display: "block",
            objectFit: box.fit,
            objectPosition: `${box.focusX}% ${box.focusY}%`,
            transform: scale === "scale(1)" ? undefined : scale,
            transformOrigin: `${box.focusX}% ${box.focusY}%`,
            filter: FILTERS[box.filter].css === "none" ? undefined : FILTERS[box.filter].css,
            userSelect: "none",
          }}
        />
      ) : (
        placeholder && (
          <div className="flex h-full w-full flex-col items-center justify-center gap-1 text-center text-[11px] text-stone-500">
            <ImagePlus className="size-5" />
            <span>Double-click or drop a photo</span>
          </div>
        )
      )}
    </div>
  );
}

export function BoxBody({
  box,
  photos,
  placeholder,
  editing,
  onCommitText,
  bodyRef,
}: {
  box: Box;
  photos: Record<string, Photo>;
  /** Draw the hint in an empty frame; the editor wants it, a PDF does not. */
  placeholder?: boolean;
  editing?: boolean;
  onCommitText?: (text: string) => void;
  bodyRef?: Ref<HTMLDivElement>;
}) {
  if (box.kind === "text") return <TextView box={box} editing={editing} onCommit={onCommitText} bodyRef={bodyRef} />;
  if (box.kind === "photo") return <PhotoView box={box} photo={box.photo ? photos[box.photo] : undefined} placeholder={placeholder} />;
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        boxSizing: "border-box",
        background: box.fill,
        borderRadius: box.shape === "ellipse" ? "50%" : box.radius,
        border: box.borderWidth ? `${box.borderWidth}px solid ${box.borderColor}` : undefined,
      }}
    />
  );
}

/**
 * One page at full size, 520 × 693: what the PDF is drawn from, and, scaled
 * down, what the page strip shows.
 */
export function Sheet({ page, photos, ref }: { page: PosterPage; photos: Record<string, Photo>; ref?: Ref<HTMLDivElement> }) {
  return (
    <div
      ref={ref}
      style={{ position: "relative", width: SHEET.width, height: SHEET.height, overflow: "hidden", background: page.background }}
    >
      {page.boxes.map(box => (
        <div key={box.id} style={frameStyle(box)}>
          <BoxBody box={box} photos={photos} />
        </div>
      ))}
    </div>
  );
}
