-- Supabase performance advisor: support reporter FK lookups/deletions.
-- Does not change access policies or user data.
CREATE INDEX IF NOT EXISTS idx_safety_reports_reporter
  ON public.safety_reports(reporter);
