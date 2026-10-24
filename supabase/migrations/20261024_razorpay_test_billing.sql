-- RhymeOrbit Razorpay sandbox ledger. No real payments or paid benefits.
-- All tables are server-only and protected by RLS and explicit grants.
create table if not exists public.billing_test_subscriptions (
  id text primary key check (id ~ '^sub_[A-Za-z0-9]+$'),
  user_id uuid not null references auth.users(id) on delete cascade,
  plan text not null check (plan in ('premium','pro')),
  cycle text not null check (cycle in ('monthly','annual')),
  razorpay_plan_id text not null check (razorpay_plan_id ~ '^plan_[A-Za-z0-9]+$'),
  status text not null default 'created',
  last_event_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists billing_test_subscriptions_user_idx
  on public.billing_test_subscriptions(user_id,created_at desc);
alter table public.billing_test_subscriptions enable row level security;
revoke all on table public.billing_test_subscriptions from public,anon,authenticated;
grant select,insert,update on table public.billing_test_subscriptions to service_role;

create table if not exists public.billing_test_webhook_events (
  event_id text primary key,
  subscription_id text not null references public.billing_test_subscriptions(id) on delete cascade,
  event_type text not null,
  event_status text not null,
  event_at timestamptz not null,
  received_at timestamptz not null default now()
);
create index if not exists billing_test_events_subscription_idx
  on public.billing_test_webhook_events(subscription_id,received_at desc);
alter table public.billing_test_webhook_events enable row level security;
revoke all on table public.billing_test_webhook_events from public,anon,authenticated;
grant select,insert on table public.billing_test_webhook_events to service_role;

-- Called exclusively by the signed Razorpay TEST webhook backend with its service key.
-- No access to public.subscriptions: test events must NEVER grant paid entitlements.
create or replace function public.ro_record_test_razorpay_event(
  p_event_id text, p_subscription_id text, p_plan_id text,
  p_event_type text, p_status text, p_event_at timestamptz
)
returns jsonb language plpgsql security definer
set search_path = ''
as $func$
declare
  v_plan text;
  v_inserted integer := 0;
  v_updated integer := 0;
begin
  if auth.role() <> 'service_role' then
    raise exception 'service role only';
  end if;
  if p_event_id is null or length(p_event_id) < 5 or length(p_event_id) > 180
      or p_subscription_id !~ '^sub_[A-Za-z0-9]+$'
      or p_plan_id !~ '^plan_[A-Za-z0-9]+$'
      or p_event_type !~ '^subscription\.[a-z_]+$'
      or p_status !~ '^[a-z_]+$'
      or p_event_at is null then
    raise exception 'invalid Razorpay test event';
  end if;
  select razorpay_plan_id into v_plan
    from public.billing_test_subscriptions
    where id=p_subscription_id for update;
  if not found or v_plan<>p_plan_id then
    return jsonb_build_object('tracked',false,'duplicate',false);
  end if;
  insert into public.billing_test_webhook_events(
      event_id,subscription_id,event_type,event_status,event_at)
    values(p_event_id,p_subscription_id,p_event_type,p_status,p_event_at)
    on conflict(event_id) do nothing;
  get diagnostics v_inserted = row_count;
  if v_inserted=0 then
    return jsonb_build_object('tracked',true,'duplicate',true);
  end if;
  update public.billing_test_subscriptions
    set status=p_status, last_event_at=p_event_at, updated_at=now()
    where id=p_subscription_id and
      (last_event_at is null or last_event_at<=p_event_at);
  get diagnostics v_updated = row_count;
  return jsonb_build_object('tracked',true,'duplicate',false,'updated',v_updated>0);
end
$func$;
revoke all on function public.ro_record_test_razorpay_event(
  text,text,text,text,text,timestamptz) from public,anon,authenticated;
grant execute on function public.ro_record_test_razorpay_event(
  text,text,text,text,text,timestamptz) to service_role;
