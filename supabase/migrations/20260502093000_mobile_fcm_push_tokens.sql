-- Mobile push tokens for Flutter FCM alongside existing web-push subscriptions.

alter table public.provider_push_subscriptions
  add column if not exists fcm_token text,
  add column if not exists updated_at timestamptz not null default timezone('utc', now());

create unique index if not exists idx_provider_push_subscriptions_provider_fcm
  on public.provider_push_subscriptions (provider_id, fcm_token)
  where fcm_token is not null;

drop trigger if exists trg_provider_push_subscriptions_updated_at on public.provider_push_subscriptions;
create trigger trg_provider_push_subscriptions_updated_at
before update on public.provider_push_subscriptions
for each row execute function public.set_updated_at();
