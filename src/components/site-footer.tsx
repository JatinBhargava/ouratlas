import { Mail } from "lucide-react";

import { AtlasMark } from "@/components/atlas-mark";
import { Separator } from "@/components/ui/separator";

type LinkGroup = { heading: string; links: { label: string; href: string }[] };

/**
 * In-page anchors resolve today. Everything pointing at a route (legal,
 * company, docs) is a placeholder until those pages exist.
 */
const GROUPS: LinkGroup[] = [
  {
    heading: "Product",
    links: [
      { label: "How it works", href: "#how-it-works" },
      { label: "Features", href: "#features" },
      { label: "Pricing", href: "#pricing" },
      { label: "FAQ", href: "#faq" },
    ],
  },
  {
    heading: "Company",
    links: [
      { label: "About", href: "#" },
      { label: "Journal", href: "#" },
      { label: "Contact", href: "#" },
      { label: "Press kit", href: "#" },
    ],
  },
  {
    heading: "Resources",
    links: [
      { label: "Layout gallery", href: "#" },
      { label: "Export guide", href: "#" },
      { label: "Printing tips", href: "#" },
      { label: "Status", href: "#" },
    ],
  },
  {
    heading: "Legal",
    links: [
      { label: "Privacy", href: "#" },
      { label: "Terms", href: "#" },
      { label: "Cookies", href: "#" },
      { label: "Licences", href: "#" },
    ],
  },
];

const SOCIALS = [
  {
    label: "GitHub",
    href: "#",
    path: "M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12",
  },
  {
    label: "X",
    href: "#",
    path: "M18.901 1.153h3.68l-8.04 9.19L24 22.846h-7.406l-5.8-7.584-6.638 7.584H.474l8.6-9.83L0 1.154h7.594l5.243 6.932ZM17.61 20.644h2.039L6.486 3.24H4.298Z",
  },
  {
    label: "Instagram",
    href: "#",
    path: "M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z",
  },
];

export function SiteFooter() {
  return (
    <footer className="mt-24 border-t border-white/40 bg-white/85 backdrop-blur-md print:hidden">
      <div className="mx-auto w-full max-w-5xl px-6 py-14">
        <div className="grid gap-10 md:grid-cols-[1.4fr_repeat(4,1fr)]">
          <div className="flex flex-col gap-4">
            <a
              href="/"
              className="group font-editorial flex w-fit items-center gap-2 text-2xl tracking-tight text-stone-900"
            >
              <AtlasMark />
              Atlas
            </a>
            <p className="max-w-xs text-sm text-stone-600">
              Trip photos and your own words, set as a magazine worth keeping. Never stored on our servers.
            </p>
            <div className="flex items-center gap-2">
              {SOCIALS.map(social => (
                <a
                  key={social.label}
                  href={social.href}
                  aria-label={social.label}
                  className="flex size-8 items-center justify-center rounded-full border border-stone-300 text-stone-600 transition-colors hover:border-stone-400 hover:text-stone-900"
                >
                  <svg viewBox="0 0 24 24" fill="currentColor" className="size-4" aria-hidden>
                    <path d={social.path} />
                  </svg>
                </a>
              ))}
              <a
                href="mailto:hello@ouratlas.app"
                aria-label="Email"
                className="flex size-8 items-center justify-center rounded-full border border-stone-300 text-stone-600 transition-colors hover:border-stone-400 hover:text-stone-900"
              >
                <Mail className="size-4" />
              </a>
            </div>
          </div>

          {GROUPS.map(group => (
            <nav key={group.heading} className="flex flex-col gap-3">
              <h3 className="text-sm font-semibold text-stone-900">{group.heading}</h3>
              <ul className="flex flex-col gap-2">
                {group.links.map(link => (
                  <li key={link.label}>
                    <a href={link.href} className="text-sm text-stone-600 transition-colors hover:text-stone-900">
                      {link.label}
                    </a>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>

        <Separator className="my-10 bg-stone-300" />

        <div className="flex flex-col items-center justify-between gap-3 text-sm text-stone-500 sm:flex-row">
          <p>© {new Date().getFullYear()} OurAtlas. All rights reserved.</p>
          <p>Made for people who take the long way home.</p>
        </div>
      </div>
    </footer>
  );
}
