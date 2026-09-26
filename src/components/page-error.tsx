import { Component, type ReactNode } from "react";
import { useLocation } from "react-router";

import { Button } from "@/components/ui/button";

type State = { failed: boolean };

/**
 * What a page shows when its code cannot run, instead of nothing.
 *
 * Each of the larger pages is a chunk fetched when it is visited. A chunk can
 * fail to arrive (a deploy replaced it mid-visit, the connection dropped) or
 * fail to run (a browser too old for something in it — which is how the desk
 * once went blank on older iPhones). Suspense draws nothing while it waits, so
 * without this a failure is an empty page with no way on. Reloading fetches
 * the current files and fixes the first two; the message covers the third.
 */
class Boundary extends Component<{ children: ReactNode }, State> {
  override state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  override componentDidCatch(error: unknown) {
    console.error("[page] failed to load or render:", error);
  }

  override render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div className="mx-auto flex max-w-md flex-col items-center gap-4 rounded-2xl bg-white/90 p-8 text-center shadow-lg backdrop-blur-md">
        <h1 className="font-editorial text-3xl text-stone-900">This page didn't load</h1>
        <p className="text-sm leading-relaxed text-stone-600">
          Reloading usually fixes it. If it keeps happening, your browser may be too old for this page — updating it, or opening Atlas in another browser, should
          work.
        </p>
        <Button className="rounded-full" onClick={() => window.location.reload()}>
          Reload
        </Button>
      </div>
    );
  }
}

/** Keyed by address, so moving to another page gives that page a fresh start rather than the last one's error. */
export function PageErrorBoundary({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  return <Boundary key={pathname}>{children}</Boundary>;
}
