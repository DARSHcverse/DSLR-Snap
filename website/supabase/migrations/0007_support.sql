-- Support chat: one thread per conversation, from a signed-in customer (chat) or a visitor (contact
-- form). Only the website's server reads or writes these; customers see their own threads through it.

create table public.support_threads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users on delete set null,   -- null for contact-form visitors
  email text not null,
  name text,
  subject text not null,
  status text not null default 'open' check (status in ('open', 'closed')),
  unread_by_admin boolean not null default true,
  unread_by_customer boolean not null default false,
  last_message_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create index support_threads_user_idx on public.support_threads (user_id, last_message_at desc);
create index support_threads_inbox_idx on public.support_threads (status, last_message_at desc);

create table public.support_messages (
  id bigint generated always as identity primary key,
  thread_id uuid not null references public.support_threads on delete cascade,
  from_admin boolean not null,
  body text not null check (length(body) between 1 and 4000),
  created_at timestamptz not null default now()
);
create index support_messages_thread_idx on public.support_messages (thread_id, created_at);

alter table public.support_threads enable row level security;
alter table public.support_messages enable row level security;
