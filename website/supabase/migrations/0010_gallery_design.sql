-- DSLR Snap Cloud phase 2: each event's look, and the operator's default look for new events.
alter table public.gallery_events add column design jsonb;          -- null = the operator's default
alter table public.customer_profiles add column brand_design jsonb; -- null = DSLR Snap's own look
