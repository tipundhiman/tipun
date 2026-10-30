-- RhymeOrbit: restrict reading existing match/chat records to adult accounts.
-- A one-time DOB declaration alone is not verified parental consent or identity proof.
DROP POLICY IF EXISTS "read matched conversation" ON public.creator_messages;
CREATE POLICY "read matched conversation" ON public.creator_messages
 FOR SELECT TO authenticated
 USING ((select public.ro_is_adult()) AND public.can_read_conversation(sender, recipient));
DROP POLICY IF EXISTS "read own swipes" ON public.creator_swipes;
CREATE POLICY "read own swipes" ON public.creator_swipes
 FOR SELECT TO authenticated
 USING (actor=(select auth.uid()) AND (select public.ro_is_adult()));
DROP POLICY IF EXISTS "read own follows" ON public.creator_follows;
CREATE POLICY "read own follows" ON public.creator_follows
 FOR SELECT TO authenticated
 USING (follower=(select auth.uid()) AND (select public.ro_is_adult()));
