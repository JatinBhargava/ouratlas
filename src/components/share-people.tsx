import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { Dialog } from "radix-ui";
import { Check, Copy, KeyRound, Loader2, Trash2, UserPlus, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { clearCode, getMembers, invite, joinWithCode, removeMember, setCode } from "@/lib/saved";
import { cn } from "@/lib/utils";
import type { MemberRole, MembersResponse } from "@/types";

/** "ABCD2345" as people read it out: "ABCD-2345". */
const spaced = (code: string) => `${code.slice(0, 4)}-${code.slice(4)}`;

function Shell({
  open,
  onOpenChange,
  kicker,
  title,
  description,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  kicker: string;
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/55 backdrop-blur-sm" />
        <Dialog.Content className="fixed top-1/2 left-1/2 z-50 flex max-h-[90dvh] w-[min(calc(100vw-2rem),500px)] -translate-x-1/2 -translate-y-1/2 flex-col gap-5 overflow-y-auto rounded-2xl bg-white p-5 text-stone-800 shadow-2xl sm:p-6">
          <header className="flex items-start justify-between gap-4">
            <div className="flex flex-col gap-1">
              <span className="text-[10px] font-medium tracking-[0.28em] text-stone-500 uppercase">{kicker}</span>
              <Dialog.Title className="font-editorial text-2xl tracking-tight">{title}</Dialog.Title>
              <Dialog.Description className="text-sm text-stone-600">{description}</Dialog.Description>
            </div>
            <Dialog.Close asChild>
              <Button variant="ghost" size="icon" className="shrink-0 rounded-full" aria-label="Close">
                <X className="size-4" />
              </Button>
            </Dialog.Close>
          </header>
          {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

/** Read or Edit, as two buttons. Edit is offered only where the magazine kept its editable copy. */
function RoleChoice({ value, onChange, canEdit, label }: { value: MemberRole; onChange: (role: MemberRole) => void; canEdit: boolean; label: string }) {
  return (
    <div role="group" aria-label={label} className="flex shrink-0 rounded-full bg-stone-100 p-0.5 ring-1 ring-stone-200">
      {(["read", "edit"] as const).map(role => (
        <button
          key={role}
          type="button"
          disabled={role === "edit" && !canEdit}
          aria-pressed={value === role}
          onClick={() => onChange(role)}
          title={role === "edit" && !canEdit ? "This magazine was saved without editing" : undefined}
          className={cn(
            "rounded-full px-3 py-1 text-xs transition-colors disabled:cursor-not-allowed disabled:opacity-40",
            value === role ? "bg-white text-stone-900 shadow-sm" : "text-stone-500 hover:text-stone-800",
          )}
        >
          {role === "read" ? "Read" : "Edit"}
        </button>
      ))}
    </div>
  );
}

/**
 * Who a saved magazine is shared with, for its owner: people by email address,
 * each to read or to edit, and a group code that anyone with its password can
 * join with. Only the owner sees this; the people it is shared with see the
 * magazine in their own My magazines.
 */
export function PeopleDialog({
  id,
  title,
  editable,
  open,
  onOpenChange,
  onChanged,
}: {
  id: string;
  title: string;
  /** Whether the magazine kept its editable copy, which edit access needs. */
  editable: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** After any change, with how many people it is now shared with and whether a code is on. */
  onChanged: (members: number, hasCode: boolean) => void;
}) {
  const [state, setState] = useState<MembersResponse | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<MemberRole>(editable ? "edit" : "read");
  const [password, setPassword] = useState("");
  const [codeRole, setCodeRole] = useState<MemberRole>("read");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!open) return;
    setFailed(null);
    getMembers(id)
      .then(next => {
        setState(next);
        if (next.code) setCodeRole(next.code.role);
      })
      .catch(cause => setFailed(cause instanceof Error ? cause.message : "Could not read who it is shared with."));
  }, [open, id]);

  /** Runs one change, shows the list it hands back, and tells the card. */
  const act = async (what: string, change: () => Promise<MembersResponse>) => {
    setBusy(what);
    setFailed(null);
    try {
      const next = await change();
      setState(next);
      onChanged(next.members.length, next.code !== null);
      return true;
    } catch (cause) {
      setFailed(cause instanceof Error ? cause.message : "That did not work. Try again.");
      return false;
    } finally {
      setBusy(null);
    }
  };

  const add = async (event: FormEvent) => {
    event.preventDefault();
    if (await act("invite", () => invite(id, email.trim(), role))) setEmail("");
  };

  const saveCode = async (event: FormEvent) => {
    event.preventDefault();
    if (await act("code", () => setCode(id, password, codeRole))) setPassword("");
  };

  const copyCode = async () => {
    if (!state?.code) return;
    await navigator.clipboard.writeText(spaced(state.code.code));
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <Shell
      open={open}
      onOpenChange={onOpenChange}
      kicker="Share with people"
      title={title}
      description={
        editable
          ? "Invite people to read it, or to edit it with you. They find it in their own My magazines when they sign in."
          : "Invite people to read it in their own My magazines. It was saved without editing, so it can only be read."
      }
    >
      {state === null && !failed ? (
        <div className="flex justify-center py-8 text-stone-500">
          <Loader2 className="size-5 animate-spin" />
        </div>
      ) : (
        <>
          <form onSubmit={event => void add(event)} className="flex flex-col gap-2">
            <label htmlFor="invite-email" className="text-sm font-medium text-stone-900">
              Invite by email
            </label>
            <div className="flex flex-wrap items-center gap-2">
              <Input
                id="invite-email"
                type="email"
                required
                value={email}
                onChange={event => setEmail(event.target.value)}
                placeholder="name@example.com"
                className="min-w-0 flex-1"
                autoComplete="email"
              />
              <RoleChoice value={role} onChange={setRole} canEdit={editable} label="Access for this invitation" />
              <Button type="submit" className="rounded-full" disabled={busy !== null || !email.trim()}>
                {busy === "invite" ? <Loader2 className="size-4 animate-spin" /> : <UserPlus className="size-4" />}
                Invite
              </Button>
            </div>
            <p className="text-xs text-stone-500">
              {state?.mails
                ? "They get an email, and the magazine is in My magazines when they sign in with Google as that address."
                : "Tell them it is waiting: it is in My magazines when they sign in with Google as that address."}
            </p>
          </form>

          {state && state.members.length > 0 && (
            <ul className="flex flex-col divide-y divide-stone-100 rounded-xl border border-stone-200">
              {state.members.map(member => (
                <li key={member.email} className="flex flex-wrap items-center gap-2 px-3 py-2">
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate text-sm text-stone-800">{member.email}</span>
                    <span className="text-[11px] text-stone-500">
                      {member.joined ? (member.via === "code" ? "Joined with the code" : "Has it in My magazines") : "Invited — not signed in yet"}
                    </span>
                  </span>
                  <RoleChoice
                    value={member.role}
                    onChange={next => next !== member.role && void act(member.email, () => invite(id, member.email, next))}
                    canEdit={editable}
                    label={`Access for ${member.email}`}
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-8 rounded-full text-red-700 hover:text-red-800"
                    aria-label={`Stop sharing with ${member.email}`}
                    disabled={busy !== null}
                    onClick={() => void act(member.email, () => removeMember(id, member.email))}
                  >
                    {busy === member.email ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
                  </Button>
                </li>
              ))}
            </ul>
          )}

          <section className="flex flex-col gap-3 rounded-xl border border-stone-200 p-3">
            <div className="flex items-start gap-2">
              <KeyRound className="mt-0.5 size-4 shrink-0 text-stone-500" />
              <div className="flex flex-col gap-0.5">
                <h3 className="text-sm font-medium text-stone-900">Group code for this magazine</h3>
                <p className="text-xs text-stone-500">
                  A code and password for this magazine alone, to give a whole group — a family, a class, a wedding party. Anyone signed in who enters both
                  joins this magazine, with the access you choose. Your other magazines are not reached by it.
                </p>
              </div>
            </div>

            {state?.code && (
              <div className="flex flex-wrap items-center gap-2 rounded-lg bg-stone-50 px-3 py-2">
                <span className="font-mono text-lg tracking-widest text-stone-900">{spaced(state.code.code)}</span>
                <span className="text-xs text-stone-500">· {state.code.role === "edit" ? "can edit" : "can read"}</span>
                <span className="ml-auto flex gap-1">
                  <Button type="button" size="sm" variant="secondary" className="h-7 rounded-full px-2.5 text-xs" onClick={() => void copyCode()}>
                    {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
                    {copied ? "Copied" : "Copy"}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="h-7 rounded-full px-2.5 text-xs text-red-700"
                    disabled={busy !== null}
                    onClick={() => void act("clear", () => clearCode(id))}
                  >
                    Turn off
                  </Button>
                </span>
              </div>
            )}

            <form onSubmit={event => void saveCode(event)} className="flex flex-wrap items-center gap-2">
              <Input
                type="password"
                required
                minLength={6}
                value={password}
                onChange={event => setPassword(event.target.value)}
                placeholder={state?.code ? "New password" : "Choose a password"}
                className="min-w-0 flex-1"
                autoComplete="new-password"
                aria-label="Group code password"
              />
              <RoleChoice value={codeRole} onChange={setCodeRole} canEdit={editable} label="Access for people who join with the code" />
              <Button type="submit" variant="outline" className="rounded-full" disabled={busy !== null || password.length < 6}>
                {busy === "code" && <Loader2 className="size-4 animate-spin" />}
                {state?.code ? "Update" : "Make a code"}
              </Button>
            </form>
            {state?.code && <p className="text-[11px] text-stone-500">The code stays the same when you change its password or access. Turning it off and on again makes a new one; people who already joined keep their access.</p>}
          </section>
        </>
      )}

      {failed && (
        <p className="text-center text-xs text-red-600" role="alert">
          {failed}
        </p>
      )}
    </Shell>
  );
}

/**
 * Joins one magazine with its group code and password, from that magazine's
 * own page. Each saved magazine has a code of its own, checked against this
 * magazine alone; joining adds it, and only it, to My magazines.
 */
export function JoinDialog({
  open,
  onOpenChange,
  onJoined,
  issueId,
  title,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onJoined: (role: MemberRole) => void;
  issueId: string;
  title: string;
}) {
  const [code, setCodeText] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);

  const join = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setFailed(null);
    try {
      const joined = await joinWithCode(code, password, issueId);
      setCodeText("");
      setPassword("");
      onOpenChange(false);
      onJoined(joined.role);
    } catch (cause) {
      setFailed(cause instanceof Error ? cause.message : "Could not join.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Shell
      open={open}
      onOpenChange={onOpenChange}
      kicker="Join this magazine"
      title={title}
      description="Enter this magazine's code and the password its owner gave you. It joins your My magazines, to read or to edit, as the owner chose."
    >
      <form onSubmit={event => void join(event)} className="flex flex-col gap-3">
        <Input
          required
          value={code}
          onChange={event => setCodeText(event.target.value.toUpperCase())}
          placeholder="ABCD-2345"
          className="font-mono tracking-widest uppercase"
          aria-label="Group code"
          autoComplete="off"
        />
        <Input
          type="password"
          required
          value={password}
          onChange={event => setPassword(event.target.value)}
          placeholder="Password"
          aria-label="Password"
          autoComplete="current-password"
        />
        <Button type="submit" className="w-fit self-end rounded-full" disabled={busy || !code.trim() || !password}>
          {busy ? <Loader2 className="size-4 animate-spin" /> : <KeyRound className="size-4" />}
          Join
        </Button>
        {failed && (
          <p className="text-center text-xs text-red-600" role="alert">
            {failed}
          </p>
        )}
      </form>
    </Shell>
  );
}
