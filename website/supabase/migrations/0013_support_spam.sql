-- Contact-form sales pitches (SEO, marketing and web agencies) go to a "spam" status: kept out of
-- the inbox and the unread count, never emailed to the team, and can be moved back if misjudged.
alter table public.support_threads drop constraint if exists support_threads_status_check;
alter table public.support_threads add constraint support_threads_status_check check (status in ('open', 'closed', 'spam'));
alter table public.support_threads add column if not exists spam_reason text;
