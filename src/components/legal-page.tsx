import type { ReactNode } from "react";

import { cn } from "@/lib/utils";
import { LEGAL } from "@/lib/legal";

/**
 * The shell every legal document sits in.
 *
 * Set on paper rather than over the scene: these are read, not skimmed, and
 * white text on an illustrated sky is the wrong surface for a paragraph
 * somebody may need to quote back at you.
 */
export function LegalPage({ title, summary, children }: { title: string; summary: string; children: ReactNode }) {
  return (
    <article className="mx-auto flex w-full max-w-2xl flex-col gap-6">
      <header className="flex flex-col gap-3">
        <span className="flex items-center gap-3 text-[11px] font-medium tracking-[0.28em] text-white/70 uppercase drop-shadow-sm">
          <span aria-hidden className="h-px w-6 bg-white/40" />
          Atlas
        </span>
        <h1 className="font-editorial text-4xl tracking-tight text-white drop-shadow-md sm:text-5xl">{title}</h1>
        <p className="max-w-prose text-white/90 drop-shadow-sm">{summary}</p>
      </header>

      <div className="flex flex-col gap-6 rounded-2xl border border-white/50 bg-white/90 p-6 backdrop-blur-md sm:p-8">
        <p className="text-xs tracking-[0.14em] text-stone-500 uppercase">Last updated {LEGAL.updated}</p>
        {children}
      </div>
    </article>
  );
}

/** One clause: a heading and its paragraphs. */
export function Clause({ heading, children }: { heading: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <h2 className="font-editorial text-xl text-stone-900">{heading}</h2>
      <div className="flex flex-col gap-2 text-sm leading-relaxed text-stone-700">{children}</div>
    </section>
  );
}

/** A run of points, set as a list rather than as a paragraph pretending to be one. */
export function Points({ items, className }: { items: ReactNode[]; className?: string }) {
  return (
    <ul className={cn("flex list-disc flex-col gap-1.5 pl-5", className)}>
      {items.map((item, i) => (
        <li key={i}>{item}</li>
      ))}
    </ul>
  );
}
