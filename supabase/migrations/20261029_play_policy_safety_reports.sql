-- Safety reports are private. Authenticated users can only submit their own.
create table if not exists public.safety_reports (
  id uuid primary key default gen_random_uuid(),
  reporter uuid references auth.users(id) on delete set null,
  category text not null check (category in ('ai','community','user','message','general')),
  reference text not null default '' check (length(reference) <= 200),
  reason text not null check (char_length(btrim(reason)) between 10 and 1500),
  status text not null default 'open' check (status in ('open','reviewing','resolved')),
  created_at timestamptz not null default now()
);
create index if not exists safety_reports_status_created_idx on public.safety_reports(status,created_at desc);
alter table public.safety_reports enable row level security;
drop policy if exists "Authenticated users may submit own safety reports" on public.safety_reports;
create policy "Authenticated users may submit own safety reports"
  on public.safety_reports for insert to authenticated
  with check ((select auth.uid()) = reporter);
revoke all on public.safety_reports from anon, authenticated;
grant insert on public.safety_reports to authenticated;
grant select, insert, update, delete on public.safety_reports to service_role;
