create table public.profiles (
  id uuid primary key,
  email text unique not null,
  full_name text,
  role text check (role in ('employee', 'manager', 'hr_admin', 'sys_admin')),
  manager_id uuid references public.profiles (id),
  department text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  deleted_at timestamptz
);

create table public.leave_types (
  id uuid primary key default gen_random_uuid(),
  name text unique not null,
  default_days numeric not null default 0,
  allow_carryover boolean not null default false,
  is_active boolean not null default true,
  deleted_at timestamptz
);

create table public.leaves (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.profiles (id),
  -- ARCH ER (Section 5) marks leave_type as FK -> leave_types(name). Deliberately plain TEXT per TASK-008 AC; FK deferred pending upstream sign-off (documented discrepancy).
  leave_type text not null,
  start_date date not null,
  end_date date not null,
  reason text not null,
  supporting_doc_url text,
  status text check (status in ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED')) default 'PENDING',
  manager_note text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  deleted_at timestamptz
);

create table public.leave_balances (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.profiles (id),
  -- ARCH ER (Section 5) marks leave_type as FK -> leave_types(name). Deliberately plain TEXT per TASK-008 AC; FK deferred pending upstream sign-off (documented discrepancy).
  leave_type text not null,
  year int not null,
  total_days numeric not null default 0,
  used_days numeric not null default 0,
  deleted_at timestamptz,
  unique (employee_id, leave_type, year)
);

create table public.audit_log (
  id uuid primary key default gen_random_uuid(),
  table_name text not null,
  -- Polymorphic ref to rows across multiple tables; must NOT be a real FK (ARCH ER labels it FK, which is incorrect for a polymorphic column).
  record_id uuid not null,
  action text not null,
  actor_id uuid references public.profiles (id),
  old_data jsonb,
  new_data jsonb,
  created_at timestamptz default now()
);

create index on public.profiles (manager_id);
create index on public.profiles (email);
create index on public.leaves (employee_id);
create index on public.leaves (status);
create index on public.leaves (employee_id, status);
create index on public.leaves (employee_id, start_date);
create index on public.leave_balances (employee_id, year);
create index on public.audit_log (created_at);
create index on public.audit_log (actor_id);
create index on public.audit_log (action);
