-- LyricalStudio database schema.
-- Run once in the Supabase dashboard: SQL Editor → New query → paste → Run.

create table if not exists public.likes (
  user_id    uuid not null references auth.users (id) on delete cascade,
  video_id   text not null,
  track      jsonb not null,
  created_at timestamptz not null default now(),
  primary key (user_id, video_id)
);

-- Row Level Security: each user can only see and change their own likes.
alter table public.likes enable row level security;

drop policy if exists "read own likes" on public.likes;
create policy "read own likes" on public.likes
  for select using (auth.uid() = user_id);

drop policy if exists "add own likes" on public.likes;
create policy "add own likes" on public.likes
  for insert with check (auth.uid() = user_id);

drop policy if exists "remove own likes" on public.likes;
create policy "remove own likes" on public.likes
  for delete using (auth.uid() = user_id);
