-- RhymeOrbit Google Play billing preparation.
-- Pro must be a valid subscription plan BEFORE any paid transactions are allowed.
-- No paid entitlements are issued by this migration.
ALTER TABLE public.subscriptions DROP CONSTRAINT IF EXISTS subscriptions_plan_check;
ALTER TABLE public.subscriptions ADD CONSTRAINT subscriptions_plan_check
  CHECK (plan IN ('free','premium','pro'));
