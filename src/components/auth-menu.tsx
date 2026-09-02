import { LogIn } from "lucide-react";
import { useState } from "react";
import { Link, useLocation } from "react-router";

import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";

/** Initials for someone with no picture — two letters at most. */
function initials(name: string | null, email: string | null): string {
  const source = name?.trim() || email?.split("@")[0] || "?";
  const parts = source.split(/[\s._-]+/).filter(Boolean);
  return parts
    .slice(0, 2)
    .map(part => part[0]?.toUpperCase() ?? "")
    .join("");
}

/**
 * Sign-in for the nav bar.
 *
 * There is deliberately no dropdown: the only things to offer a signed-in
 * person are their plan and a way out, and both live on `/account`. The avatar
 * is a link there.
 */
export function AuthMenu({ className }: { className?: string }) {
  const { ready, configured, user, signInWithGoogle } = useAuth();
  const [busy, setBusy] = useState(false);
  const { pathname, hash } = useLocation();

  // A build with no Supabase keys cannot sign anyone in, so it offers nothing
  // rather than a button that fails when pressed.
  if (!configured) return null;

  // Hold the space while the stored session is read, so the nav does not show
  // "Log in" for a moment to someone who is already signed in.
  if (!ready) return <span className={cn("h-8 w-16", className)} aria-hidden />;

  if (user) {
    return (
      <Link
        to="/account"
        aria-label="Your account"
        title={user.name ?? user.email ?? "Your account"}
        className={cn(
          "flex size-8 items-center justify-center overflow-hidden rounded-full border border-stone-300 bg-white text-xs font-medium text-stone-700 transition-colors hover:border-stone-400",
          className,
        )}
      >
        {user.avatarUrl ? (
          <img src={user.avatarUrl} alt="" className="size-full object-cover" referrerPolicy="no-referrer" />
        ) : (
          initials(user.name, user.email)
        )}
      </Link>
    );
  }

  return (
    <Button
      variant="ghost"
      size="sm"
      className={cn("rounded-full text-stone-700", className)}
      disabled={busy}
      onClick={() => {
        setBusy(true);
        // Come back to whichever page they were reading, not always /account.
        signInWithGoogle(`${pathname}${hash}`).catch(error => {
          console.error("[auth] sign-in failed:", error);
          setBusy(false);
        });
      }}
    >
      <LogIn className="size-4" />
      <span className="hidden sm:inline">{busy ? "Taking you to Google…" : "Log in"}</span>
    </Button>
  );
}
