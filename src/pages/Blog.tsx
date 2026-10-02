import { lazy, Suspense, useEffect, useState, type ComponentType, type MouseEvent } from "react";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { Link, useNavigate, useParams } from "react-router";

import { Button } from "@/components/ui/button";
import { BODIES, POSTS } from "@/lib/blog/posts";
import { POST_KINDS, postHead, printDate, type PostKind, type PostMeta } from "@/lib/blog/types";
import { NOT_FOUND, SITE, writeHead } from "@/lib/seo";
import { cn } from "@/lib/utils";
import { NotFound } from "@/pages/NotFound";

/**
 * The Journal: guides, essays and notes from the press room, at /blog.
 *
 * Set like What's new and the legal pages (the header over the scene, the
 * text on paper), because a post is read the same way. The posts are
 * Markdown in `src/content/blog`, compiled by `scripts/blog.ts`; this module
 * carries every post's metadata, and each body is fetched only when its post
 * is opened.
 */

/** A post's kind, date and length, in the small capitals the site uses for a dateline. */
function Dateline({ post, className }: { post: PostMeta; className?: string }) {
  return (
    <p className={cn("flex flex-wrap items-center gap-x-3 gap-y-1 text-xs tracking-[0.14em] uppercase", className)}>
      <span>{POST_KINDS[post.kind].label}</span>
      <span aria-hidden>·</span>
      <time dateTime={post.date}>{printDate(post.date)}</time>
      <span aria-hidden>·</span>
      <span className="tabular-nums">{post.minutes} min read</span>
    </p>
  );
}

function PostList({ posts, Heading = "h2" }: { posts: PostMeta[]; Heading?: "h2" | "h3" }) {
  return (
    <ul className="flex flex-col">
      {posts.map(post => (
        <li key={post.slug} className="border-stone-200 py-6 first:pt-0 last:pb-0 [&+&]:border-t">
          <Link to={`/blog/${post.slug}`} className="group flex flex-col gap-2">
            <Dateline post={post} className="text-stone-500" />
            <Heading className="font-editorial text-2xl tracking-tight text-stone-900 group-hover:underline group-hover:underline-offset-4">
              {post.title}
            </Heading>
            <p className="text-sm leading-relaxed text-stone-700">{post.description}</p>
          </Link>
        </li>
      ))}
    </ul>
  );
}

export function Blog() {
  // Plain state rather than the query string: the build draws this page with
  // every post listed, and a filter read from the address would differ from
  // that markup on hydration.
  const [kind, setKind] = useState<PostKind | "all">("all");
  const kinds = (Object.keys(POST_KINDS) as PostKind[]).filter(each => POSTS.some(post => post.kind === each));
  const shown = kind === "all" ? POSTS : POSTS.filter(post => post.kind === kind);

  return (
    <article className="mx-auto flex w-full max-w-2xl flex-col gap-6">
      <header className="flex flex-col gap-3">
        <span className="flex items-center gap-3 text-[11px] font-medium tracking-[0.28em] text-white/70 uppercase drop-shadow-sm">
          <span aria-hidden className="h-px w-6 bg-white/40" />
          Atlas
        </span>
        <h1 className="font-editorial text-4xl tracking-tight text-white drop-shadow-md sm:text-5xl">The Journal</h1>
        <p className="max-w-prose text-white/90 drop-shadow-sm">
          How to keep a trip, a wedding or an ordinary year in print, and how the press that sets them is built.
        </p>
      </header>

      <div className="flex flex-col gap-6 rounded-2xl border border-white/50 bg-white/90 p-6 backdrop-blur-md sm:p-8">
        {kinds.length > 1 && (
          <div className="flex flex-wrap gap-2" role="group" aria-label="Show">
            {(["all", ...kinds] as const).map(each => (
              <Button
                key={each}
                size="sm"
                variant={kind === each ? "default" : "outline"}
                aria-pressed={kind === each}
                onClick={() => setKind(each)}
              >
                {each === "all" ? "Everything" : POST_KINDS[each].plural}
              </Button>
            ))}
          </div>
        )}
        {shown.length > 0 ? (
          <PostList posts={shown} />
        ) : (
          <p className="text-sm text-stone-700">The first pages of the Journal are still at the press.</p>
        )}
      </div>

      <p className="text-center text-sm text-white/90 drop-shadow-sm">
        <a href="/blog/feed.xml" className="underline underline-offset-2">
          Follow by RSS
        </a>
      </p>
    </article>
  );
}

/**
 * One lazy component per post body, made once and kept: a new `lazy()` on
 * every render would suspend every time and never draw.
 */
const bodies = new Map<string, ComponentType>();

function bodyOf(slug: string, load: () => Promise<{ default: string }>): ComponentType {
  let body = bodies.get(slug);
  if (!body) {
    body = lazy(() =>
      load().then(({ default: html }) => ({
        default: () => <div className="journal-prose" dangerouslySetInnerHTML={{ __html: html }} />,
      })),
    );
    bodies.set(slug, body);
  }
  return body;
}

export function BlogPost() {
  const { slug = "" } = useParams();
  const post = POSTS.find(each => each.slug === slug);
  const load = BODIES[slug];
  const navigate = useNavigate();

  // `applyHead` leaves these addresses alone (`SELF_HEADED` in seo.ts), so
  // the head is this page's to write, from the values build.ts served.
  useEffect(() => {
    if (post) writeHead(postHead(post), new URL(`/blog/${post.slug}`, SITE).toString());
    else writeHead(NOT_FOUND, null);
  }, [post]);

  if (!post || !load) return <NotFound />;
  const Body = bodyOf(post.slug, load);
  const more = POSTS.filter(each => each.slug !== post.slug).slice(0, 3);

  /**
   * Links into the site, inside the rendered Markdown, move through the router
   * like any other link instead of loading the whole app again. The body is
   * HTML, so there is no <Link> to render; the click is caught here instead.
   */
  const followInternal = (event: MouseEvent<HTMLDivElement>) => {
    const anchor = (event.target as HTMLElement).closest("a");
    const href = anchor?.getAttribute("href");
    if (!href?.startsWith("/") || anchor?.target || event.button !== 0) return;
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    navigate(href);
  };

  return (
    <article className="mx-auto flex w-full max-w-2xl flex-col gap-6">
      <header className="flex flex-col gap-3">
        <Link
          to="/blog"
          className="flex items-center gap-2 text-[11px] font-medium tracking-[0.28em] text-white/70 uppercase drop-shadow-sm hover:text-white"
        >
          <ArrowLeft aria-hidden className="size-3.5" />
          The Journal
        </Link>
        <h1 className="font-editorial text-4xl tracking-tight text-white drop-shadow-md sm:text-5xl">{post.title}</h1>
        <p className="max-w-prose text-white/90 drop-shadow-sm">{post.description}</p>
      </header>

      <div className="flex flex-col gap-6 rounded-2xl border border-white/50 bg-white/90 p-6 backdrop-blur-md sm:p-8">
        <Dateline post={post} className="text-stone-500" />
        {/* The build draws the body in; in the browser a post opened from a
            link waits only for its own small chunk. */}
        <div onClick={followInternal}>
          <Suspense fallback={<p className="text-sm text-stone-500">Setting the page…</p>}>
            <Body />
          </Suspense>
        </div>
        {post.updated && (
          <p className="text-xs tracking-[0.14em] text-stone-500 uppercase">Revised {printDate(post.updated)}</p>
        )}
      </div>

      <aside className="flex flex-col items-start gap-3 rounded-2xl border border-white/50 bg-stone-900/85 p-6 text-white backdrop-blur-md sm:p-8">
        <h2 className="font-editorial text-2xl tracking-tight">Set your own memories as a magazine</h2>
        <p className="text-sm leading-relaxed text-white/80">
          Up to ten photographs and your own words, typeset as an issue you keep as a PDF. Your photos never leave your
          browser.
        </p>
        <Button asChild variant="secondary">
          <Link to="/create">
            Start a story <ArrowRight aria-hidden />
          </Link>
        </Button>
      </aside>

      {more.length > 0 && (
        <section className="flex flex-col gap-4 rounded-2xl border border-white/50 bg-white/90 p-6 backdrop-blur-md sm:p-8">
          <h2 className="text-xs tracking-[0.14em] text-stone-500 uppercase">More from the Journal</h2>
          <PostList posts={more} Heading="h3" />
        </section>
      )}
    </article>
  );
}
