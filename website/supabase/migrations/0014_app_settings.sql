-- Settings that follow an operator between booth computers: their saved camera settings ("My
-- settings") and, when they choose to share it, a booth setup (preferences and templates) another
-- computer can copy. Written and read only by the website's server for a signed-in booth.
create table public.app_settings (
  user_id uuid primary key references auth.users on delete cascade,
  camera_presets jsonb not null default '[]',
  camera_presets_at timestamptz,
  booth_setup jsonb,
  booth_setup_at timestamptz
);
alter table public.app_settings enable row level security;
