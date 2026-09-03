import { Mail } from "lucide-react";

import { AtlasMark } from "@/components/atlas-mark";
import { NewsletterForm } from "@/components/newsletter-form";
import { Separator } from "@/components/ui/separator";
import { APP_VERSION } from "@/lib/version";

type LinkGroup = { heading: string; links: { label: string; href: string }[] };

/**
 * Every link here goes somewhere. The in-page anchors resolve on the landing
 * page, which is the only place this footer renders; the rest are real routes.
 *
 * Nothing is listed that does not exist yet. A dead link in a footer is read
 * as neglect by a person and as a broken page by a crawler, and the payment
 * provider verifying this business clicks them all.
 */
const GROUPS: LinkGroup[] = [
  {
    heading: "Product",
    links: [
      { label: "How it works", href: "#how-it-works" },
      { label: "Features", href: "#features" },
      { label: "Pricing", href: "/pricing" },
      { label: "FAQ", href: "#faq" },
    ],
  },
  {
    heading: "Company",
    links: [
      { label: "About", href: "/about" },
      { label: "Contact", href: "/contact" },
    ],
  },
  {
    heading: "Legal",
    links: [
      { label: "Privacy", href: "/privacy" },
      { label: "Terms", href: "/terms" },
      { label: "Refunds", href: "/refunds" },
      { label: "Contact", href: "/contact" },
    ],
  },
];

/**
 * Only accounts that exist.
 *
 * X and Instagram were placeholders pointing at "#", which opens a blank tab
 * onto the same page. Add them back here when there is something to link to.
 */
const SOCIALS = [
  {
    label: "GitHub",
    href: "https://github.com/JatinBhargava",
    path: "M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12",
  },];

export function SiteFooter() {
  return (
    <footer className="mt-16 sm:mt-24 border-t border-white/40 bg-white/85 backdrop-blur-md print:hidden">
      <div className="mx-auto w-full max-w-5xl px-6 py-14">
        {/* The waitlist sits above the link groups: it is the one thing here
            anyone is actually asked to do. */}
        <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex max-w-sm flex-col gap-1">
            <h3 className="font-editorial text-2xl tracking-tight text-stone-900">
              Letters from the road
            </h3>
            <p className="text-sm text-stone-600">
              New layouts, printing notes, and the occasional issue worth
              stealing an idea from.
            </p>
          </div>
          <NewsletterForm source="footer" className="w-full sm:max-w-xs" />
        </div>

        <Separator className="my-10 bg-stone-300" />

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
              Trip photos and your own words, set as a magazine worth keeping.
              Never stored on our servers.
            </p>
            <div className="flex items-center gap-2">
              {SOCIALS.map((social) => {
                // Only the links that go somewhere leave the site. The "#"
                // placeholders would otherwise open a blank tab onto the same
                // page, and `rel` on them would be meaningless.
                const external = social.href.startsWith("http");

                return (
                  <a
                    key={social.label}
                    href={social.href}
                    aria-label={social.label}
                    {...(external && {
                      target: "_blank",
                      rel: "noreferrer noopener",
                    })}
                    className="flex size-8 items-center justify-center rounded-full border border-stone-300 text-stone-600 transition-colors hover:border-stone-400 hover:text-stone-900"
                  >
                    <svg
                      viewBox="0 0 24 24"
                      fill="currentColor"
                      className="size-4"
                      aria-hidden
                    >
                      <path d={social.path} />
                    </svg>
                  </a>
                );
              })}
              <a
                href="mailto:hello@ouratlas.app"
                aria-label="Email"
                className="flex size-8 items-center justify-center rounded-full border border-stone-300 text-stone-600 transition-colors hover:border-stone-400 hover:text-stone-900"
              >
                <Mail className="size-4" />
              </a>
            </div>
          </div>

          {GROUPS.map((group) => (
            <nav key={group.heading} className="flex flex-col gap-3">
              <h3 className="text-sm font-semibold text-stone-900">
                {group.heading}
              </h3>
              <ul className="flex flex-col gap-2">
                {group.links.map((link) => (
                  <li key={link.label}>
                    <a
                      href={link.href}
                      className="text-sm text-stone-600 transition-colors hover:text-stone-900"
                    >
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
          <p>
            © {new Date().getFullYear()} OurAtlas. All rights reserved.{" "}
            {/* Small, but it is the only way to tell from a browser which
                build is actually being served. */}
            <span className="text-stone-400 tabular-nums">v{APP_VERSION}</span>
          </p>
          <p>Made for people who take the long way home.</p>
        </div>
      </div>
    </footer>
  );
}
