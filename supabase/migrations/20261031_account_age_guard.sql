-- RhymeOrbit: self-declared birth date for account age and age-restricted social access.
-- Under-13 visitors use offline Kids Studio and must not create online accounts.
-- This is NOT government identity verification or verified parental consent.
CREATE TABLE IF NOT EXISTS public.ro_account_ages (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  birth_date date NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.ro_account_ages ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.ro_account_ages FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT ON public.ro_account_ages TO authenticated;
GRANT ALL ON public.ro_account_ages TO service_role;
DROP POLICY IF EXISTS "Read own account age" ON public.ro_account_ages;
CREATE POLICY "Read own account age" ON public.ro_account_ages
  FOR SELECT TO authenticated USING (user_id = (select auth.uid()));
DROP POLICY IF EXISTS "Declare own age once" ON public.ro_account_ages;
CREATE POLICY "Declare own age once" ON public.ro_account_ages
  FOR INSERT TO authenticated WITH CHECK (user_id = (select auth.uid()));

CREATE OR REPLACE FUNCTION public.ro_validate_birth_date()
RETURNS trigger LANGUAGE plpgsql SET search_path = ''
AS $$
BEGIN
  IF NEW.birth_date IS NULL
     OR NEW.birth_date > (current_date - interval '13 years')::date
     OR NEW.birth_date < (current_date - interval '120 years')::date
  THEN
    RAISE EXCEPTION 'Online RhymeOrbit accounts require a valid birth date and age of at least 13';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.ro_validate_birth_date() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS ro_validate_birth_date_insert ON public.ro_account_ages;
CREATE TRIGGER ro_validate_birth_date_insert
  BEFORE INSERT ON public.ro_account_ages
  FOR EACH ROW EXECUTE FUNCTION public.ro_validate_birth_date();

-- Capture birth dates supplied on a new user's signup. Users can later edit
-- raw_user_meta_data, but cannot update or delete the trusted one-time row.
CREATE OR REPLACE FUNCTION public.ro_record_signup_birth_date()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE dob date; raw_dob text;
BEGIN
  raw_dob := new.raw_user_meta_data ->> 'birth_date';
  IF raw_dob IS NULL OR raw_dob = '' THEN RETURN new; END IF;
  IF raw_dob !~ '^\d{4}-\d{2}-\d{2}$' THEN
    RAISE EXCEPTION 'Invalid date of birth';
  END IF;
  BEGIN
    dob := raw_dob::date;
  EXCEPTION WHEN others THEN
    RAISE EXCEPTION 'Invalid date of birth';
  END;
  INSERT INTO public.ro_account_ages(user_id, birth_date) VALUES(new.id,dob);
  RETURN new;
END;
$$;
REVOKE ALL ON FUNCTION public.ro_record_signup_birth_date() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS ro_capture_signup_birth_date ON auth.users;
CREATE TRIGGER ro_capture_signup_birth_date
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.ro_record_signup_birth_date();

-- Evaluate social eligibility from a protected DB table, not mutable JWT/user metadata.
CREATE OR REPLACE FUNCTION public.ro_is_adult()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.ro_account_ages
    WHERE user_id = (select auth.uid()) AND birth_date <= (current_date - interval '18 years')::date
  );
$$;
REVOKE ALL ON FUNCTION public.ro_is_adult() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ro_is_adult() TO authenticated, service_role;

-- Social interactions are adult-only until age-appropriate community moderation
-- and teen safeguards are independently reviewed.
DROP POLICY IF EXISTS "swipe as self" ON public.creator_swipes;
CREATE POLICY "swipe as self" ON public.creator_swipes FOR INSERT TO authenticated
  WITH CHECK (actor=(select auth.uid()) AND (select public.ro_is_adult())
    AND NOT EXISTS (SELECT 1 FROM public.creator_blocks b
      WHERE (b.blocker=creator_swipes.actor AND b.blocked=creator_swipes.target)
         OR (b.blocker=creator_swipes.target AND b.blocked=creator_swipes.actor)));
DROP POLICY IF EXISTS "update own swipe" ON public.creator_swipes;
CREATE POLICY "update own swipe" ON public.creator_swipes FOR UPDATE TO authenticated
  USING (actor=(select auth.uid()) AND (select public.ro_is_adult()))
  WITH CHECK (actor=(select auth.uid()) AND (select public.ro_is_adult()));
DROP POLICY IF EXISTS "follow as self" ON public.creator_follows;
CREATE POLICY "follow as self" ON public.creator_follows FOR INSERT TO authenticated
  WITH CHECK (follower=(select auth.uid()) AND (select public.ro_is_adult())
    AND NOT EXISTS (SELECT 1 FROM public.creator_blocks b
      WHERE (b.blocker=creator_follows.follower AND b.blocked=creator_follows.followed)
         OR (b.blocker=creator_follows.followed AND b.blocked=creator_follows.follower)));
DROP POLICY IF EXISTS "send to mutual match" ON public.creator_messages;
CREATE POLICY "send to mutual match" ON public.creator_messages FOR INSERT TO authenticated
  WITH CHECK (sender=(select auth.uid()) AND (select public.ro_is_adult())
    AND public.can_message(sender,recipient));
DROP POLICY IF EXISTS "Authors publish posts" ON public.community_posts;
CREATE POLICY "Authors publish posts" ON public.community_posts FOR INSERT TO authenticated
  WITH CHECK (user_id=(select auth.uid()) AND (select public.ro_is_adult()));
DROP POLICY IF EXISTS "upload own media metadata" ON public.creator_media;
CREATE POLICY "upload own media metadata" ON public.creator_media FOR INSERT TO authenticated
  WITH CHECK (owner=(select auth.uid()) AND (select public.ro_is_adult())
    AND storage_path LIKE ((select auth.uid())::text || '/%'));

-- Account-age records are not a license to charge users: paid checkout stays off
-- until Google Play purchases are verified, acknowledged, and reconciled server-side.
