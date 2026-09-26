import { useEffect, useRef, useState, type DragEvent, type PointerEvent } from "react";

import { BoxBody, frameStyle } from "@/components/poster/box-view";
import { clampBox, SHEET, type Box, type Photo, type PosterPage } from "@/lib/poster/model";
import { cn } from "@/lib/utils";

/** Margin guide inset, in page pixels. Only drawn in the editor; nothing about it prints. */
export const GUIDE_MARGIN = 28;
/** How close, in screen pixels, an edge must come before it snaps. */
const SNAP = 6;

type Handle = "n" | "s" | "e" | "w" | "ne" | "nw" | "se" | "sw";
const HANDLES: Handle[] = ["nw", "n", "ne", "e", "se", "s", "sw", "w"];
const HANDLE_CURSOR: Record<Handle, string> = {
  n: "ns-resize",
  s: "ns-resize",
  e: "ew-resize",
  w: "ew-resize",
  ne: "nesw-resize",
  sw: "nesw-resize",
  nw: "nwse-resize",
  se: "nwse-resize",
};

type Drag = {
  mode: "move" | Handle;
  box: Box;
  fromX: number;
  fromY: number;
  /** A press that never travels is a click; the history step is only taken once it moves. */
  moved: boolean;
  pointer: number;
};

type Guides = { x: number[]; y: number[] };

/**
 * Nudges a moving box onto the nearest edge or centre — of the page, its
 * margins, or any other box — and says which lines it caught on, so the
 * reader sees why it jumped. Holding Alt turns it off for fine placement.
 */
function snapMove(box: Box, others: Box[], threshold: number): { x: number; y: number; guides: Guides } {
  const xs = [0, GUIDE_MARGIN, SHEET.width / 2, SHEET.width - GUIDE_MARGIN, SHEET.width];
  const ys = [0, GUIDE_MARGIN, SHEET.height / 2, SHEET.height - GUIDE_MARGIN, SHEET.height];
  for (const other of others) {
    xs.push(other.x, other.x + other.width / 2, other.x + other.width);
    ys.push(other.y, other.y + other.height / 2, other.y + other.height);
  }

  const best = (edges: number[], targets: number[]) => {
    let found: { shift: number; line: number } | null = null;
    for (const edge of edges) {
      for (const target of targets) {
        const shift = target - edge;
        if (Math.abs(shift) <= threshold && (!found || Math.abs(shift) < Math.abs(found.shift))) found = { shift, line: target };
      }
    }
    return found;
  };

  const sx = best([box.x, box.x + box.width / 2, box.x + box.width], xs);
  const sy = best([box.y, box.y + box.height / 2, box.y + box.height], ys);
  return {
    x: box.x + (sx?.shift ?? 0),
    y: box.y + (sy?.shift ?? 0),
    guides: { x: sx ? [sx.line] : [], y: sy ? [sy.line] : [] },
  };
}

function resize(box: Box, handle: Handle, dx: number, dy: number, keepRatio: boolean): Box {
  let { x, y, width, height } = box;
  if (handle.includes("e")) width += dx;
  if (handle.includes("s")) height += dy;
  if (handle.includes("w")) {
    x += dx;
    width -= dx;
  }
  if (handle.includes("n")) {
    y += dy;
    height -= dy;
  }

  // Corners only: a side handle that kept the ratio would move an edge the reader did not touch.
  if (keepRatio && handle.length === 2) {
    const ratio = box.width / box.height;
    if (width / height > ratio) width = height * ratio;
    else height = width / ratio;
    if (handle.includes("w")) x = box.x + box.width - width;
    if (handle.includes("n")) y = box.y + box.height - height;
  }
  return { ...box, x, y, width, height };
}

export function PosterCanvas({
  page,
  photos,
  scale,
  selected,
  editing,
  showGuides,
  onSelect,
  onEdit,
  onCheckpoint,
  onPreview,
  onCommitText,
  onPickPhoto,
  onDropFiles,
}: {
  page: PosterPage;
  photos: Record<string, Photo>;
  scale: number;
  selected: string | null;
  editing: string | null;
  showGuides: boolean;
  onSelect: (id: string | null) => void;
  onEdit: (id: string | null) => void;
  onCheckpoint: () => void;
  onPreview: (box: Box) => void;
  onCommitText: (id: string, text: string) => void;
  onPickPhoto: (boxId: string) => void;
  onDropFiles: (files: File[], at: { x: number; y: number }, target: string | null) => void;
}) {
  const surface = useRef<HTMLDivElement>(null);
  const drag = useRef<Drag | null>(null);
  const [guides, setGuides] = useState<Guides>({ x: [], y: [] });
  const [dropping, setDropping] = useState(false);

  const chosen = page.boxes.find(box => box.id === selected) ?? null;

  // Whether the selected text has run past the bottom of its box, which the
  // printed page would cut off. Measured from the drawn text, not guessed.
  const body = useRef<HTMLDivElement>(null);
  const [overflows, setOverflows] = useState(false);
  useEffect(() => {
    if (!chosen || chosen.kind !== "text" || editing === chosen.id || !body.current) {
      setOverflows(false);
      return;
    }
    setOverflows(body.current.scrollHeight > chosen.height - chosen.padding * 2 + 1);
  }, [chosen, editing]);

  const begin = (mode: Drag["mode"], box: Box) => (event: PointerEvent) => {
    if (event.button !== 0) return;
    event.stopPropagation();
    if (editing && editing !== box.id) onEdit(null);
    onSelect(box.id);
    if (box.locked) return;
    event.preventDefault();
    drag.current = { mode, box, fromX: event.clientX, fromY: event.clientY, moved: false, pointer: event.pointerId };
  };

  const move = (event: PointerEvent) => {
    const held = drag.current;
    if (!held) return;
    // Released somewhere the page never heard about, before the drag took hold.
    if (event.buttons === 0) {
      end();
      return;
    }
    const dx = (event.clientX - held.fromX) / scale;
    const dy = (event.clientY - held.fromY) / scale;
    if (!held.moved) {
      if (Math.abs(dx) * scale < 2 && Math.abs(dy) * scale < 2) return;
      held.moved = true;
      onCheckpoint();
      // Captured only once the press becomes a drag. Captured on the press
      // itself, the page would own the pointer, and a double-click on a box
      // would land on the page instead: no typing, no photo picker.
      surface.current?.setPointerCapture(held.pointer);
    }

    if (held.mode === "move") {
      const shifted = { ...held.box, x: held.box.x + dx, y: held.box.y + dy };
      if (event.altKey) {
        setGuides({ x: [], y: [] });
        onPreview(clampBox(shifted));
        return;
      }
      const others = page.boxes.filter(box => box.id !== held.box.id);
      const snapped = snapMove(shifted, others, SNAP / scale);
      setGuides(snapped.guides);
      onPreview(clampBox({ ...shifted, x: snapped.x, y: snapped.y }));
      return;
    }

    // Free by default, photo frames included: the picture is cropped to the
    // frame, so reshaping a frame is how a crop is changed. Shift keeps the shape.
    onPreview(clampBox(resize(held.box, held.mode, dx, dy, event.shiftKey)));
  };

  const end = () => {
    drag.current = null;
    setGuides({ x: [], y: [] });
  };

  /** Where on the page, in page pixels, a point on the screen falls. */
  const pagePoint = (clientX: number, clientY: number) => {
    const rect = surface.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    return { x: (clientX - rect.left) / scale, y: (clientY - rect.top) / scale };
  };

  const drop = (event: DragEvent) => {
    event.preventDefault();
    setDropping(false);
    const files = Array.from(event.dataTransfer.files).filter(file => file.type.startsWith("image/"));
    if (files.length === 0) return;
    const target = (event.target as HTMLElement).closest<HTMLElement>("[data-box]")?.dataset.box ?? null;
    const hit = target ? page.boxes.find(box => box.id === target) : undefined;
    onDropFiles(files, pagePoint(event.clientX, event.clientY), hit?.kind === "photo" ? hit.id : null);
  };

  const handleSize = 10 / scale;

  return (
    <div
      className={cn("relative shrink-0 shadow-xl shadow-stone-900/15 ring-1 ring-stone-900/10", dropping && "ring-4 ring-emerald-500")}
      style={{ width: SHEET.width * scale, height: SHEET.height * scale }}
    >
      <div
        ref={surface}
        role="application"
        aria-label="Poster page. Click a box to select it, drag to move, double-click text to type."
        onPointerDown={() => {
          onEdit(null);
          onSelect(null);
        }}
        onPointerMove={move}
        onPointerUp={end}
        onPointerCancel={end}
        onDragOver={event => {
          event.preventDefault();
          setDropping(true);
        }}
        onDragLeave={() => setDropping(false)}
        onDrop={drop}
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: SHEET.width,
          height: SHEET.height,
          transform: `scale(${scale})`,
          transformOrigin: "top left",
          background: page.background,
          overflow: "hidden",
          touchAction: "none",
        }}
      >
        {page.boxes.map(box => (
          <div
            key={box.id}
            data-box={box.id}
            onPointerDown={begin("move", box)}
            onDoubleClick={event => {
              event.stopPropagation();
              if (box.kind === "text" && !box.locked) onEdit(box.id);
              if (box.kind === "photo") onPickPhoto(box.id);
            }}
            style={{ ...frameStyle(box), cursor: box.locked ? "default" : editing === box.id ? "text" : "move" }}
          >
            <BoxBody
              box={box}
              photos={photos}
              placeholder
              editing={editing === box.id}
              onCommitText={text => {
                onCommitText(box.id, text);
                onEdit(null);
              }}
              bodyRef={box.id === selected ? body : undefined}
            />
          </div>
        ))}

        {showGuides && (
          <div
            aria-hidden
            className="pointer-events-none absolute border border-dashed border-sky-500/50"
            style={{ left: GUIDE_MARGIN, top: GUIDE_MARGIN, right: GUIDE_MARGIN, bottom: GUIDE_MARGIN }}
          />
        )}
        {guides.x.map(x => (
          <div key={`x${x}`} aria-hidden className="pointer-events-none absolute top-0 bottom-0 bg-pink-500" style={{ left: x, width: 1 / scale }} />
        ))}
        {guides.y.map(y => (
          <div key={`y${y}`} aria-hidden className="pointer-events-none absolute right-0 left-0 bg-pink-500" style={{ top: y, height: 1 / scale }} />
        ))}

        {chosen && editing !== chosen.id && (
          <div aria-hidden className="pointer-events-none absolute" style={frameStyle({ ...chosen, opacity: 1 })}>
            <div className="absolute inset-0" style={{ outline: `${1.5 / scale}px solid ${chosen.locked ? "#a8a29e" : "#059669"}` }} />
            {!chosen.locked &&
              HANDLES.map(handle => (
                <span
                  key={handle}
                  onPointerDown={begin(handle, chosen)}
                  className="pointer-events-auto absolute rounded-full border-emerald-600 bg-white"
                  style={{
                    width: handleSize,
                    height: handleSize,
                    borderWidth: 1.5 / scale,
                    cursor: HANDLE_CURSOR[handle],
                    left: handle.includes("w") ? -handleSize / 2 : handle.includes("e") ? chosen.width - handleSize / 2 : chosen.width / 2 - handleSize / 2,
                    top: handle.includes("n") ? -handleSize / 2 : handle.includes("s") ? chosen.height - handleSize / 2 : chosen.height / 2 - handleSize / 2,
                  }}
                />
              ))}
          </div>
        )}
      </div>

      {chosen && overflows && (
        <p className="absolute -bottom-7 left-0 text-xs text-red-600">This text runs past its box and will be cut off — drag the box taller.</p>
      )}
    </div>
  );
}
