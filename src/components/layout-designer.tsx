import { useRef, useState, type PointerEvent } from "react";
import { Brush, Image, Plus, Trash2, Type } from "lucide-react";

import {
  clampBox,
  CUSTOM_SLOTS,
  MIN_BOX,
  newBoxId,
  SLOT_LABEL,
  SLOT_NOTE,
  type CustomBox,
  type CustomDesign,
  type CustomKind,
  type CustomSlot,
} from "@/lib/magazine/custom";
import { TEXT_HEIGHT, TEXT_WIDTH } from "@/lib/magazine/geometry";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * The canvas is drawn at a fraction of print size and every pointer movement
 * divided back through it, so a box dragged an inch on screen moves an inch of
 * page rather than an inch of pixels.
 */
const CANVAS_WIDTH = 300;
const SCALE = CANVAS_WIDTH / TEXT_WIDTH;

/** What a box of each kind looks like on the canvas. */
const SKIN: Record<CustomKind, string> = {
  text: "bg-[repeating-linear-gradient(to_bottom,var(--color-stone-300)_0_1px,transparent_1px_4px)] border-stone-400",
  plate: "bg-stone-300 border-stone-500",
  // Dashed and empty, the way it prints if nothing is drawn on it.
  sketch: "border-dashed border-emerald-500 bg-emerald-50/60",
};

const KIND_LABEL: Record<CustomKind, string> = { text: "Text", plate: "Photo", sketch: "Draw" };

type Drag =
  | { mode: "move"; id: string; fromX: number; fromY: number; box: CustomBox }
  | { mode: "size"; id: string; fromX: number; fromY: number; box: CustomBox };

function Page({
  boxes,
  selected,
  onSelect,
  onChange,
}: {
  boxes: CustomBox[];
  selected: string | null;
  onSelect: (id: string | null) => void;
  onChange: (box: CustomBox) => void;
}) {
  const drag = useRef<Drag | null>(null);

  const start = (mode: Drag["mode"], box: CustomBox) => (event: PointerEvent) => {
    event.preventDefault();
    event.stopPropagation();
    onSelect(box.id);
    drag.current = { mode, id: box.id, fromX: event.clientX, fromY: event.clientY, box };
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
  };

  const move = (event: PointerEvent) => {
    const held = drag.current;
    if (!held) return;
    // Screen travel back into page pixels.
    const dx = (event.clientX - held.fromX) / SCALE;
    const dy = (event.clientY - held.fromY) / SCALE;
    onChange(
      clampBox(
        held.mode === "move"
          ? { ...held.box, x: held.box.x + dx, y: held.box.y + dy }
          : { ...held.box, width: held.box.width + dx, height: held.box.height + dy },
      ),
    );
  };

  const end = () => {
    drag.current = null;
  };

  return (
    <div
      onPointerDown={() => onSelect(null)}
      onPointerMove={move}
      onPointerUp={end}
      onPointerCancel={end}
      className="relative shrink-0 overflow-hidden rounded-[3px] border border-stone-300 bg-white shadow-sm"
      style={{ width: CANVAS_WIDTH, height: TEXT_HEIGHT * SCALE }}
    >
      {boxes.map(box => {
        const chosen = box.id === selected;
        return (
          <div
            key={box.id}
            onPointerDown={start("move", box)}
            className={cn(
              "absolute cursor-move border",
              SKIN[box.kind],
              chosen && "outline-2 outline-offset-1 outline-emerald-600",
            )}
            style={{
              left: box.x * SCALE,
              top: box.y * SCALE,
              width: box.width * SCALE,
              height: box.height * SCALE,
            }}
          >
            <span className="pointer-events-none absolute top-0.5 left-1 text-[7px] tracking-[0.14em] text-stone-600 uppercase">
              {KIND_LABEL[box.kind]}
            </span>
            {/* The corner is its own surface: one press cannot mean both
                "move this box" and "make it bigger". */}
            <span
              onPointerDown={start("size", box)}
              title="Drag to resize"
              className="absolute -right-[3px] -bottom-[3px] size-[9px] cursor-nwse-resize rounded-[1px] border border-white bg-emerald-600"
            />
          </div>
        );
      })}
    </div>
  );
}

/**
 * Where the reader draws the three pages their issue is built from.
 *
 * The canvas is the page: same proportions, same units, everything drawn here
 * measured exactly as it is drawn. What it deliberately does not do is show
 * the reader's actual words and photographs — that is what sending it to press
 * is for, and a designer that tried to be a preview would be a worse version
 * of the thing one step to its right.
 */
export function LayoutDesigner({
  design,
  onChange,
  className,
}: {
  design: CustomDesign;
  onChange: (next: CustomDesign) => void;
  className?: string;
}) {
  const [slot, setSlot] = useState<CustomSlot>("left");
  const [selected, setSelected] = useState<string | null>(null);

  const page = design[slot];
  const chosen = page.boxes.find(b => b.id === selected) ?? null;

  const put = (boxes: CustomBox[]) => onChange({ ...design, [slot]: { boxes } });

  const add = (kind: CustomKind) => {
    const box = clampBox({
      id: newBoxId(),
      kind,
      // Stepped down the page so a second box does not land exactly on the
      // first and look like nothing happened.
      x: 24 + (page.boxes.length % 4) * 18,
      y: 24 + (page.boxes.length % 6) * 22,
      width: kind === "text" ? 200 : 220,
      height: kind === "sketch" ? 120 : kind === "text" ? 200 : 170,
    });
    put([...page.boxes, box]);
    setSelected(box.id);
  };

  const counts = {
    text: page.boxes.filter(b => b.kind === "text").length,
    plate: page.boxes.filter(b => b.kind === "plate").length,
    sketch: page.boxes.filter(b => b.kind === "sketch").length,
  };

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className="text-[11px] font-medium tracking-[0.28em] text-stone-500 uppercase">Your pages</span>
        <span className="text-xs text-stone-500">{SLOT_NOTE[slot]}</span>
      </div>

      <div className="flex flex-wrap gap-1">
        {CUSTOM_SLOTS.map(id => (
          <button
            key={id}
            type="button"
            onClick={() => {
              setSlot(id);
              setSelected(null);
            }}
            aria-pressed={id === slot}
            className={cn(
              "rounded-full px-3 py-1 text-xs transition-colors",
              id === slot ? "bg-stone-900 text-white" : "bg-stone-100 text-stone-600 hover:bg-stone-200",
            )}
          >
            {SLOT_LABEL[id]}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-start gap-4">
        <Page
          boxes={page.boxes}
          selected={selected}
          onSelect={setSelected}
          onChange={box => put(page.boxes.map(b => (b.id === box.id ? box : b)))}
        />

        <div className="flex min-w-44 flex-col gap-2">
          <Button variant="outline" size="sm" className="justify-start rounded-full" onClick={() => add("text")}>
            <Plus className="size-3.5" />
            <Type className="size-3.5" />
            Text box
          </Button>
          <Button variant="outline" size="sm" className="justify-start rounded-full" onClick={() => add("plate")}>
            <Plus className="size-3.5" />
            <Image className="size-3.5" />
            Photo box
          </Button>
          <Button variant="outline" size="sm" className="justify-start rounded-full" onClick={() => add("sketch")}>
            <Plus className="size-3.5" />
            <Brush className="size-3.5" />
            Drawing box
          </Button>

          <Button
            variant="ghost"
            size="sm"
            className="justify-start rounded-full text-red-600 hover:bg-red-50 hover:text-red-700"
            disabled={!chosen}
            onClick={() => {
              if (!chosen) return;
              put(page.boxes.filter(b => b.id !== chosen.id));
              setSelected(null);
            }}
          >
            <Trash2 className="size-3.5" />
            Remove box
          </Button>

          <p className="mt-1 text-[11px] leading-[1.5] text-stone-500">
            {counts.text} text · {counts.plate} photo · {counts.sketch} draw
            <br />
            Drag a box to move it, the green corner to size it.
          </p>

          {chosen && (
            <p className="text-[11px] text-stone-400 tabular-nums">
              {Math.round(chosen.width)} × {Math.round(chosen.height)}
              {(chosen.width <= MIN_BOX[chosen.kind].width ||
                chosen.height <= MIN_BOX[chosen.kind].height) && (
                <span className="text-stone-500"> · at its smallest</span>
              )}
            </p>
          )}

          {counts.text === 0 && (
            <p className="text-[11px] leading-[1.5] text-amber-700">
              No text box on this page, so none of your story can land on it.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
