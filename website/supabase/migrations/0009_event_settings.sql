-- DSLR Snap Cloud: the operator manages each event's gallery from their account.

alter table public.gallery_events
  add column link_enabled boolean not null default true,        -- the host link (/e/…) works
  add column password_hash text,                               -- scrypt; null = no password
  add column guest_access text not null default 'own' check (guest_access in ('own', 'all')), -- guests may browse the whole event
  add column allow_download_all boolean not null default true, -- "download all" on the host page
  add column show_date boolean not null default true,
  add column website_url text,                                 -- the operator's site, linked on the gallery
  add column cover_session_id uuid,                            -- the event card's photo (default: newest)
  add column edited_at timestamptz;                            -- renamed in the cloud: the booth no longer overwrites name/date

alter table public.gallery_sessions
  add column hidden_at timestamptz;                            -- hidden from the event gallery (the guest's own link still works)

create index gallery_events_user_idx on public.gallery_events (user_id, created_at desc);
