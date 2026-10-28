-- Emails: per-customer preferences, and a log that makes each email send once even when Stripe or
-- Supabase retries the event that triggered it. Only the website's server reads or writes these.

create table public.customer_profiles (
  user_id uuid primary key references auth.users on delete cascade,
  welcomed_at timestamptz,                     -- welcome email sent (first confirmed sign-in)
  updates_opt_out_at timestamptz,              -- unsubscribed from product update emails
  unsubscribe_token text not null unique default replace(gen_random_uuid()::text, '-', ''),  -- 122 random bits, built in
  created_at timestamptz not null default now()
);

create table public.email_log (
  key text primary key,                        -- e.g. "checkout:cs_…", "welcome:<user>"
  to_email text not null,
  template text not null,
  sent_at timestamptz not null default now()
);
create index email_log_sent_idx on public.email_log (sent_at desc);

alter table public.customer_profiles enable row level security;
alter table public.email_log enable row level security;
