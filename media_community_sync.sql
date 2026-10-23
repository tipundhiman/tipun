-- Run in Supabase SQL Editor after community_feed.sql, before merging the PR.
alter table public.community_posts add column if not exists media_bucket text not null default 'community-media';
alter table public.community_posts drop constraint if exists community_posts_media_bucket_check;
alter table public.community_posts add constraint community_posts_media_bucket_check check (media_bucket in ('community-media','creator-media'));
-- Backfill ALL existing Media uploads into Community, without duplicating files.
insert into public.community_posts(user_id,author_name,caption,media_path,media_type,media_bucket,created_at)
select m.owner, left(coalesce(nullif(u.raw_user_meta_data->>'full_name',''),nullif(u.raw_user_meta_data->>'name',''),'Creator'),80),
 left(coalesce(nullif(m.title,''),'Shared a new creation'),1500),m.storage_path,m.kind,'creator-media',m.created_at
from public.creator_media m join auth.users u on u.id=m.owner
where m.kind in ('image','video','audio')
and not exists(select 1 from public.community_posts p where p.media_bucket='creator-media' and p.media_path=m.storage_path)
on conflict (media_path) do nothing;
drop policy if exists "Authors publish posts" on public.community_posts;
create policy "Authors publish posts" on public.community_posts for insert to authenticated
with check (auth.uid()=user_id and (
 (media_bucket='community-media' and (media_path is null or media_path like auth.uid()::text||'/%'))
 or (media_bucket='creator-media' and media_path is not null and exists (
 select 1 from public.creator_media m where m.owner=auth.uid() and m.storage_path=media_path and m.kind=media_type
 ))
));
-- The existing creator-media bucket must allow public SELECT for playback in Community.
