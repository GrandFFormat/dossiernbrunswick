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

-- =============================================================================================
-- 2. Les suivis, les alertes et les préoccupations du N.-B. (11 nov. 2026)
-- Mêmes règles que DQ (plafonds, est_abonne, lecture seule), sur des tables nb_.
-- Les colonnes ville et portee restent (le code est celui de DQ) mais ne valent que 'assemblee'.
-- =============================================================================================

create table if not exists public.nb_follows (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  person_type text not null check (person_type in ('minister', 'depute')),
  person_key text not null check (length(person_key) between 1 and 200),
  created_at timestamptz not null default now(),
  unique (user_id, person_type, person_key)
);
alter table public.nb_follows enable row level security;
drop policy if exists "nb select own follows" on public.nb_follows;
drop policy if exists "nb insert own follows" on public.nb_follows;
drop policy if exists "nb delete own follows" on public.nb_follows;
create policy "nb select own follows" on public.nb_follows for select using (auth.uid() = user_id);
create policy "nb insert own follows" on public.nb_follows for insert with check (auth.uid() = user_id);
create policy "nb delete own follows" on public.nb_follows for delete using (auth.uid() = user_id);
grant select, insert, delete on public.nb_follows to authenticated;
grant select on public.nb_follows to service_role;

create or replace function public.nb_limite_follows() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if (select count(*) from public.nb_follows where user_id = new.user_id) >= 150 then
    raise exception 'limite de 150 personnes suivies atteinte';
  end if;
  return new;
end $$;
drop trigger if exists nb_limite_follows on public.nb_follows;
create trigger nb_limite_follows before insert on public.nb_follows
  for each row execute function public.nb_limite_follows();

-- public.nb_suivis existe déjà (c'est le compteur de DQ) : celui du N.-B. s'appelle nb_suivis_elus.
create or replace function public.nb_suivis_elus()
returns table (nom text, nb bigint)
language sql stable security definer set search_path = public as $$
  select split_part(person_key, '|', 1) as nom, count(distinct user_id)::bigint as nb
  from public.nb_follows
  group by split_part(person_key, '|', 1)
  having count(distinct user_id) >= 1;
$$;
grant execute on function public.nb_suivis_elus() to anon, authenticated;

create table if not exists public.nb_dossiers_suivis (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  ville text not null default 'assemblee' check (ville = 'assemblee'),
  dossier_id text not null check (length(dossier_id) between 1 and 120),
  numero text check (length(numero) <= 20),
  objet text check (length(objet) <= 600),
  created_at timestamptz not null default now(),
  unique (user_id, ville, dossier_id)
);
alter table public.nb_dossiers_suivis enable row level security;
drop policy if exists "nb select own suivis" on public.nb_dossiers_suivis;
drop policy if exists "nb insert own suivis" on public.nb_dossiers_suivis;
drop policy if exists "nb delete own suivis" on public.nb_dossiers_suivis;
create policy "nb select own suivis" on public.nb_dossiers_suivis for select using (auth.uid() = user_id);
create policy "nb insert own suivis" on public.nb_dossiers_suivis for insert with check (auth.uid() = user_id);
create policy "nb delete own suivis" on public.nb_dossiers_suivis for delete using (auth.uid() = user_id);
grant select, insert, delete on public.nb_dossiers_suivis to authenticated;
grant select on public.nb_dossiers_suivis to service_role;

create or replace function public.nb_limite_suivis() returns trigger
language plpgsql security definer set search_path = public as $$
declare plafond int;
begin
  if exists (select 1 from public.nb_dossiers_suivis
             where user_id = new.user_id and ville = new.ville and dossier_id = new.dossier_id) then
    return new;
  end if;
  plafond := case when public.est_abonne(new.user_id) then 10 else 3 end;
  if (select count(*) from public.nb_dossiers_suivis where user_id = new.user_id) >= plafond then
    raise exception 'limite de % projets suivis atteinte', plafond;
  end if;
  return new;
end $$;
drop trigger if exists nb_limite_suivis on public.nb_dossiers_suivis;
create trigger nb_limite_suivis before insert on public.nb_dossiers_suivis
  for each row execute function public.nb_limite_suivis();

create table if not exists public.nb_alertes_mots_cles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  mot text not null check (char_length(btrim(mot)) between 2 and 60),
  portee text not null default 'assemblee' check (portee = 'assemblee'),
  created_at timestamptz not null default now(),
  unique (user_id, portee, mot)
);
alter table public.nb_alertes_mots_cles enable row level security;
drop policy if exists "nb mots : lire les siens" on public.nb_alertes_mots_cles;
drop policy if exists "nb mots : ajouter les siens" on public.nb_alertes_mots_cles;
drop policy if exists "nb mots : retirer les siens" on public.nb_alertes_mots_cles;
create policy "nb mots : lire les siens" on public.nb_alertes_mots_cles for select using (auth.uid() = user_id);
create policy "nb mots : ajouter les siens" on public.nb_alertes_mots_cles for insert with check (auth.uid() = user_id);
create policy "nb mots : retirer les siens" on public.nb_alertes_mots_cles for delete using (auth.uid() = user_id);
grant select, insert, delete on public.nb_alertes_mots_cles to authenticated;
grant select on public.nb_alertes_mots_cles to service_role;

create or replace function public.nb_limite_mots_cles() returns trigger language plpgsql set search_path = '' as $$
declare plafond int;
begin
  perform pg_advisory_xact_lock(hashtext('nb-mots:' || new.user_id::text));
  plafond := case when public.est_abonne(new.user_id) then 10 else 0 end;
  if plafond = 0 then
    raise exception 'mots-clés réservés aux abonnés';
  end if;
  if (select count(*) from public.nb_alertes_mots_cles where user_id = new.user_id) >= plafond then
    raise exception 'limite de % mots-clés atteinte', plafond;
  end if;
  return new;
end $$;
drop trigger if exists nb_limite_mots_cles on public.nb_alertes_mots_cles;
create trigger nb_limite_mots_cles before insert on public.nb_alertes_mots_cles
  for each row execute function public.nb_limite_mots_cles();

create table if not exists public.nb_organismes_suivis (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  nom text not null check (char_length(btrim(nom)) between 2 and 400),
  portee text not null default 'assemblee' check (portee = 'assemblee'),
  created_at timestamptz not null default now(),
  unique (user_id, portee, nom)
);
alter table public.nb_organismes_suivis enable row level security;
drop policy if exists "nb organismes : lire les siens" on public.nb_organismes_suivis;
drop policy if exists "nb organismes : ajouter les siens" on public.nb_organismes_suivis;
drop policy if exists "nb organismes : retirer les siens" on public.nb_organismes_suivis;
create policy "nb organismes : lire les siens" on public.nb_organismes_suivis for select using (auth.uid() = user_id);
create policy "nb organismes : ajouter les siens" on public.nb_organismes_suivis for insert with check (auth.uid() = user_id);
create policy "nb organismes : retirer les siens" on public.nb_organismes_suivis for delete using (auth.uid() = user_id);
grant select, insert, delete on public.nb_organismes_suivis to authenticated;
grant select on public.nb_organismes_suivis to service_role;

create or replace function public.nb_limite_organismes_suivis() returns trigger language plpgsql set search_path = '' as $$
declare plafond int;
begin
  perform pg_advisory_xact_lock(hashtext('nb-organismes:' || new.user_id::text));
  plafond := case when public.est_abonne(new.user_id) then 10 else 0 end;
  if plafond = 0 then
    raise exception 'organismes réservés aux abonnés';
  end if;
  if (select count(*) from public.nb_organismes_suivis where user_id = new.user_id) >= plafond then
    raise exception 'limite de % organismes atteinte', plafond;
  end if;
  return new;
end $$;
drop trigger if exists nb_limite_organismes_suivis on public.nb_organismes_suivis;
create trigger nb_limite_organismes_suivis before insert on public.nb_organismes_suivis
  for each row execute function public.nb_limite_organismes_suivis();

create table if not exists public.nb_alertes_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  actif boolean not null default true,
  veille_themes text[] not null default '{}' check (
    veille_themes <@ array['sante', 'education', 'logement', 'environnement', 'economie', 'travail', 'justice',
      'immigration', 'transports', 'agriculture', 'culture', 'municipal', 'famille', 'gouvernance']::text[]),
  updated_at timestamptz not null default now()
);
alter table public.nb_alertes_preferences enable row level security;
drop policy if exists "nb alertes : lire sa préférence" on public.nb_alertes_preferences;
drop policy if exists "nb alertes : créer sa préférence" on public.nb_alertes_preferences;
drop policy if exists "nb alertes : modifier sa préférence" on public.nb_alertes_preferences;
create policy "nb alertes : lire sa préférence" on public.nb_alertes_preferences for select using (auth.uid() = user_id);
create policy "nb alertes : créer sa préférence" on public.nb_alertes_preferences for insert with check (auth.uid() = user_id);
create policy "nb alertes : modifier sa préférence" on public.nb_alertes_preferences for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
grant select, insert, update on public.nb_alertes_preferences to authenticated;
grant select, insert, update on public.nb_alertes_preferences to service_role;

create or replace function public.nb_veille_reservee_abonnes() returns trigger language plpgsql set search_path = '' as $$
begin
  if cardinality(new.veille_themes) > 0
     and (tg_op = 'INSERT' or new.veille_themes is distinct from old.veille_themes)
     and coalesce(auth.role(), '') <> 'service_role'
     and not public.est_abonne(new.user_id) then
    raise exception 'veille par thème réservée aux abonnés';
  end if;
  return new;
end $$;
drop trigger if exists nb_veille_reservee_abonnes on public.nb_alertes_preferences;
create trigger nb_veille_reservee_abonnes before insert or update on public.nb_alertes_preferences
  for each row execute function public.nb_veille_reservee_abonnes();

create table if not exists public.nb_alertes_etat (
  user_id uuid not null references auth.users(id) on delete cascade,
  ville text not null check (ville ~ '^[a-z-]{2,40}$'),
  projet text not null check (projet ~ '^[A-Za-z0-9_-]{1,60}$'),
  etat jsonb not null,
  mis_a_jour timestamptz not null default now(),
  primary key (user_id, ville, projet)
);
alter table public.nb_alertes_etat enable row level security;
grant select, insert, update, delete on public.nb_alertes_etat to service_role;

create table if not exists public.nb_alertes_envois (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  envoye_le timestamptz not null default now(),
  projets integer not null default 0,
  changements integer not null default 0,
  essai boolean not null default false
);
create index if not exists nb_alertes_envois_par_compte on public.nb_alertes_envois (user_id, envoye_le desc);
alter table public.nb_alertes_envois enable row level security;
drop policy if exists "nb alertes : lire ses envois" on public.nb_alertes_envois;
create policy "nb alertes : lire ses envois" on public.nb_alertes_envois for select using (auth.uid() = user_id);
grant select on public.nb_alertes_envois to authenticated;
grant select, insert on public.nb_alertes_envois to service_role;

create table if not exists public.nb_preoccupations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  texte text not null check (length(texte) between 3 and 2000),
  statut text not null default 'nouveau' check (statut in ('nouveau', 'classe', 'spam')),
  sujet text check (sujet is null or length(sujet) between 2 and 80),
  created_at timestamptz not null default now()
);
create index if not exists nb_preoccupations_par_statut on public.nb_preoccupations (statut, created_at);
create index if not exists nb_preoccupations_par_compte on public.nb_preoccupations (user_id, created_at desc);
alter table public.nb_preoccupations enable row level security;
drop policy if exists "nb écrire son message" on public.nb_preoccupations;
drop policy if exists "nb relire ses messages" on public.nb_preoccupations;
drop policy if exists "nb les admins lisent tout" on public.nb_preoccupations;
drop policy if exists "nb les admins corrigent" on public.nb_preoccupations;
create policy "nb écrire son message" on public.nb_preoccupations
  for insert to authenticated with check (user_id = auth.uid());
create policy "nb relire ses messages" on public.nb_preoccupations
  for select to authenticated using (user_id = auth.uid());
create policy "nb les admins lisent tout" on public.nb_preoccupations
  for select to authenticated using (exists (select 1 from public.admins a where a.user_id = auth.uid()));
create policy "nb les admins corrigent" on public.nb_preoccupations
  for update to authenticated
  using (exists (select 1 from public.admins a where a.user_id = auth.uid()))
  with check (exists (select 1 from public.admins a where a.user_id = auth.uid()));
grant insert (texte) on public.nb_preoccupations to authenticated;
grant select on public.nb_preoccupations to authenticated;
grant update (statut, sujet) on public.nb_preoccupations to authenticated;
grant select, insert, update, delete on public.nb_preoccupations to service_role;

create or replace function public.nb_preoccupations_limite() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if (select count(*) from public.nb_preoccupations
      where user_id = new.user_id and created_at > now() - interval '24 hours') >= 3 then
    raise exception 'limite de 3 messages par 24 heures atteinte';
  end if;
  return new;
end $$;
drop trigger if exists nb_preoccupations_limite on public.nb_preoccupations;
create trigger nb_preoccupations_limite before insert on public.nb_preoccupations
  for each row execute function public.nb_preoccupations_limite();

create or replace function public.nb_preoccupations_tableau()
returns json language sql stable security definer set search_path = public as $$
  select json_build_object(
    'recus', (select count(*) from public.nb_preoccupations where statut <> 'spam'),
    'sujets', coalesce((
      select json_agg(t order by t.n desc, t.sujet)
      from (select sujet, count(distinct user_id)::int as n
            from public.nb_preoccupations
            where statut = 'classe' and sujet is not null
            group by sujet) t), '[]'::json)
  );
$$;
grant execute on function public.nb_preoccupations_tableau() to anon, authenticated;

drop trigger if exists refus_lecture_seule_nb_follows on public.nb_follows;
create trigger refus_lecture_seule_nb_follows before insert or update or delete on public.nb_follows
  for each row execute function public.refus_lecture_seule();
drop trigger if exists refus_lecture_seule_nb_dossiers_suivis on public.nb_dossiers_suivis;
create trigger refus_lecture_seule_nb_dossiers_suivis before insert or update or delete on public.nb_dossiers_suivis
  for each row execute function public.refus_lecture_seule();
drop trigger if exists refus_lecture_seule_nb_alertes_mots_cles on public.nb_alertes_mots_cles;
create trigger refus_lecture_seule_nb_alertes_mots_cles before insert or update or delete on public.nb_alertes_mots_cles
  for each row execute function public.refus_lecture_seule();
drop trigger if exists refus_lecture_seule_nb_organismes_suivis on public.nb_organismes_suivis;
create trigger refus_lecture_seule_nb_organismes_suivis before insert or update or delete on public.nb_organismes_suivis
  for each row execute function public.refus_lecture_seule();
drop trigger if exists refus_lecture_seule_nb_alertes_preferences on public.nb_alertes_preferences;
create trigger refus_lecture_seule_nb_alertes_preferences before insert or update or delete on public.nb_alertes_preferences
  for each row execute function public.refus_lecture_seule();
drop trigger if exists refus_lecture_seule_nb_preoccupations on public.nb_preoccupations;
create trigger refus_lecture_seule_nb_preoccupations before insert or update or delete on public.nb_preoccupations
  for each row execute function public.refus_lecture_seule();

-- Recopie : seuls les projets de loi suivis du N.-B. se reconnaissent sans ambiguïté (pl:61xxxxx).
insert into public.nb_dossiers_suivis (user_id, ville, dossier_id, numero, objet, created_at)
  select user_id, ville, dossier_id, left(numero, 20), objet, created_at from public.dossiers_suivis
  where ville = 'assemblee' and dossier_id ~ '^pl:61[0-9]{5}$'
  on conflict (user_id, ville, dossier_id) do nothing;
