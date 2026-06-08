-- Background job queue for async / fire-and-forget work
CREATE TABLE IF NOT EXISTS public.background_jobs (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_type      text NOT NULL,
  payload       jsonb NOT NULL DEFAULT '{}',
  status        text NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending','running','completed','failed')),
  created_at    timestamptz NOT NULL DEFAULT now(),
  started_at    timestamptz,
  completed_at  timestamptz,
  error         text,
  attempts      int NOT NULL DEFAULT 0,
  max_attempts  int NOT NULL DEFAULT 3,
  run_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_background_jobs_pending
  ON public.background_jobs (run_at, created_at)
  WHERE status = 'pending';

-- Allow admins to manage the queue
ALTER TABLE public.background_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage background_jobs"
  ON public.background_jobs
  USING (true)
  WITH CHECK (true);
