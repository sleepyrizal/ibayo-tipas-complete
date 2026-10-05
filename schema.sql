-- =====================================================================
-- Barangay Ibayo-Tipas Portal - Supabase database setup
-- Paste this WHOLE file into: Supabase Dashboard > SQL Editor > New query > Run
-- It is safe to run more than once.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. TABLES
-- ---------------------------------------------------------------------
create table if not exists public.applications (
  id             uuid primary key default gen_random_uuid(),
  tracking_code  text not null unique,
  full_name      text not null,
  document_type  text not null,
  doc_val        text,
  phone_number   text not null,
  address        text not null,
  purpose        text not null,
  status         text not null default 'Under Review'
                 check (status in ('Under Review','Processing','For Signature',
                                   'Ready for Pickup','Released','Rejected')),
  pickup_date    text,
  remarks        text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz
);

create table if not exists public.reklamo (
  id              uuid primary key default gen_random_uuid(),
  ticket_id       text not null unique,
  full_name       text not null default 'Anonymous',
  phone_number    text not null,
  complaint_type  text not null,
  location        text not null,
  details         text not null,
  status          text not null default 'Under Review'
                  check (status in ('Under Review','Dispatched Patrol',
                                    'For Lupon Hearing','Resolved')),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz
);

-- ---------------------------------------------------------------------
-- 2. ROW LEVEL SECURITY
--    Residents (anonymous visitors) get NO direct access to the tables.
--    They can only use the three functions below.
--    Logged-in staff (Supabase Auth users) can read / update / delete.
-- ---------------------------------------------------------------------
alter table public.applications enable row level security;
alter table public.reklamo      enable row level security;

drop policy if exists "staff full access applications" on public.applications;
create policy "staff full access applications"
  on public.applications for all
  to authenticated
  using (true) with check (true);

drop policy if exists "staff full access reklamo" on public.reklamo;
create policy "staff full access reklamo"
  on public.reklamo for all
  to authenticated
  using (true) with check (true);

-- ---------------------------------------------------------------------
-- 3. HELPER: random, hard-to-guess code (no 0/O/1/I to avoid confusion)
-- ---------------------------------------------------------------------
create or replace function public.gen_code(prefix text, len int)
returns text
language plpgsql
set search_path = public
as $$
declare
  alphabet text  := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';  -- 32 characters
  b        bytea := uuid_send(gen_random_uuid());        -- 16 random bytes
  result   text  := '';
  i        int;
begin
  for i in 0 .. least(len, 6) - 1 loop
    result := result || substr(alphabet, (get_byte(b, i) % 32) + 1, 1);
  end loop;
  return prefix || result;
end;
$$;

revoke all on function public.gen_code(text, int) from public;

-- ---------------------------------------------------------------------
-- 4. RESIDENT FUNCTION: submit a document request
--    Returns the new tracking code, e.g. BIT-2026-K7M4Q2
-- ---------------------------------------------------------------------
create or replace function public.submit_application(
  p_full_name     text,
  p_document_type text,
  p_doc_val       text,
  p_phone_number  text,
  p_address       text,
  p_purpose       text,
  p_pickup_date   text
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_code  text;
  v_tries int := 0;
begin
  if length(trim(coalesce(p_full_name, ''))) < 2   or length(p_full_name)   > 120 then
    raise exception 'Invalid name';
  end if;
  if length(trim(coalesce(p_phone_number, ''))) < 7 or length(p_phone_number) > 20 then
    raise exception 'Invalid phone number';
  end if;
  if length(trim(coalesce(p_address, ''))) < 3     or length(p_address)     > 250 then
    raise exception 'Invalid address';
  end if;
  if length(trim(coalesce(p_purpose, ''))) < 2     or length(p_purpose)     > 250 then
    raise exception 'Invalid purpose';
  end if;
  if length(trim(coalesce(p_document_type, ''))) < 2 or length(p_document_type) > 120 then
    raise exception 'Invalid document type';
  end if;

  loop
    v_code := public.gen_code('BIT-' || to_char(now(), 'YYYY') || '-', 6);
    begin
      insert into public.applications
        (tracking_code, full_name, document_type, doc_val,
         phone_number, address, purpose, pickup_date)
      values
        (v_code, trim(p_full_name), trim(p_document_type), left(p_doc_val, 40),
         trim(p_phone_number), trim(p_address), trim(p_purpose), left(p_pickup_date, 120));
      return v_code;
    exception when unique_violation then
      v_tries := v_tries + 1;
      if v_tries > 5 then
        raise;
      end if;
    end;
  end loop;
end;
$$;

revoke all on function public.submit_application(text,text,text,text,text,text,text) from public;
grant execute on function public.submit_application(text,text,text,text,text,text,text)
  to anon, authenticated;

-- ---------------------------------------------------------------------
-- 5. RESIDENT FUNCTION: submit an e-Reklamo
--    Returns the new ticket id, e.g. TICKET-IBAYO-4KQ9M
-- ---------------------------------------------------------------------
create or replace function public.submit_reklamo(
  p_full_name      text,
  p_phone_number   text,
  p_complaint_type text,
  p_location       text,
  p_details        text
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_code  text;
  v_tries int := 0;
  v_name  text := coalesce(nullif(trim(p_full_name), ''), 'Anonymous');
begin
  if length(v_name) > 120 then
    raise exception 'Invalid name';
  end if;
  if length(trim(coalesce(p_phone_number, ''))) < 7 or length(p_phone_number) > 20 then
    raise exception 'Invalid phone number';
  end if;
  if length(trim(coalesce(p_complaint_type, ''))) < 2 or length(p_complaint_type) > 120 then
    raise exception 'Invalid complaint type';
  end if;
  if length(trim(coalesce(p_location, ''))) < 3 or length(p_location) > 250 then
    raise exception 'Invalid location';
  end if;
  if length(trim(coalesce(p_details, ''))) < 5 or length(p_details) > 2000 then
    raise exception 'Invalid details';
  end if;

  loop
    v_code := public.gen_code('TICKET-IBAYO-', 5);
    begin
      insert into public.reklamo
        (ticket_id, full_name, phone_number, complaint_type, location, details)
      values
        (v_code, v_name, trim(p_phone_number), trim(p_complaint_type),
         trim(p_location), trim(p_details));
      return v_code;
    exception when unique_violation then
      v_tries := v_tries + 1;
      if v_tries > 5 then
        raise;
      end if;
    end;
  end loop;
end;
$$;

revoke all on function public.submit_reklamo(text,text,text,text,text) from public;
grant execute on function public.submit_reklamo(text,text,text,text,text)
  to anon, authenticated;

-- ---------------------------------------------------------------------
-- 6. RESIDENT FUNCTION: live tracker
--    Looks up ONE record by its exact tracking code and returns ONLY
--    the name, the request, the status and the pickup schedule.
--    Phone number, address and purpose are never returned.
--
--    Want to hide part of the name? Replace  a.full_name  below with:
--      regexp_replace(a.full_name, '(\S)\S+', '\1.', 'g')
--    (shows "Maria Santos Cruz" as "M. S. C.")
-- ---------------------------------------------------------------------
create or replace function public.track_application(p_code text)
returns table (
  tracking_code text,
  full_name     text,
  document_type text,
  status        text,
  pickup_date   text
)
language sql
security definer
stable
set search_path = public
as $$
  select a.tracking_code, a.full_name, a.document_type, a.status, a.pickup_date
  from public.applications a
  where a.tracking_code = upper(trim(p_code))
  limit 1;
$$;

revoke all on function public.track_application(text) from public;
grant execute on function public.track_application(text) to anon, authenticated;
