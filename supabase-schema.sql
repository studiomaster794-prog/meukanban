create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text,
  language text default 'pt-BR',
  theme text default 'dark',
  created_at timestamptz default now()
);

create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  color text default '#8b5cf6',
  created_at timestamptz default now(),
  unique (user_id, name)
);

create table if not exists public.tasks (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  description text default '',
  category text default 'Trabalho',
  priority text default 'Media',
  date date not null,
  time time,
  color text default '#7c3aed',
  tags text[] default '{}',
  location text default '',
  notes text default '',
  attachments jsonb default '[]'::jsonb,
  checklist jsonb default '[]'::jsonb,
  estimated integer default 0,
  spent integer default 0,
  status text default 'A Fazer',
  favorite boolean default false,
  archived boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.task_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  task_id uuid references public.tasks(id) on delete cascade,
  action text not null,
  payload jsonb default '{}'::jsonb,
  created_at timestamptz default now()
);

alter table public.profiles enable row level security;
alter table public.categories enable row level security;
alter table public.tasks enable row level security;
alter table public.task_history enable row level security;

create policy "profiles owner select" on public.profiles for select using (auth.uid() = id);
create policy "profiles owner upsert" on public.profiles for insert with check (auth.uid() = id);
create policy "profiles owner update" on public.profiles for update using (auth.uid() = id);

create policy "categories owner all" on public.categories for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "tasks owner all" on public.tasks for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "history owner all" on public.task_history for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create index if not exists tasks_user_date_idx on public.tasks(user_id, date);
create index if not exists tasks_user_status_idx on public.tasks(user_id, status);
create index if not exists tasks_user_priority_idx on public.tasks(user_id, priority);
