-- Align quota reservation with /api/music/credits for cancelled and expired plans.
CREATE OR REPLACE FUNCTION public.ro_reserve_song(p_user uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
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
    -- Expired/cancelled paid plans downgrade to the Free tier.
    -- Previous generations in the same UTC month still count toward Free 3.
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
$function$
