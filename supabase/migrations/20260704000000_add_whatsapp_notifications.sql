begin;

alter table if exists public.user_settings
  add column if not exists whatsapp_notifications boolean not null default false;

commit;
