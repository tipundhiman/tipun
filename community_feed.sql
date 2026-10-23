-- Run once in Supabase SQL Editor before enabling Community Feed.
create extension if not exists pgcrypto;
create table if not exists public.community_posts (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 author_name text not null check (char_length(author_name) between 1 and 80),
 caption text not null default '' check (char_length(caption)<=1500),
 media_path text unique,
 media_type text check (media_type in ('image','video','audio')),
 created_at timestamptz not null default now(),
 check ((media_path is null and media_type is null) or (media_path is not null and media_type is not null)),
 check (char_length(trim(caption))>0 or media_path is not null),
 check (media_path is null or media_path like user_id::text || '/%')
);
create table if not exists public.community_likes (
 post_id uuid not null references public.community_posts(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade,
 created_at timestamptz not null default now(),
 primary key(post_id,user_id)
);
create table if not exists public.community_comments (
 id uuid primary key default gen_random_uuid(),
 post_id uuid not null references public.community_posts(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade,
 author_name text not null check (char_length(author_name) between 1 and 80),
 body text not null check (char_length(trim(body)) between 1 and 500),
 created_at timestamptz not null default now()
);
create index if not exists community_posts_latest on public.community_posts(created_at desc);
create index if not exists community_comments_post on public.community_comments(post_id,created_at);
alter table public.community_posts enable row level security;
alter table public.community_likes enable row level security;
alter table public.community_comments enable row level security;
create policy "Everyone reads posts" on public.community_posts for select to anon,authenticated using (true);
create policy "Authors publish posts" on public.community_posts for insert to authenticated with check (auth.uid()=user_id);
create policy "Authors delete posts" on public.community_posts for delete to authenticated using (auth.uid()=user_id);
create policy "Everyone reads likes" on public.community_likes for select to anon,authenticated using (true);
create policy "Users like as themselves" on public.community_likes for insert to authenticated with check (auth.uid()=user_id);
create policy "Users unlike as themselves" on public.community_likes for delete to authenticated using (auth.uid()=user_id);
create policy "Everyone reads comments" on public.community_comments for select to anon,authenticated using (true);
create policy "Users comment as themselves" on public.community_comments for insert to authenticated with check (auth.uid()=user_id);
create policy "Users delete own comments" on public.community_comments for delete to authenticated using (auth.uid()=user_id);
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values ('community-media','community-media',true,26214400,array['image/jpeg','image/png','image/webp','image/gif','video/mp4','video/webm','audio/mpeg','audio/mp4','audio/wav','audio/ogg'])
on conflict(id) do update set public=true,file_size_limit=26214400,allowed_mime_types=excluded.allowed_mime_types;
create policy "Community media public read" on storage.objects for select to anon,authenticated using (bucket_id='community-media');
create policy "Community users upload own media" on storage.objects for insert to authenticated with check (bucket_id='community-media' and (storage.foldername(name))[1]=auth.uid()::text);
create policy "Community users delete own media" on storage.objects for delete to authenticated using (bucket_id='community-media' and (storage.foldername(name))[1]=auth.uid()::text);
