import type { SupabaseClient } from "@supabase/supabase-js";

type JobHandler = (db: SupabaseClient, payload: Record<string, unknown>) => Promise<void>;

const registry = new Map<string, JobHandler>();

export function registerJobHandler(jobType: string, handler: JobHandler) {
  registry.set(jobType, handler);
}

export async function enqueueJob(
  db: SupabaseClient,
  jobType: string,
  payload: Record<string, unknown> = {},
  opts?: { runAt?: Date; maxAttempts?: number }
) {
  const { error } = await db.from("background_jobs").insert({
    job_type: jobType,
    payload,
    run_at: (opts?.runAt ?? new Date()).toISOString(),
    max_attempts: opts?.maxAttempts ?? 3,
  });

  if (error) {
    console.error(`[bg-jobs] Failed to enqueue ${jobType}:`, error.message);
  }
}

export async function processPendingJobs(db: SupabaseClient, batchSize = 10) {
  const { data: jobs, error } = await db
    .from("background_jobs")
    .select("id, job_type, payload, attempts, max_attempts")
    .eq("status", "pending")
    .lte("run_at", new Date().toISOString())
    .order("created_at", { ascending: true })
    .limit(batchSize);

  if (error) {
    console.error("[bg-jobs] Query error:", error.message);
    return { processed: 0, failed: 0 };
  }

  if (!jobs?.length) return { processed: 0, failed: 0 };

  let processed = 0;
  let failed = 0;

  for (const job of jobs) {
    const handler = registry.get(job.job_type);
    if (!handler) {
      await db
        .from("background_jobs")
        .update({ status: "failed", error: `No handler registered for ${job.job_type}`, completed_at: new Date().toISOString() })
        .eq("id", job.id);
      failed++;
      continue;
    }

    await db
      .from("background_jobs")
      .update({ status: "running", started_at: new Date().toISOString(), attempts: job.attempts + 1 })
      .eq("id", job.id);

    try {
      await handler(db, job.payload as Record<string, unknown>);
      await db
        .from("background_jobs")
        .update({ status: "completed", completed_at: new Date().toISOString() })
        .eq("id", job.id);
      processed++;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const willRetry = job.attempts + 1 < job.max_attempts;

      await db
        .from("background_jobs")
        .update({
          status: willRetry ? "pending" : "failed",
          error: message,
          completed_at: willRetry ? null : new Date().toISOString(),
        })
        .eq("id", job.id);

      if (!willRetry) failed++;
      else console.error(`[bg-jobs] ${job.job_type}/${job.id} failed (attempt ${job.attempts + 1}/${job.max_attempts}), will retry:`, message);
    }
  }

  return { processed, failed };
}

export function getJobStats(db: SupabaseClient) {
  return db
    .from("background_jobs")
    .select("status, count()", { count: "exact", head: true })
    .then(({ count }) => count ?? 0);
}
