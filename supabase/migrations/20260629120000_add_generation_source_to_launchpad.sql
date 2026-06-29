-- Track whether generated content came from AI or template fallback
alter table public.business_launchpad_drafts
add column if not exists generation_source text not null default 'template';

alter table public.business_launchpad_drafts
add constraint business_launchpad_drafts_generation_source_check
check (generation_source in ('ai', 'template'));
