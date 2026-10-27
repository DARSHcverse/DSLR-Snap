-- Accounts, subscriptions and booth computers for DSLR Snap.
-- Run once in the Supabase SQL editor (or `supabase db push`). Logins themselves live in auth.users.
--
-- Only the website's server (secret key) writes these tables. Signed-in customers may read their
-- own subscription and computers; nothing else is exposed to the browser.

create table public.customers (
  user_id uuid primary key references auth.users on delete cascade,
  stripe_customer_id text not null unique,
  created_at timestamptz not null default now()
);

-- Mirrors Stripe; written only by the webhook, never from the browser.
create table public.subscriptions (
  id text primary key,                       -- Stripe subscription id
  user_id uuid not null references auth.users on delete cascade,
  status text not null,                      -- Stripe status: active, past_due, canceled, …
  plan text check (plan in ('monthly', 'yearly')),
  price_id text,
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  updated_at timestamptz not null default now()
);
create index subscriptions_user_idx on public.subscriptions (user_id);

-- Booth computers signed in to an account. Removing one (revoked_at) frees a slot.
create table public.devices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  machine_hash text not null,
  name text not null,
  refresh_token_hash text unique,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz,
  revoked_at timestamptz,
  unique (user_id, machine_hash)
);

-- One-time codes from the "Open DSLR Snap" page, bound to the app's PKCE challenge. Valid 10 minutes.
create table public.app_sign_in_codes (
  code_hash text primary key,
  user_id uuid not null references auth.users on delete cascade,
  challenge text not null,
  expires_at timestamptz not null,
  used_at timestamptz
);

alter table public.customers enable row level security;
alter table public.subscriptions enable row level security;
alter table public.devices enable row level security;
alter table public.app_sign_in_codes enable row level security;

create policy "read own subscriptions" on public.subscriptions for select to authenticated using ((select auth.uid()) = user_id);
create policy "read own devices" on public.devices for select to authenticated using ((select auth.uid()) = user_id);

-- Signs a computer in, enforcing the per-account limit atomically (two PCs signing in at the same
-- moment can't both take the last slot). Signing in again on a known computer replaces its token,
-- so a copied token stops working.
create or replace function public.claim_device(
  p_user uuid, p_machine text, p_name text, p_token_hash text, p_max int
) returns table (ok boolean, active_names text[])
language plpgsql security definer set search_path = public as $$
declare
  v_active boolean;
  v_count int;
begin
  perform pg_advisory_xact_lock(hashtext(p_user::text));

  select d.revoked_at is null into v_active from devices d where d.user_id = p_user and d.machine_hash = p_machine;

  if not coalesce(v_active, false) then
    select count(*) into v_count from devices d where d.user_id = p_user and d.revoked_at is null;
    if v_count >= p_max then
      return query select false, array(
        select d.name from devices d where d.user_id = p_user and d.revoked_at is null order by d.last_seen_at desc nulls last
      );
      return;
    end if;
  end if;

  insert into devices (user_id, machine_hash, name, refresh_token_hash, last_seen_at)
  values (p_user, p_machine, p_name, p_token_hash, now())
  on conflict (user_id, machine_hash) do update
    set name = excluded.name, refresh_token_hash = excluded.refresh_token_hash, revoked_at = null, last_seen_at = now();

  return query select true, null::text[];
end $$;

revoke execute on function public.claim_device(uuid, text, text, text, int) from public, anon, authenticated;
