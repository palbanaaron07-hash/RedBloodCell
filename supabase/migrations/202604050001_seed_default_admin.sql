-- ============================================================
-- Seed a default admin account for BloodConnect
-- ============================================================

begin;

insert into blood_bank.admin (
  first_name,
  last_name,
  email,
  password_hash
)
values (
  'System',
  'Admin',
  'admin@bloodconnect.com',
  '$2y$10$LS5W4z7Ayxk9N093PjVkJOsSiqtZOxwTH9p8UPLynzc1ZGGW5ZizW'
)
on conflict (email)
do update
set
  first_name = excluded.first_name,
  last_name = excluded.last_name,
  password_hash = excluded.password_hash;

commit;
