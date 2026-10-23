-- Run once in Supabase SQL Editor. Existing tables and songs are not deleted.
create table if not exists public.generated_songs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  task_id text not null,
  title text not null default 'My AI Song',
  voice text not null default 'auto',
  status text not null default 'pending',
  storage_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id,task_id)
);
create index if not exists generated_songs_user_created_idx on public.generated_songs(user_id,created_at desc);
alter table public.generated_songs enable row level security;
drop policy if exists generated_songs_owner_select on public.generated_songs;
create policy generated_songs_owner_select on public.generated_songs for select to authenticated using (user_id=auth.uid());
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values ('song-audio','song-audio',false,20000000,array['audio/mpeg','application/octet-stream'])
on conflict (id) do nothing;
-- Private bucket: server-side service role handles uploads and signed playback URLs.
