-- Extra booth computers bought on top of the 2 included with a plan (quantity on the Stripe subscription).
alter table public.subscriptions add column extra_devices int not null default 0;
