-- Allow admin to grant only bounded Free, Premium or Pro subscriptions.
-- Payment flows must still verify Play purchase tokens before writing entitlements.
CREATE OR REPLACE FUNCTION public.admin_set_subscription(p_actor_id uuid, p_target_user_id uuid, p_plan text, p_monthly_limit integer, p_expires_at timestamp with time zone DEFAULT NULL::timestamp with time zone)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.admin_users
    WHERE user_id = p_actor_id
  ) THEN
    RETURN false;
  END IF;

  IF p_plan NOT IN ('free', 'premium', 'pro')
     OR p_monthly_limit IS NULL
     OR (p_plan = 'free' AND p_monthly_limit <> 3)
     OR (p_plan = 'premium' AND (p_monthly_limit < 1 OR p_monthly_limit > 35))
     OR (p_plan = 'pro' AND (p_monthly_limit < 1 OR p_monthly_limit > 75))
  THEN
    RETURN false;
  END IF;

  INSERT INTO public.subscriptions (
    user_id, plan, status, monthly_song_limit,
    expires_at, updated_at
  )
  VALUES (
    p_target_user_id, p_plan, 'active',
    p_monthly_limit, p_expires_at, now()
  )
  ON CONFLICT (user_id)
  DO UPDATE SET
    plan = EXCLUDED.plan,
    status = EXCLUDED.status,
    monthly_song_limit = EXCLUDED.monthly_song_limit,
    expires_at = EXCLUDED.expires_at,
    updated_at = now();

  RETURN true;
END;
$function$
