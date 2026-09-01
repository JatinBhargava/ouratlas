import { useRef, useState, type ChangeEvent, type DragEvent } from "react";
import { ImagePlus, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { Photo } from "@/types";

export const MAX_PHOTOS = 10;

type PhotoPickerProps = {
  photos: Photo[];
  onAdd: (files: File[]) => void;
  onRemove: (id: string) => void;
};

/**
 * Picks up to ten images. Previews are object URLs held in the tab — the files
 * are never uploaded anywhere.
 */
export function PhotoPicker({ photos, onAdd, onRemove }: PhotoPickerProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const remaining = MAX_PHOTOS - photos.length;

  const accept = (list: FileList | null) => {
    if (!list) return;
    onAdd(Array.from(list).filter(file => file.type.startsWith("image/")));
  };

  const onDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragging(false);
    accept(event.dataTransfer.files);
  };

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
            <figure key={photo.id} className="group relative aspect-square overflow-hidden rounded-xl bg-stone-200">
              <img src={photo.url} alt={photo.file.name} className="size-full object-cover" />
              <span className="absolute top-1.5 left-1.5 rounded-full bg-black/55 px-1.5 py-0.5 text-[11px] font-medium text-white tabular-nums">
                {i + 1}
              </span>
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
            ? `Drop images here, or add ${remaining} more.`
            : "That's the full ten — pull one to swap it."}
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
