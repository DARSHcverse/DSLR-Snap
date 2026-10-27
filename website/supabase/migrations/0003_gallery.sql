-- Cloud gallery: a page per guest session (/s/<session id>) and per event for the host (/e/<share token>).
-- Only the website's server reads or writes these; guests reach photos through short-lived signed links.

create table public.gallery_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  app_event_id uuid not null,               -- the event's id inside the booth app
  name text not null,
  event_date date,
  share_token text not null unique,          -- the host's link
  created_at timestamptz not null default now(),
  unique (user_id, app_event_id)
);

create table public.gallery_sessions (
  id uuid primary key,                       -- the booth's random session id (it's in the QR link)
  user_id uuid not null references auth.users on delete cascade,
  event_id uuid not null references public.gallery_events on delete cascade,
  files jsonb not null default '[]',         -- [{kind, path, contentType}]
  ready_at timestamptz,                      -- set once every file is uploaded
  created_at timestamptz not null default now()
);
create index gallery_sessions_event_idx on public.gallery_sessions (event_id, created_at desc);
create index gallery_sessions_created_idx on public.gallery_sessions (created_at);

alter table public.gallery_events enable row level security;
alter table public.gallery_sessions enable row level security;

-- Private bucket: no public URLs, ever. Max 25 MB per file, images only.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('galleries', 'galleries', false, 26214400, array['image/jpeg', 'image/gif'])
on conflict (id) do nothing;
