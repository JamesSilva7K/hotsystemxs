-- Hot System · estado no Supabase
-- Rode este SQL no SQL Editor do Supabase (Database > SQL Editor) uma única vez.

create table if not exists public.hot_state (
  id integer primary key,
  doc jsonb not null,
  updated_at timestamptz not null default now()
);

-- RLS ligado e nenhuma policy: só a service_role (usada pelo servidor) acessa.
alter table public.hot_state enable row level security;

-- Garante que a linha única exista (o app também cria no primeiro save).
insert into public.hot_state (id, doc)
values (1, '{}'::jsonb)
on conflict (id) do nothing;

comment on table public.hot_state is 'Documento de estado do Hot System (painel de leads/vendas).';
