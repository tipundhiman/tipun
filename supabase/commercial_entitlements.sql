-- RhymeOrbit: one safe, repeatable script for the existing database.
-- Free users keep 3 songs/month; protected active Premium/Pro records
-- may receive up to 35/75, capped by monthly_song_limit respectively.
-- Test Razorpay tables do not grant production entitlements.

CREATE OR REPLACE FUNCTION public.ro_reserve_song(p_user uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_plan text;
  v_configured integer;
  v_limit integer;
  v_used integer;
  v_reserved integer;
  v_id uuid;
  v_month date := date_trunc('month', now() at time zone 'UTC')::date;
BEGIN
  IF auth.role() <> 'service_role' THEN
    RAISE EXCEPTION 'service role required';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(p_user::text, 0));

  SELECT plan, monthly_song_limit INTO v_plan, v_configured
  FROM public.subscriptions
  WHERE user_id = p_user AND status = 'active'
    AND (expires_at IS NULL OR expires_at > now())
  LIMIT 1;

  IF NOT FOUND THEN
    IF EXISTS (SELECT 1 FROM public.subscriptions WHERE user_id = p_user) THEN
      RAISE EXCEPTION 'subscription inactive';
    END IF;
    v_limit := 3;
  ELSE
    v_limit := CASE v_plan
      WHEN 'free' THEN 3
      WHEN 'premium' THEN LEAST(35, GREATEST(0, COALESCE(v_configured, 0)))
      WHEN 'pro' THEN LEAST(75, GREATEST(0, COALESCE(v_configured, 0)))
      ELSE 0
    END;
  END IF;

  IF v_limit <= 0 THEN
    RAISE EXCEPTION 'song quota exhausted';
  END IF;

  INSERT INTO public.music_usage(user_id, month_start, songs_used, songs_reserved)
  VALUES (p_user, v_month, 0, 0)
  ON CONFLICT (user_id, month_start) DO NOTHING;

  SELECT songs_used, songs_reserved INTO v_used, v_reserved
  FROM public.music_usage
  WHERE user_id = p_user AND month_start = v_month
  FOR UPDATE;

  IF v_used + v_reserved >= v_limit THEN
    RAISE EXCEPTION 'song quota exhausted';
  END IF;

  UPDATE public.music_usage
  SET songs_reserved = songs_reserved + 1
  WHERE user_id = p_user AND month_start = v_month;

  INSERT INTO public.music_generation_reservations(user_id, month_start)
  VALUES (p_user, v_month)
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

-- Only our backend service key is allowed to reserve song quota.
REVOKE ALL ON FUNCTION public.ro_reserve_song(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ro_reserve_song(uuid) TO service_role;

-- Trigger-only helpers have no reason to be callable via the Data API.
REVOKE ALL ON FUNCTION public.create_profile_on_signup() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.sync_creator_card() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.rls_auto_enable() FROM PUBLIC, anon, authenticated;

