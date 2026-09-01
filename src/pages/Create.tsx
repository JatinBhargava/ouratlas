import { useEffect, useMemo, useRef, useState } from "react";
import { Sparkles } from "lucide-react";

import { MAX_PHOTOS, PhotoPicker } from "@/components/photo-picker";
import { MIN_WORDS, MAX_WORDS, StoryEditor } from "@/components/story-editor";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Photo } from "@/types";

const countWords = (text: string) => (text.trim() ? text.trim().split(/\s+/).length : 0);

export function Create() {
  const [title, setTitle] = useState("");
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [story, setStory] = useState("");

  // Object URLs are a manual resource: release them when the page goes away.
  const photosRef = useRef<Photo[]>([]);
  photosRef.current = photos;
  useEffect(() => () => photosRef.current.forEach(photo => URL.revokeObjectURL(photo.url)), []);

  const wordCount = useMemo(() => countWords(story), [story]);

  const addPhotos = (files: File[]) =>
    setPhotos(current => [
      ...current,
      ...files.slice(0, MAX_PHOTOS - current.length).map(file => ({
        id: crypto.randomUUID(),
        file,
        url: URL.createObjectURL(file),
      })),
    ]);

  const removePhoto = (id: string) =>
    setPhotos(current => {
      const gone = current.find(photo => photo.id === id);
      if (gone) URL.revokeObjectURL(gone.url);
      return current.filter(photo => photo.id !== id);
    });

  const blocker =
    photos.length === 0
      ? "Add at least one photo"
      : wordCount < MIN_WORDS
        ? `Write about ${(MIN_WORDS - wordCount).toLocaleString()} more words`
        : wordCount > MAX_WORDS
          ? "Trim the story to 10,000 words"
          : null;

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-3">
        <span className="flex items-center gap-3 text-[11px] font-medium tracking-[0.28em] text-white/70 uppercase drop-shadow-sm">
          <span aria-hidden className="h-px w-6 bg-white/40" />
          The desk
        </span>
        <h1 className="font-editorial text-5xl tracking-tight text-white drop-shadow-md">New story</h1>
        <p className="max-w-prose text-white/90 drop-shadow-sm">
          Ten photos and the story behind them, set as a magazine. Everything stays in this tab until you export.
        </p>
      </header>

      <Card className="border-white/50 bg-white/90 backdrop-blur-md">
        <CardContent className="flex flex-col gap-10 py-2">
          <div className="flex flex-col gap-2">
            <Label htmlFor="album-title" className="text-stone-700">
              Working title
            </Label>
            <Input
              id="album-title"
              value={title}
              onChange={event => setTitle(event.target.value)}
              placeholder="Three days in the Cairngorms"
              className="max-w-md bg-white/70 text-base"
            />
          </div>

          <PhotoPicker photos={photos} onAdd={addPhotos} onRemove={removePhoto} />
          <StoryEditor story={story} onChange={setStory} wordCount={wordCount} />
        </CardContent>
      </Card>

      <div className="sticky bottom-6 flex flex-wrap items-center justify-between gap-4 rounded-full border border-white/50 bg-white/85 py-3 pr-3 pl-6 shadow-lg shadow-black/10 backdrop-blur-md">
        <p className="text-sm text-stone-600">
          {blocker ?? "Ready for press."}
          <span className="text-stone-400"> · {photos.length} photos · {wordCount.toLocaleString()} words</span>
        </p>
        <Button className="rounded-full" disabled={blocker !== null}>
          <Sparkles className="size-4" />
          Send to press
        </Button>
      </div>
    </div>
  );
}
