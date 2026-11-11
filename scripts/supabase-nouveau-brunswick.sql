-- DossierNBrunswick : le challenge et la campagne, dans le projet Supabase de DossierQuébec.
-- À exécuter UNE FOIS : SQL Editor → coller → Run. Re-exécutable sans erreur.
-- Tables PRÉFIXÉES nb_ (même modèle que bc_ et on_) : avant, le site écrivait dans
-- bill_flags et bill_campaign de DQ, où le PL 1 du N.-B. se mêlait au PL 1 du Québec.
-- Les identifiants du N.-B. valent législature × 100 000 + session × 1 000 + numéro
-- (6103014 = n° 14, 3e session de la 61e). Ceux de Données Québec sont à 5 chiffres :
-- les lignes du N.-B. déjà versées chez DQ se reconnaissent sans ambiguïté et sont recopiées.

create table if not exists public.nb_bill_flags (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  bill_id bigint not null,
  created_at timestamptz not null default now(),
  unique (user_id, bill_id)
);
alter table public.nb_bill_flags enable row level security;

create or replace function public.nb_my_recent_flag_count()
returns integer
language sql stable security definer set search_path = public as $$
  select count(*)::int from public.nb_bill_flags
  where user_id = auth.uid() and created_at > now() - interval '30 days';
$$;
revoke execute on function public.nb_my_recent_flag_count() from public, anon;
grant execute on function public.nb_my_recent_flag_count() to authenticated;

drop policy if exists "nb insert own flag" on public.nb_bill_flags;
drop policy if exists "nb select own flag" on public.nb_bill_flags;
drop policy if exists "nb delete own flag" on public.nb_bill_flags;
drop policy if exists "nb admins view all flags" on public.nb_bill_flags;
create policy "nb insert own flag" on public.nb_bill_flags for insert
  with check (auth.uid() = user_id and public.nb_my_recent_flag_count() < 10);
create policy "nb select own flag" on public.nb_bill_flags for select
  using (auth.uid() = user_id);
create policy "nb delete own flag" on public.nb_bill_flags for delete
  using (auth.uid() = user_id);
create policy "nb admins view all flags" on public.nb_bill_flags for select
  using (exists (select 1 from public.admins a where a.user_id = auth.uid()));
grant select, insert, delete on public.nb_bill_flags to authenticated;
grant select, insert, update, delete on public.nb_bill_flags to service_role;

create or replace function public.nb_flag_counts()
returns table (bill_id bigint, cnt bigint)
language sql stable security definer set search_path = public as $$
  select bill_id, count(*)::bigint as cnt
  from public.nb_bill_flags
  group by bill_id
  having count(*) >= 1
  order by count(*) desc;
$$;
grant execute on function public.nb_flag_counts() to anon, authenticated;

create or replace function public.nb_flag_counts_all()
returns table (bill_id bigint, cnt bigint)
language sql stable security definer set search_path = public as $$
  select bill_id, count(*)::bigint as cnt
  from public.nb_bill_flags
  group by bill_id;
$$;
revoke execute on function public.nb_flag_counts_all() from public, anon, authenticated;
grant execute on function public.nb_flag_counts_all() to service_role;

create table if not exists public.nb_bill_campaign (
  bill_id bigint primary key,
  last_count int not null default 0,
  threshold int not null default 1000,
  escalation_pending boolean not null default false,
  terminal_notified boolean not null default false,
  updated_at timestamptz not null default now()
);
alter table public.nb_bill_campaign enable row level security;
grant select, insert, update, delete on public.nb_bill_campaign to service_role;

drop policy if exists "nb admins read campaign" on public.nb_bill_campaign;
drop policy if exists "nb admins write campaign" on public.nb_bill_campaign;
drop policy if exists "nb admins update campaign" on public.nb_bill_campaign;
drop policy if exists "nb admins delete campaign" on public.nb_bill_campaign;
create policy "nb admins read campaign" on public.nb_bill_campaign for select
  using (exists (select 1 from public.admins a where a.user_id = auth.uid()));
create policy "nb admins write campaign" on public.nb_bill_campaign for insert
  with check (exists (select 1 from public.admins a where a.user_id = auth.uid()));
create policy "nb admins update campaign" on public.nb_bill_campaign for update
  using (exists (select 1 from public.admins a where a.user_id = auth.uid()));
create policy "nb admins delete campaign" on public.nb_bill_campaign for delete
  using (exists (select 1 from public.admins a where a.user_id = auth.uid()));
grant select, insert, update, delete on public.nb_bill_campaign to authenticated;

drop trigger if exists refus_lecture_seule_nb_bill_flags on public.nb_bill_flags;
create trigger refus_lecture_seule_nb_bill_flags before insert or update or delete on public.nb_bill_flags
  for each row execute function public.refus_lecture_seule();

-- Recopie des lignes du N.-B. déjà versées dans les tables de DQ (copie seulement, rien n'est effacé chez DQ).
insert into public.nb_bill_flags (user_id, bill_id, created_at)
  select user_id, bill_id, created_at from public.bill_flags
  where bill_id between 6100000 and 6199999
  on conflict (user_id, bill_id) do nothing;
insert into public.nb_bill_campaign (bill_id, last_count, threshold, escalation_pending, terminal_notified, updated_at)
  select bill_id, last_count, threshold, escalation_pending, terminal_notified, updated_at from public.bill_campaign
  where bill_id between 6100000 and 6199999
  on conflict (bill_id) do nothing;
