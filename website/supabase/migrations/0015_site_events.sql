-- Website visits and important clicks, for the admin's Website page. First-party and cookieless:
-- `visitor` is a one-way code that changes every day (see src/lib/siteEvents.ts), and `user_id` is
-- set only when the visitor was signed in. Only the server (service role) reads or writes this table.
create table if not exists public.site_events (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  name text not null check (name ~ '^[a-z_]{1,32}$'),
  label text check (char_length(label) <= 120),
  path text check (char_length(path) <= 200),
  source text check (char_length(source) <= 60),
  visitor text check (char_length(visitor) <= 32),
  user_id uuid references auth.users on delete set null,
  country text check (country ~ '^[A-Z]{2}$'),
  device text check (device in ('phone', 'tablet', 'computer'))
);
create index if not exists site_events_at_idx on public.site_events (at);
create index if not exists site_events_name_at_idx on public.site_events (name, at);
create index if not exists site_events_visitor_idx on public.site_events (visitor, at) where source is not null;
alter table public.site_events enable row level security; -- no policies: nobody but the server

-- Everything the Website page shows for one period, in one call. "People" are counted once a day,
-- because the visitor code changes daily.
create or replace function public.site_stats(p_since timestamptz)
returns jsonb
language sql
stable
set search_path = public
as $$
  with e as (
    select *, (at at time zone 'Europe/London')::date as day
    from public.site_events
    where at >= p_since
  )
  select jsonb_build_object(
    'visitors', (select count(distinct (day, visitor)) from e where name = 'view' and visitor is not null),
    'views', (select count(*) from e where name = 'view'),
    'downloads', (select count(*) from e where name = 'download'),
    'downloaders', (select count(distinct (day, coalesce(visitor, id::text))) from e where name = 'download'),
    'days', (
      select coalesce(jsonb_agg(d order by d.day), '[]'::jsonb) from (
        select day,
          count(distinct visitor) filter (where name = 'view') as visitors,
          count(*) filter (where name = 'download') as downloads
        from e group by day
      ) d
    ),
    'clicks', (
      select coalesce(jsonb_agg(c order by c.n desc), '[]'::jsonb) from (
        select name, coalesce(label, '') as label, count(*) as n,
          count(distinct (day, visitor)) filter (where visitor is not null) as people
        from e where name <> 'view'
        group by name, coalesce(label, '')
        order by count(*) desc
        limit 60
      ) c
    ),
    'pages', (
      select coalesce(jsonb_agg(p order by p.views desc), '[]'::jsonb) from (
        select path, count(*) as views, count(distinct (day, visitor)) filter (where visitor is not null) as people
        from e where name = 'view'
        group by path order by count(*) desc limit 15
      ) p
    ),
    'sources', (
      select coalesce(jsonb_agg(s order by s.people desc), '[]'::jsonb) from (
        select source, count(distinct (day, visitor)) as people
        from e where name = 'view' and source is not null and visitor is not null
        group by source order by 2 desc limit 15
      ) s
    ),
    'countries', (
      select coalesce(jsonb_agg(c order by c.people desc), '[]'::jsonb) from (
        select coalesce(country, '') as country, count(distinct (day, visitor)) as people
        from e where name = 'view' and visitor is not null
        group by 1 order by 2 desc limit 12
      ) c
    ),
    'devices', (
      select coalesce(jsonb_agg(d order by d.people desc), '[]'::jsonb) from (
        select coalesce(device, 'computer') as device, count(distinct (day, visitor)) as people
        from e where name = 'view' and visitor is not null
        group by 1
      ) d
    )
  );
$$;

-- The latest downloads, each with where that visitor had arrived from that day.
create or replace function public.site_recent_downloads(p_limit int default 30)
returns table (at timestamptz, label text, user_id uuid, country text, device text, source text)
language sql
stable
set search_path = public
as $$
  select d.at, d.label, d.user_id, d.country, d.device,
    (
      select v.source from public.site_events v
      where v.visitor = d.visitor and v.source is not null and v.at between d.at - interval '1 day' and d.at
      order by v.at desc limit 1
    )
  from public.site_events d
  where d.name = 'download'
  order by d.at desc
  limit least(greatest(p_limit, 1), 100);
$$;

revoke execute on function public.site_stats(timestamptz) from public, anon, authenticated;
revoke execute on function public.site_recent_downloads(int) from public, anon, authenticated;
grant execute on function public.site_stats(timestamptz) to service_role;
grant execute on function public.site_recent_downloads(int) to service_role;
