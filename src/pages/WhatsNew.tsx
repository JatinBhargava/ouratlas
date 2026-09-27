import { Link } from "react-router";

import { RELEASES } from "@/lib/releases";

/**
 * What's new: each release in plain words, newest first.
 *
 * Set like the About and legal pages (the header over the scene, the text on
 * paper) because it is read the same way. It stays out of `LegalPage` only
 * because that shell prints the legal "Last updated" date, which would be the
 * wrong date here; each release carries its own.
 */
export function WhatsNew() {
  return (
    <article className="mx-auto flex w-full max-w-2xl flex-col gap-6">
      <header className="flex flex-col gap-3">
        <span className="flex items-center gap-3 text-[11px] font-medium tracking-[0.28em] text-white/70 uppercase drop-shadow-sm">
          <span aria-hidden className="h-px w-6 bg-white/40" />
          Atlas
        </span>
        <h1 className="font-editorial text-4xl tracking-tight text-white drop-shadow-md sm:text-5xl">What's new</h1>
        <p className="max-w-prose text-white/90 drop-shadow-sm">
          Everything each new edition of Atlas brought, newest first.
        </p>
      </header>

      <div className="flex flex-col rounded-2xl border border-white/50 bg-white/90 p-6 backdrop-blur-md sm:p-8">
        {RELEASES.map((release, index) => (
          <section
            key={release.version}
            // Anchors like #v1-0-0, so a particular release can be linked to.
            id={`v${release.version.replaceAll(".", "-")}`}
            className="flex flex-col gap-4 border-stone-200 py-8 first:pt-0 last:pb-0 [&+&]:border-t"
          >
            <div className="flex flex-col gap-1">
              <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs tracking-[0.14em] text-stone-500 uppercase">
                <span className="tabular-nums">Version {release.version}</span>
                <span aria-hidden>·</span>
                <time>{release.date}</time>
                {index === 0 && (
                  <span className="rounded-full bg-stone-900 px-2 py-0.5 text-[10px] tracking-[0.12em] text-white">
                    Latest
                  </span>
                )}
              </p>
              <h2 className="font-editorial text-2xl tracking-tight text-stone-900">{release.headline}</h2>
            </div>

            <ul className="flex flex-col gap-3">
              {release.items.map(item => (
                <li key={item.title} className="flex flex-col gap-0.5 text-sm leading-relaxed">
                  <span className="font-medium text-stone-900">{item.title}</span>
                  <span className="text-stone-700">{item.detail}</span>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>

      <p className="text-center text-sm text-white/90 drop-shadow-sm">
        Something you'd like to see next?{" "}
        <Link to="/contact" className="underline underline-offset-2">
          Tell us
        </Link>
        .
      </p>
    </article>
  );
}
