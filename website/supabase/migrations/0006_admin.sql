-- Admin: free (complimentary) access, private notes, an activity log, and login attempts for rate
-- limiting. Only the website's server reads or writes these (row-level security, no policies).

alter table public.customer_profiles
  add column comp_active boolean not null default false,
  add column comp_until timestamptz,              -- null = no end date
  add column comp_devices int not null default 2 check (comp_devices between 1 and 50),
  add column comp_note text,
  add column admin_note text;

create table public.admin_audit (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  action text not null,                          -- e.g. "comp.on", "password.reset_link"
  user_id uuid,                                  -- the customer acted on (kept after deletion)
  user_email text,
  detail jsonb not null default '{}',
  ip text
);
create index admin_audit_at_idx on public.admin_audit (at desc);
create index admin_audit_user_idx on public.admin_audit (user_id, at desc);

create table public.admin_login_attempts (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  ip text not null,
  ok boolean not null
);
create index admin_login_attempts_idx on public.admin_login_attempts (ip, at desc);

alter table public.admin_audit enable row level security;
alter table public.admin_login_attempts enable row level security;
