-- Controle Financeiro: documentos (coleção + id + JSON). Só quem está em cf_dono lê e grava.
-- Pode ser rodado de novo sem apagar dados.
create table if not exists public.cf_dono (user_id uuid primary key references auth.users(id) on delete cascade);
alter table public.cf_dono enable row level security;
revoke all on public.cf_dono from anon, authenticated;

create table if not exists public.cf_docs (
  col text not null check (col ~ '^[a-z]{2,20}$'),
  id text not null check (id ~ '^[A-Za-z0-9_.~:@+-]{1,200}$'),
  data jsonb not null check (jsonb_typeof(data)='object' and pg_column_size(data) < 200000),
  atualizado_em timestamptz not null default now(),
  primary key (col, id)
);
alter table public.cf_docs enable row level security;
revoke all on public.cf_docs from anon;
grant select, insert, update, delete on public.cf_docs to authenticated;

create or replace function public.cf_e_dono() returns boolean
language sql stable security definer set search_path = public
as $$ select exists(select 1 from public.cf_dono where user_id = auth.uid()) $$;
revoke all on function public.cf_e_dono() from public, anon;
grant execute on function public.cf_e_dono() to authenticated;

drop policy if exists cf_docs_dono on public.cf_docs;
create policy cf_docs_dono on public.cf_docs for all to authenticated
  using ((select public.cf_e_dono())) with check ((select public.cf_e_dono()));

insert into public.cf_dono(user_id) select id from auth.users where email = 'higor_2008@hotmail.com' on conflict do nothing;

do $$ begin
  if exists (select 1 from pg_publication where pubname='supabase_realtime')
     and not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and tablename='cf_docs') then
    alter publication supabase_realtime add table public.cf_docs;
  end if;
end $$;
