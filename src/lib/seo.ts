import { LEGAL } from "./legal";

/**
 * The head of every public page, in one table.
 *
 * Two readers depend on it and they must never disagree. `build.ts` writes a
 * separate HTML file per route from it, because crawlers that run no
 * JavaScript and every link unfurler (WhatsApp, Slack, Facebook) see only the
 * HTML they are sent. `RootLayout` reads it again when the reader moves
 * between routes inside the app, where no new document arrives. Google asks
 * that script never set a canonical other than the one in the served HTML;
 * drawing both from here is what keeps that true.
 *
 * Plain data and one DOM helper, with nothing imported beyond `legal.ts`, so
 * the build can import it without dragging in React or Supabase.
 */

/** The site's own origin, which every canonical and og:url is absolute against. */
export const SITE = "https://ouratlas.co.in";

export type Head = {
  /** At most 60 characters; `build.ts` refuses anything longer. */
  title: string;
  /** At most 155 characters, for the same reason. */
  description: string;
  /** False writes `noindex`, and keeps the page out of the sitemap. */
  index: boolean;
  sitemap?: {
    changefreq: "monthly" | "yearly";
    priority: number;
    /**
     * The date the page last changed, as the legal pages print it. Converted
     * at build time only: date parsing of "3 September 2026" differs between
     * browsers, and this module also ships to them.
     */
    updated?: string;
  };
};

/**
 * One entry per route in `App.tsx`, keyed by path.
 *
 * Every route the app renders needs an entry, including signed-in ones: with
 * the catch-all rewrite gone, a path with no HTML file of its own is a 404 at
 * the server. That includes the addresses Google sign-in and checkout send
 * people back to (/create, /pricing, /account).
 *
 * The prices in the /pricing entry are copied from `PLANS` in
 * `pricing-section.tsx` rather than imported, because that module pulls in
 * the auth client. Change them together.
 */
export const ROUTES: Record<string, Head> = {
  "/": {
    title: "Atlas — your trip photos and words, set as a magazine",
    description:
      "Ten trip photographs and your own words, typeset in the browser as a magazine issue and exported as a PDF. Free to start; your photos are never stored.",
    index: true,
    sitemap: { changefreq: "monthly", priority: 1 },
  },
  "/create": {
    title: "New story — Atlas",
    description:
      "The desk: add up to ten photographs and your story, choose a theme, and send the issue to press as a PDF. Nothing is uploaded.",
    index: true,
    sitemap: { changefreq: "monthly", priority: 0.8 },
  },
  "/pricing": {
    title: "Pricing — Atlas: free, ₹499 or ₹1,199 a month",
    description:
      "Wanderer is free. Traveller, ₹499 a month, adds print-quality PDFs and every theme; Cartographer, ₹1,199 a month, adds editable layouts and custom fonts.",
    index: true,
    sitemap: { changefreq: "monthly", priority: 0.9 },
  },
  "/account": {
    title: "Your account — Atlas",
    description: "Your Atlas plan and billing. Only meaningful to the person signed in.",
    // noindex rather than a robots.txt Disallow: a crawler that may not fetch
    // the page never reads the noindex, and can still list the bare address.
    index: false,
  },
  "/about": {
    title: "About Atlas — a magazine press for your own trips",
    description:
      "Why Atlas typesets your trip in the browser: the photographs are never stored, the copy is measured against real type, and the issue is yours as a PDF.",
    index: true,
    sitemap: { changefreq: "yearly", priority: 0.5, updated: LEGAL.updated },
  },
  "/terms": {
    title: "Terms of service — Atlas",
    description:
      "The agreement you accept by using Atlas, in plain language and kept short, because a term nobody reads protects nobody.",
    index: true,
    sitemap: { changefreq: "yearly", priority: 0.3, updated: LEGAL.updated },
  },
  "/privacy": {
    title: "Privacy policy — Atlas",
    description:
      "Your photographs and writing are never stored. Exactly what reaches Atlas — account, billing, the opt-in AI tools — and what happens to it.",
    index: true,
    sitemap: { changefreq: "yearly", priority: 0.3, updated: LEGAL.updated },
  },
  "/refunds": {
    title: "Refunds and cancellation — Atlas",
    description: `Write within ${LEGAL.refundDays} days and Atlas refunds you: no form, no reason required. How cancelling a monthly Traveller or Cartographer plan works.`,
    index: true,
    sitemap: { changefreq: "yearly", priority: 0.3, updated: LEGAL.updated },
  },
  "/contact": {
    title: "Contact Atlas",
    description:
      "One inbox, read by a person: billing, bugs, data requests and anything else. We answer within two working days, usually sooner.",
    index: true,
    sitemap: { changefreq: "yearly", priority: 0.4, updated: LEGAL.updated },
  },
};

/** The head for an address that is not a page: never indexed, no canonical. */
export const NOT_FOUND: Head = {
  title: "Page not found — Atlas",
  description: "Nothing is set at this address. Start a story, or go back to the cover.",
  index: false,
};

/** The head and absolute address for a path, or the not-found head and none. */
export function headFor(pathname: string): { head: Head; url: string | null } {
  // Vercel redirects a trailing slash away, but the dev server does not.
  const path = pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
  const head = ROUTES[path];
  return head ? { head, url: new URL(path, SITE).toString() } : { head: NOT_FOUND, url: null };
}

/** Sets, creates or (given null) removes one `<meta>` in the document head. */
function setMeta(attribute: "name" | "property", key: string, content: string | null) {
  let tag = document.head.querySelector<HTMLMetaElement>(`meta[${attribute}="${key}"]`);
  if (content === null) {
    tag?.remove();
    return;
  }
  if (!tag) {
    tag = document.createElement("meta");
    tag.setAttribute(attribute, key);
    document.head.append(tag);
  }
  tag.content = content;
}

/**
 * Brings the live document's head into line with `path`.
 *
 * On a first load this changes nothing, because the served HTML was written
 * from the same entry. It earns its keep on in-app navigation, and on the
 * 404 page, where React Router may render a real page for an address the
 * server did not recognise (for instance a different letter case).
 */
export function applyHead(pathname: string): void {
  const { head, url } = headFor(pathname);

  document.title = head.title;
  setMeta("name", "description", head.description);
  setMeta("property", "og:title", head.title);
  setMeta("property", "og:description", head.description);
  setMeta("name", "twitter:title", head.title);
  setMeta("name", "twitter:description", head.description);
  setMeta("property", "og:url", url);
  setMeta("name", "robots", head.index ? null : "noindex");

  let canonical = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  if (!url) {
    canonical?.remove();
    return;
  }
  if (!canonical) {
    canonical = document.createElement("link");
    canonical.rel = "canonical";
    document.head.append(canonical);
  }
  canonical.href = url;
}
