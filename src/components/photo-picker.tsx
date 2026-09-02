import { useRef, useState, type ChangeEvent, type DragEvent } from "react";
import { GripVertical, ImagePlus, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { Photo } from "@/types";

export const MAX_PHOTOS = 10;

/**
 * Our own drag type, which is what tells the two kinds of drop apart: files
 * coming in from the desktop, and a photograph already here being moved.
 */
const PHOTO_MIME = "application/x-atlas-photo";

const isReorder = (event: DragEvent) => event.dataTransfer.types.includes(PHOTO_MIME);

type PhotoPickerProps = {
  photos: Photo[];
  onAdd: (files: File[]) => void;
  onRemove: (id: string) => void;
  /** Moves one photograph to another's position. */
  onReorder: (from: string, to: string) => void;
};

/**
 * Picks up to ten images. Previews are object URLs held in the tab — the files
 * are never uploaded anywhere.
 *
 * Order matters and is the reason these can be dragged: the first photograph
 * becomes the cover and the rest are dealt through the issue in the order they
 * sit here.
 */
export function PhotoPicker({ photos, onAdd, onRemove, onReorder }: PhotoPickerProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [held, setHeld] = useState<string | null>(null);
  const [over, setOver] = useState<string | null>(null);
  const remaining = MAX_PHOTOS - photos.length;

  const accept = (list: FileList | null) => {
    if (!list) return;
    onAdd(Array.from(list).filter(file => file.type.startsWith("image/")));
  };

  const onDrop = (event: DragEvent<HTMLDivElement>) => {
    // A photograph being moved within the tray is handled by the tile it lands
    // on; letting it fall through to here would read it as a file drop and add
    // nothing, having already cancelled the move.
    if (isReorder(event)) return;
    event.preventDefault();
    setDragging(false);
    accept(event.dataTransfer.files);
  };

  /** Picking one up, and dropping it on another. */
  const tileHandlers = (id: string) => ({
    draggable: true,
    onDragStart: (event: DragEvent) => {
      event.dataTransfer.setData(PHOTO_MIME, id);
      event.dataTransfer.effectAllowed = "move";
      setHeld(id);
    },
    onDragEnd: () => {
      setHeld(null);
      setOver(null);
    },
    onDragOver: (event: DragEvent) => {
      if (!isReorder(event)) return;
      event.preventDefault();
      event.stopPropagation();
      event.dataTransfer.dropEffect = "move";
      setOver(id);
    },
    onDragLeave: () => setOver(current => (current === id ? null : current)),
    onDrop: (event: DragEvent) => {
      if (!isReorder(event)) return;
      event.preventDefault();
      event.stopPropagation();
      setOver(null);
      setHeld(null);
      const from = event.dataTransfer.getData(PHOTO_MIME);
      if (from && from !== id) onReorder(from, id);
    },
  });

  const onInput = (event: ChangeEvent<HTMLInputElement>) => {
    accept(event.target.files);
    // Allow picking the same file again after a removal.
    event.target.value = "";
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-baseline justify-between">
        <h2 className="font-editorial text-2xl text-stone-900">The plates</h2>
        <p className="text-sm text-stone-500 tabular-nums">
          {photos.length} of {MAX_PHOTOS}
        </p>
      </div>

      <div
        onDragOver={event => {
          if (isReorder(event)) return;
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={cn(
          "rounded-2xl border-2 border-dashed p-4 transition-colors",
          dragging ? "border-emerald-600 bg-emerald-50/70" : "border-stone-300 bg-white/40",
        )}
      >
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {photos.map((photo, i) => (
            <figure
              key={photo.id}
              {...tileHandlers(photo.id)}
              className={cn(
                "group relative aspect-square cursor-grab overflow-hidden rounded-xl bg-stone-200 transition-opacity active:cursor-grabbing",
                held === photo.id && "opacity-40",
                over === photo.id && "outline-2 outline-offset-2 outline-emerald-600",
              )}
            >
              <img src={photo.url} alt={photo.file.name} draggable={false} className="size-full object-cover" />
              <span className="absolute top-1.5 left-1.5 flex items-center gap-0.5 rounded-full bg-black/55 py-0.5 pr-1.5 pl-1 text-[11px] font-medium text-white tabular-nums">
                <GripVertical className="size-3 opacity-70" aria-hidden />
                {i + 1}
              </span>
              {i === 0 && (
                <span className="absolute bottom-1.5 left-1.5 rounded-full bg-black/55 px-1.5 py-0.5 text-[10px] tracking-[0.14em] text-white uppercase">
                  Cover
                </span>
              )}
              <button
                type="button"
                onClick={() => onRemove(photo.id)}
                aria-label={`Remove ${photo.file.name}`}
                className="absolute top-1.5 right-1.5 flex size-6 items-center justify-center rounded-full bg-black/55 text-white opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
              >
                <X className="size-3.5" />
              </button>
            </figure>
          ))}

          {remaining > 0 && (
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="flex aspect-square flex-col items-center justify-center gap-1.5 rounded-xl border border-stone-300 bg-white/70 text-stone-500 transition-colors hover:border-stone-400 hover:text-stone-800"
            >
              <ImagePlus className="size-5" />
              <span className="text-xs">Add</span>
            </button>
          )}
        </div>

        <input ref={inputRef} type="file" accept="image/*" multiple hidden onChange={onInput} />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-stone-500">
          {remaining > 0
            ? `Drop images here, or add ${remaining} more. Drag one onto another to reorder them.`
            : "That's the full ten. Drag one onto another to reorder them."}
        </p>
        <Button
          variant="outline"
          size="sm"
          className="rounded-full"
          onClick={() => inputRef.current?.click()}
          disabled={remaining === 0}
        >
          Choose files
        </Button>
      </div>
    </div>
  );
}
