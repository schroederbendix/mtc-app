-- MTC app: accounts, journal data, sharing rules. Additive only.

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null default '',
  phone text not null default '',
  level text not null default '',
  goals jsonb not null default '[]'::jsonb,
  change_note text not null default '',
  share_with_coach boolean not null default false,
  is_client boolean not null default false,
  role text not null default 'player' check (role in ('player','admin')),
  plan text not null default 'founder',
  joined_at timestamptz not null default now()
);

create table public.entries (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  date date not null,
  type text not null default '',
  rating int,
  purpose int,
  rehearsed boolean not null default false,
  answers jsonb not null default '{}'::jsonb,
  goals jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index entries_user_date_idx on public.entries(user_id, date desc);

create table public.reflections (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  week date not null,
  answers jsonb not null default '{}'::jsonb,
  goals jsonb not null default '[]'::jsonb,
  stats jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (user_id, week)
);

create table public.identity_versions (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  date date not null,
  text text not null default '',
  created_at timestamptz not null default now()
);
create index identity_user_idx on public.identity_versions(user_id, created_at desc);

create table public.player_state (
  user_id uuid primary key references auth.users(id) on delete cascade default auth.uid(),
  leading_phrases jsonb not null default '[]'::jsonb,
  lessons_done jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

-- helper functions
create function public.is_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.profiles where id = (select auth.uid()) and role = 'admin');
$$;

create function public.coach_can_read(uid uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select public.is_admin() and exists (
    select 1 from public.profiles p where p.id = uid and (p.share_with_coach or p.is_client)
  );
$$;

-- admin list: basic info + activity counts only, never content or ratings
create function public.admin_players() returns table (
  id uuid, name text, phone text, level text, plan text, joined_at timestamptz,
  share_with_coach boolean, is_client boolean, entries_total bigint, entries_7d bigint, last_entry date
) language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'not allowed'; end if;
  return query
    select p.id, p.name, p.phone, p.level, p.plan, p.joined_at, p.share_with_coach, p.is_client,
      count(e.id), count(e.id) filter (where e.date >= current_date - 6), max(e.date)
    from public.profiles p left join public.entries e on e.user_id = p.id
    where p.role = 'player'
    group by p.id order by p.joined_at;
end $$;

create function public.admin_set_client(uid uuid, val boolean) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'not allowed'; end if;
  update public.profiles set is_client = val where id = uid;
end $$;

-- new user -> profile (role and plan are never taken from user input)
create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, name, phone)
  values (new.id,
    left(coalesce(new.raw_user_meta_data->>'name',''), 80),
    left(coalesce(new.raw_user_meta_data->>'phone',''), 40));
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- row level security
alter table public.profiles enable row level security;
alter table public.entries enable row level security;
alter table public.reflections enable row level security;
alter table public.identity_versions enable row level security;
alter table public.player_state enable row level security;

create policy profiles_select on public.profiles for select to authenticated
  using (id = (select auth.uid()) or public.coach_can_read(id));
create policy profiles_update on public.profiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

do $$ declare t text; begin
  foreach t in array array['entries','reflections','identity_versions'] loop
    execute format('create policy %I on public.%I for select to authenticated using (user_id = (select auth.uid()) or public.coach_can_read(user_id))', t||'_select', t);
    execute format('create policy %I on public.%I for insert to authenticated with check (user_id = (select auth.uid()))', t||'_insert', t);
    execute format('create policy %I on public.%I for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()))', t||'_update', t);
    execute format('create policy %I on public.%I for delete to authenticated using (user_id = (select auth.uid()))', t||'_delete', t);
  end loop;
end $$;
create policy state_select on public.player_state for select to authenticated
  using (user_id = (select auth.uid()) or public.coach_can_read(user_id));
create policy state_insert on public.player_state for insert to authenticated with check (user_id = (select auth.uid()));
create policy state_update on public.player_state for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- grants: nothing for anon; players can only edit their own safe profile columns
revoke all on public.profiles, public.entries, public.reflections, public.identity_versions, public.player_state from anon, authenticated;
grant select on public.profiles to authenticated;
grant update (name, phone, level, goals, change_note, share_with_coach) on public.profiles to authenticated;
grant select, insert, update, delete on public.entries, public.reflections, public.identity_versions to authenticated;
grant select, insert, update on public.player_state to authenticated;

revoke execute on all functions in schema public from public, anon, authenticated;
grant execute on function public.is_admin(), public.coach_can_read(uuid), public.admin_players(), public.admin_set_client(uuid, boolean) to authenticated;
