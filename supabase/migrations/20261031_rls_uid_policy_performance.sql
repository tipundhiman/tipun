-- Performance: evaluate auth.uid() once per statement instead of per row.
-- Preserve every existing RLS predicate and role without widening any access.
ALTER POLICY "Users comment as themselves" ON public.community_comments
  WITH CHECK ((SELECT auth.uid()) = user_id);
ALTER POLICY "Users delete own comments" ON public.community_comments
  USING ((SELECT auth.uid()) = user_id);
ALTER POLICY "Follow users" ON public.community_follows
  WITH CHECK ((SELECT auth.uid()) = follower_id);
ALTER POLICY "Unfollow users" ON public.community_follows
  USING ((SELECT auth.uid()) = follower_id);
ALTER POLICY "Users like as themselves" ON public.community_likes
  WITH CHECK ((SELECT auth.uid()) = user_id);
ALTER POLICY "Users unlike as themselves" ON public.community_likes
  USING ((SELECT auth.uid()) = user_id);
ALTER POLICY "Authors delete posts" ON public.community_posts
  USING ((SELECT auth.uid()) = user_id);
ALTER POLICY "Authors edit posts" ON public.community_posts
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);
ALTER POLICY "Creators edit own media titles" ON public.creator_media
  USING ((SELECT auth.uid()) = owner)
  WITH CHECK ((SELECT auth.uid()) = owner);
ALTER POLICY "delete own media metadata" ON public.creator_media
  USING (owner = (SELECT auth.uid()));
ALTER POLICY "Users read own songs" ON public.generated_songs
  USING ((SELECT auth.uid()) = user_id);
