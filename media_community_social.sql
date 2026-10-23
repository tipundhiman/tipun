-- Apply after community_feed.sql and media_community_sync.sql.
-- Media creators may update their own captions; Community remains read/interact only.
drop policy if exists "Authors edit posts" on public.community_posts;
create policy "Authors edit posts" on public.community_posts for update to authenticated using (auth.uid()=user_id) with check (auth.uid()=user_id);
-- creator_media must have its existing owner-only UPDATE policy. Add if missing.
alter table public.creator_media enable row level security;
drop policy if exists "Creators edit own media titles" on public.creator_media;
create policy "Creators edit own media titles" on public.creator_media for update to authenticated using (auth.uid()=owner) with check (auth.uid()=owner);
create table if not exists public.community_follows (
 follower_id uuid not null references auth.users(id) on delete cascade,
 following_id uuid not null references auth.users(id) on delete cascade,
 created_at timestamptz not null default now(),
 primary key(follower_id,following_id),
 constraint no_self_follow check (follower_id<>following_id)
);
alter table public.community_follows enable row level security;
drop policy if exists "Read follows" on public.community_follows;
create policy "Read follows" on public.community_follows for select to anon,authenticated using(true);
drop policy if exists "Follow users" on public.community_follows;
create policy "Follow users" on public.community_follows for insert to authenticated with check(auth.uid()=follower_id);
drop policy if exists "Unfollow users" on public.community_follows;
create policy "Unfollow users" on public.community_follows for delete to authenticated using(auth.uid()=follower_id);
