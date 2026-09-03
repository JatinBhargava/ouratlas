-- Atlas: accounts, subscriptions and the waitlist.
--
-- Run this once in the Supabase SQL editor (or `supabase db push`). It is
-- written to be safe to re-run.
--
-- What is stored here is deliberately narrow: who someone is, what they pay
-- for, and whether they asked to hear from us. Photographs and story text are
-- never sent to the server and have no table.

-- ---------------------------------------------------------------------------
-- profiles: one row per account, mirroring auth.users
-- ---------------------------------------------------------------------------

create table if not exists public.profiles (
  id                 uuid primary key references auth.users (id) on delete cascade,
  email              text,
  full_name          text,
  avatar_url         text,
  -- Set the first time someone reaches checkout, then reused so a person
  -- never ends up with two customer records at the processor. One column per
  -- provider: the ids are not interchangeable, and keeping both means a
  -- switch does not orphan the history on the other side.
  stripe_customer_id text unique,
  dodo_customer_id   text unique,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

alter table public.profiles enable row level security;

drop policy if exists "profiles: read own" on public.profiles;
create policy "profiles: read own"
  on public.profiles for select
  using (auth.uid() = id);

drop policy if exists "profiles: update own" on public.profiles;
create policy "profiles: update own"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- Google hands back name and picture in raw_user_meta_data; copy them across
-- on signup so the UI has something to show without another round trip.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, avatar_url)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'),
    coalesce(new.raw_user_meta_data ->> 'avatar_url', new.raw_user_meta_data ->> 'picture')
  )
  on conflict (id) do update
    set email      = excluded.email,
        full_name  = coalesce(excluded.full_name, public.profiles.full_name),
        avatar_url = coalesce(excluded.avatar_url, public.profiles.avatar_url),
        updated_at = now();
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert or update on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- subscriptions: Stripe's state, mirrored so the app can read it cheaply
-- ---------------------------------------------------------------------------
--
-- Stripe remains the source of truth. This table exists so a page load does
-- not have to call the Stripe API, and is only ever written by the webhook.

create table if not exists public.subscriptions (
  -- The processor's subscription id, so a replayed webhook overwrites in
  -- place rather than inserting a duplicate.
  id                   text primary key,
  user_id              uuid not null references auth.users (id) on delete cascade,
  -- Which processor this row came from. Defaulted for rows written before
  -- Dodo existed, all of which were Stripe's.
  provider             text not null default 'stripe' check (provider in ('stripe', 'dodo')),
  -- Stripe's own vocabulary plus Dodo's: active, trialing, past_due,
  -- on_hold, paused, cancelled, expired, failed, pending. Deliberately not a
  -- check constraint — a processor adding a state should not start rejecting
  -- webhooks, and `getActiveSubscription` decides which of them entitle.
  status               text not null,
  plan                 text not null check (plan in ('traveller', 'cartographer')),
  -- A Stripe price id, or a Dodo product id. Dodo has no separate price
  -- object: the product carries its own price.
  price_id             text,
  current_period_end   timestamptz,
  cancel_at_period_end boolean not null default false,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

create index if not exists subscriptions_user_id_idx on public.subscriptions (user_id);

alter table public.subscriptions enable row level security;

-- Read-only to the person it belongs to. There is deliberately no insert or
-- update policy: nothing but the webhook (service role) may write here, or a
-- browser could grant itself a plan.
drop policy if exists "subscriptions: read own" on public.subscriptions;
create policy "subscriptions: read own"
  on public.subscriptions for select
  using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- payments: one row per invoice, as a ledger
-- ---------------------------------------------------------------------------
--
-- `subscriptions` holds current state and is overwritten in place; this holds
-- history and is only ever appended to. Neither can answer the other's
-- question: "what plan is this person on" against the first, "what have they
-- actually been charged" against this one.
--
-- Amounts are in the currency's minor unit, exactly as Stripe sends them
-- (829 = $8.29). Storing a decimal here would invite rounding drift against
-- the figures on the invoice.

create table if not exists public.payments (
  -- The Stripe invoice id. A retried delivery or a later status change for
  -- the same invoice updates this row rather than adding another.
  id                 text primary key,
  user_id            uuid not null references auth.users (id) on delete cascade,
  provider           text not null default 'stripe' check (provider in ('stripe', 'dodo')),

  -- Deliberately NOT a foreign key to public.subscriptions.
  --
  -- Stripe does not guarantee event order, and invoice.paid frequently
  -- arrives before customer.subscription.created. A reference would reject
  -- those rows and lose exactly the payments that matter most — the first one
  -- of every new subscription. Kept as a plain id, joined when both exist.
  subscription_id    text,

  -- Stripe's own invoice status: paid, open, void, uncollectible, draft.
  status             text not null,
  -- Whether the last attempt failed, which the status alone does not say:
  -- a failed payment leaves the invoice `open`, not `failed`.
  last_attempt_failed boolean not null default false,

  amount_due         integer not null,
  amount_paid        integer not null,
  currency           text not null,

  -- Handed straight to the customer for a receipt, so neither the app nor the
  -- server has to render one.
  invoice_number     text,
  hosted_invoice_url text,
  invoice_pdf        text,

  period_start       timestamptz,
  period_end         timestamptz,
  paid_at            timestamptz,

  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

-- The one query the app makes: this person's invoices, newest first.
create index if not exists payments_user_created_idx
  on public.payments (user_id, created_at desc);

alter table public.payments enable row level security;

-- Read-only to the person who paid, and written only by the webhook holding
-- the service-role key. As with subscriptions, there is no insert or update
-- policy on purpose: a browser that could write here could invent a receipt.
drop policy if exists "payments: read own" on public.payments;
create policy "payments: read own"
  on public.payments for select
  using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- Migrations for databases created before Dodo Payments
-- ---------------------------------------------------------------------------
--
-- `create table if not exists` above does nothing to a table that already
-- exists, so the new columns are added here as well. Both forms are safe to
-- re-run, which is the rule this file is written to.

alter table public.profiles      add column if not exists dodo_customer_id text unique;
alter table public.subscriptions add column if not exists provider text not null default 'stripe';
alter table public.payments      add column if not exists provider text not null default 'stripe';

-- An older database has the status check constraint; Dodo's vocabulary is
-- wider, so it goes.
alter table public.subscriptions drop constraint if exists subscriptions_status_check;

-- ---------------------------------------------------------------------------
-- waitlist: the newsletter sign-up
-- ---------------------------------------------------------------------------

create table if not exists public.waitlist (
  id         uuid primary key default gen_random_uuid(),
  email      text not null,
  -- Which part of the site the address came from, so a later mailing can be
  -- addressed to the right expectation.
  source     text not null default 'footer',
  created_at timestamptz not null default now()
);

-- Case-insensitive uniqueness, so Ada@ and ada@ are one subscriber. This is
-- also what the server's upsert conflict target relies on.
create unique index if not exists waitlist_email_key on public.waitlist (lower(email));

alter table public.waitlist enable row level security;

-- No policies at all is the point: the list is writable only through the
-- server's service-role key, and readable by nobody holding the anon key.
-- Anyone who scrapes the public key still cannot enumerate the mailing list.

-- ---------------------------------------------------------------------------
-- exports: one row per issue sent out as a PDF
-- ---------------------------------------------------------------------------
--
-- The only reason this table exists is to count. Nothing about the magazine
-- itself is recorded — not the title, not the story, not a photograph, not
-- even how many pages it ran to. A row means "this account exported something
-- at this time", which is the least that can answer "how many this month".
--
-- Kept server-side because the browser cannot be asked to police a limit it
-- benefits from ignoring. The count is the entitlement; the client is only
-- ever told the answer.

create table if not exists public.exports (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

-- The only query this table serves: this account, this month, newest first.
create index if not exists exports_user_created_idx on public.exports (user_id, created_at desc);

alter table public.exports enable row level security;

-- Readable by its owner so an account page could show a tally; written only
-- through the service-role key, because a row here is what spends an
-- allowance and the browser must not be able to forge or withhold one.
drop policy if exists "exports: read own" on public.exports;
create policy "exports: read own"
  on public.exports for select
  using (auth.uid() = user_id);
