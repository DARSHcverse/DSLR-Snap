-- DSLR Snap Cloud phase 3: the operator's public homepage, per-event analytics, and albums.

-- Homepage (dslrsnap.com/b/<slug>)
alter table public.customer_profiles
  add column business_slug text unique check (business_slug ~ '^[a-z0-9](?:[a-z0-9-]{1,38}[a-z0-9])$'),
  add column business_name text,
  add column business_tagline text,
  add column business_links jsonb not null default '[]',   -- [{label, url}], up to 5
  add column book_url text,
  add column homepage_enabled boolean not null default false;
alter table public.gallery_events
  add column show_on_homepage boolean not null default false; -- opt-in per event: clients' photos are never public by default

-- Analytics: daily counters per event, and the day's visitor hashes for "unique visitors".
create table public.gallery_stats (
  event_id uuid not null references public.gallery_events on delete cascade,
  day date not null,
  views int not null default 0,           -- event gallery opened
  session_views int not null default 0,   -- a guest's own QR page opened
  downloads int not null default 0,       -- single photo/GIF/video downloads
  zips int not null default 0,            -- "download all"
  slideshows int not null default 0,      -- slideshow opened
  primary key (event_id, day)
);
create table public.gallery_visitors (
  event_id uuid not null references public.gallery_events on delete cascade,
  day date not null,
  visitor text not null,                  -- sha256 of ip + browser + day + server secret: no cookies, can't be reversed
  primary key (event_id, day, visitor)
);
alter table public.gallery_stats enable row level security;
alter table public.gallery_visitors enable row level security;

create function public.record_gallery_hit(p_event uuid, p_kind text, p_visitor text)
returns void language plpgsql security definer set search_path = public as $$
declare d date := (now() at time zone 'Europe/London')::date;
begin
  insert into gallery_stats (event_id, day) values (p_event, d) on conflict do nothing;
  update gallery_stats set
    views = views + (p_kind = 'view')::int,
    session_views = session_views + (p_kind = 'session_view')::int,
    downloads = downloads + (p_kind = 'download')::int,
    zips = zips + (p_kind = 'zip')::int,
    slideshows = slideshows + (p_kind = 'slideshow')::int
  where event_id = p_event and day = d;
  if p_visitor is not null then
    insert into gallery_visitors (event_id, day, visitor) values (p_event, d, p_visitor) on conflict do nothing;
  end if;
end $$;
revoke execute on function public.record_gallery_hit(uuid, text, text) from public, anon, authenticated;
grant execute on function public.record_gallery_hit(uuid, text, text) to service_role;

-- Albums inside an event
create table public.gallery_albums (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.gallery_events on delete cascade,
  user_id uuid not null references auth.users on delete cascade,
  name text not null check (length(name) between 1 and 60),
  position int not null default 0,
  created_at timestamptz not null default now()
);
create index gallery_albums_event_idx on public.gallery_albums (event_id, position);
alter table public.gallery_albums enable row level security;
alter table public.gallery_sessions add column album_id uuid references public.gallery_albums on delete set null;
