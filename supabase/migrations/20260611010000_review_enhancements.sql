-- Review enhancements: review_votes table
-- Run: supabase migration up

create table if not exists public.review_votes (
  id uuid primary key default gen_random_uuid(),
  review_id uuid not null references public.reviews(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  vote text not null check (vote in ('helpful', 'not_helpful')),
  created_at timestamptz not null default now(),
  unique (review_id, user_id)
);

create index if not exists idx_review_votes_review on review_votes(review_id);
create index if not exists idx_review_votes_user on review_votes(user_id);

alter table review_votes enable row level security;

create policy "Anyone can read review votes"
  on review_votes for select
  using (true);

create policy "Authenticated users can vote"
  on review_votes for insert
  with check (auth.uid() = user_id);

create policy "Users can update own votes"
  on review_votes for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete own votes"
  on review_votes for delete
  using (auth.uid() = user_id);

-- Add helpful_count and has_photos to reviews metadata defaults
-- (metadata column already exists)

-- Create a storage bucket for review photos
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('review-photos', 'review-photos', true, 5242880, '{image/jpeg,image/png,image/webp}')
on conflict (id) do nothing;

-- RLS policies for review-photos bucket
create policy "Review photos are publicly readable"
  on storage.objects for select
  using (bucket_id = 'review-photos');

create policy "Authenticated users can upload review photos"
  on storage.objects for insert
  with check (
    bucket_id = 'review-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "Users can delete own review photos"
  on storage.objects for delete
  using (
    bucket_id = 'review-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
