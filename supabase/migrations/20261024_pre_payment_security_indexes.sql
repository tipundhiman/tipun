-- RhymeOrbit: tighten public messaging RPCs and optimize creator/community joins.
-- Keep authenticated user lookups functioning; functions check auth.uid() internally.
revoke execute on function public.can_message(uuid,uuid) from public,anon;
revoke execute on function public.can_read_conversation(uuid,uuid) from public,anon;
grant execute on function public.can_message(uuid,uuid) to authenticated;
grant execute on function public.can_read_conversation(uuid,uuid) to authenticated;

-- Explicit foreign-key indexes improve community-feed, message and moderation queries.
create index if not exists ro_idx_community_comments_user on public.community_comments(user_id);
create index if not exists ro_idx_community_follows_following on public.community_follows(following_id);
create index if not exists ro_idx_community_likes_user on public.community_likes(user_id);
create index if not exists ro_idx_community_posts_user on public.community_posts(user_id);
create index if not exists ro_idx_creator_blocks_blocked on public.creator_blocks(blocked);
create index if not exists ro_idx_creator_follows_followed on public.creator_follows(followed);
create index if not exists ro_idx_creator_messages_recipient on public.creator_messages(recipient);
create index if not exists ro_idx_creator_reports_reported on public.creator_reports(reported);
create index if not exists ro_idx_creator_reports_reporter on public.creator_reports(reporter);
create index if not exists ro_idx_creator_swipes_target on public.creator_swipes(target);
