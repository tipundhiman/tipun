-- RhymeOrbit: atomic song reservation for authenticated Free/Premium/Pro members.
-- Run once in Supabase SQL Editor before enabling public Treblo generation.
create table if not exists public.music_generation_reservations (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 task_id text unique,
 status text not null default 'reserved' check (status in ('reserved','submitted','completed','refunded')),
 month_start date not null,
 created_at timestamptz not null default now()
);
create index if not exists music_reservation_user_idx on public.music_generation_reservations(user_id,created_at desc);
alter table public.music_generation_reservations enable row level security;
revoke all on public.music_generation_reservations from anon,authenticated;
create or replace function public.ro_reserve_song(p_user uuid)
returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare v_limit integer;v_used integer;v_reserved integer;v_id uuid;v_month date:=date_trunc('month',now() at time zone 'UTC')::date;
begin
 if auth.role() <> 'service_role' then raise exception 'service role required';end if;
 perform pg_advisory_xact_lock(hashtextextended(p_user::text,0));
 select case when plan='free' then 3 else coalesce(monthly_song_limit,0) end into v_limit
 from public.subscriptions where user_id=p_user and status='active' and (expires_at is null or expires_at>now()) limit 1;
 if not found then
   if exists(select 1 from public.subscriptions where user_id=p_user) then raise exception 'subscription inactive';end if;
   v_limit:=3;
 end if;
 if v_limit<=0 then raise exception 'song quota exhausted';end if;
 insert into public.music_usage(user_id,month_start,songs_used,songs_reserved)
 values(p_user,v_month,0,0) on conflict(user_id,month_start) do nothing;
 select songs_used,songs_reserved into v_used,v_reserved from public.music_usage where user_id=p_user and month_start=v_month for update;
 if v_used+v_reserved>=v_limit then raise exception 'song quota exhausted';end if;
 update public.music_usage set songs_reserved=songs_reserved+1 where user_id=p_user and month_start=v_month;
 insert into public.music_generation_reservations(user_id,month_start) values(p_user,v_month) returning id into v_id;
 return v_id;
end $$;
create or replace function public.ro_finish_song(p_user uuid,p_reservation uuid,p_task text,p_success boolean)
returns boolean language plpgsql security definer set search_path=public,pg_temp as $$
declare v public.music_generation_reservations%rowtype;
begin
 if auth.role()<>'service_role' then raise exception 'service role required';end if;
 perform pg_advisory_xact_lock(hashtextextended(p_user::text,0));
 select * into v from public.music_generation_reservations where id=p_reservation and user_id=p_user for update;
 if not found or v.status<>'reserved' then return false;end if;
 update public.music_generation_reservations set status=case when p_success then 'submitted' else 'refunded' end,task_id=case when p_success then p_task else null end where id=p_reservation;
 update public.music_usage set songs_reserved=greatest(0,songs_reserved-1),songs_used=songs_used+case when p_success then 1 else 0 end where user_id=p_user and month_start=v.month_start;
 return true;
end $$;
revoke all on function public.ro_reserve_song(uuid) from public,anon,authenticated;
revoke all on function public.ro_finish_song(uuid,uuid,text,boolean) from public,anon,authenticated;
grant execute on function public.ro_reserve_song(uuid) to service_role;
grant execute on function public.ro_finish_song(uuid,uuid,text,boolean) to service_role;
