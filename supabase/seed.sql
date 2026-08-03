insert into public.leave_types (id, name, default_days, allow_carryover, is_active)
values
  ('01010101-0101-4101-8101-010101010101', 'Annual Leave', 15, false, true),
  ('02020202-0202-4202-8202-020202020202', 'Sick Leave', 15, false, true),
  ('03030303-0303-4303-8303-030303030303', 'Emergency Leave', 3, false, true),
  ('04040404-0404-4404-8404-040404040404', 'Unpaid Leave', 0, false, true)
on conflict (name) do nothing;

insert into public.profiles (id, email, full_name, role, manager_id, department)
values
  ('10000000-0000-4000-8000-000000000001', 'maya.delacruz@stratpoint.com', 'Maya Dela Cruz', 'manager', null, 'Engineering'),
  ('20000000-0000-4000-8000-000000000001', 'andres.lopez@stratpoint.com', 'Andres Lopez', 'employee', '10000000-0000-4000-8000-000000000001', 'Engineering'),
  ('30000000-0000-4000-8000-000000000001', 'bianca.ramos@stratpoint.com', 'Bianca Ramos', 'employee', '10000000-0000-4000-8000-000000000001', 'Finance'),
  ('40000000-0000-4000-8000-000000000001', 'gina.herrera@stratpoint.com', 'Gina Herrera', 'hr_admin', null, 'HR'),
  ('50000000-0000-4000-8000-000000000001', 'sam.yap@stratpoint.com', 'Sam Yap', 'sys_admin', null, 'IT')
on conflict (email) do nothing;

insert into public.leave_balances (id, employee_id, leave_type, year, total_days, used_days)
values
  ('20000000-0000-4000-8000-000000000101', '20000000-0000-4000-8000-000000000001', 'Annual Leave', (extract(year from current_date))::int, 15, 0),
  ('20000000-0000-4000-8000-000000000102', '20000000-0000-4000-8000-000000000001', 'Sick Leave', (extract(year from current_date))::int, 15, 0),
  ('20000000-0000-4000-8000-000000000103', '20000000-0000-4000-8000-000000000001', 'Emergency Leave', (extract(year from current_date))::int, 3, 0),
  ('30000000-0000-4000-8000-000000000101', '30000000-0000-4000-8000-000000000001', 'Annual Leave', (extract(year from current_date))::int, 15, 0),
  ('30000000-0000-4000-8000-000000000102', '30000000-0000-4000-8000-000000000001', 'Sick Leave', (extract(year from current_date))::int, 15, 0),
  ('30000000-0000-4000-8000-000000000103', '30000000-0000-4000-8000-000000000001', 'Emergency Leave', (extract(year from current_date))::int, 3, 0)
on conflict (employee_id, leave_type, year) do nothing;
