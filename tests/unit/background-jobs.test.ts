import { describe, it, expect, vi } from "vitest";
import { enqueueJob, processPendingJobs, registerJobHandler } from "@/lib/server/backgroundJobs";

import type { SupabaseClient } from "@supabase/supabase-js";

describe("enqueueJob", () => {
  it("inserts a background_job row", async () => {
    const insert = vi.fn().mockResolvedValue({ error: null });
    const db = { from: vi.fn(() => ({ insert })) } as unknown as unknown as SupabaseClient;

    await enqueueJob(db as unknown as SupabaseClient, "send-push", { userId: "abc" });

    expect(db.from).toHaveBeenCalledWith("background_jobs");
    expect(insert).toHaveBeenCalledWith({
      job_type: "send-push",
      payload: { userId: "abc" },
      run_at: expect.any(String),
      max_attempts: 3,
    });
  });

  it("handles insert error gracefully", async () => {
    const insert = vi.fn().mockResolvedValue({ error: { message: "DB error" } });
    const db = { from: vi.fn(() => ({ insert })) } as unknown as unknown as SupabaseClient;
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    await enqueueJob(db as unknown as SupabaseClient, "test-job", {});

    expect(consoleSpy).toHaveBeenCalledWith("[bg-jobs] Failed to enqueue test-job:", "DB error");
    consoleSpy.mockRestore();
  });
});

describe("processPendingJobs", () => {
  it("returns zero when no pending jobs", async () => {
    const db = {
      from: vi.fn(() => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        lte: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue({ data: [], error: null }),
      })),
    } as unknown as unknown as SupabaseClient;

    const result = await processPendingJobs(db as unknown as SupabaseClient, 10);
    expect(result).toEqual({ processed: 0, failed: 0 });
  });

  it("processes a job and marks it completed", async () => {
    registerJobHandler("test-handler", async () => {});

    const update = vi.fn().mockReturnThis();
    const eq = vi.fn().mockResolvedValue({ error: null });

    const db = {
      from: vi.fn(() => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        lte: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue({
          data: [
            {
              id: "job-1",
              job_type: "test-handler",
              payload: { foo: "bar" },
              attempts: 0,
              max_attempts: 3,
            },
          ],
          error: null,
        }),
        update,
      })),
    } as unknown as unknown as SupabaseClient;

    // make eq chain return update mock properly
    (eq as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({ error: null });

    const result = await processPendingJobs(db as unknown as SupabaseClient, 10);
    expect(result).toEqual({ processed: 1, failed: 0 });
  });

  it("marks a job as failed when handler throws", async () => {
    registerJobHandler("failing-handler", async () => {
      throw new Error("Handler crashed");
    });

    const update = vi.fn().mockReturnThis();
    const eq = vi.fn().mockResolvedValue({ error: null });

    const db = {
      from: vi.fn(() => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        lte: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue({
          data: [
            {
              id: "job-fail",
              job_type: "failing-handler",
              payload: {},
              attempts: 0,
              max_attempts: 1,
            },
          ],
          error: null,
        }),
        update,
      })),
    } as unknown as unknown as SupabaseClient;

    (eq as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({ error: null });

    const result = await processPendingJobs(db as unknown as SupabaseClient, 10);
    expect(result).toEqual({ processed: 0, failed: 1 });
  });

  it("retries a job when attempts < max_attempts", async () => {
    registerJobHandler("retry-handler", async () => {
      throw new Error("Transient error");
    });

    const update = vi.fn().mockReturnThis();
    const eq = vi.fn().mockResolvedValue({ error: null });

    const db = {
      from: vi.fn(() => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        lte: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue({
          data: [
            {
              id: "job-retry",
              job_type: "retry-handler",
              payload: {},
              attempts: 0,
              max_attempts: 3,
            },
          ],
          error: null,
        }),
        update,
      })),
    } as unknown as unknown as SupabaseClient;

    (eq as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({ error: null });

    const result = await processPendingJobs(db as unknown as SupabaseClient, 10);
    // Should NOT count as failed because it will retry
    expect(result).toEqual({ processed: 0, failed: 0 });
  });

  it("marks unregistered job type as failed", async () => {
    const update = vi.fn().mockReturnThis();
    const eq = vi.fn().mockResolvedValue({ error: null });

    const db = {
      from: vi.fn(() => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        lte: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue({
          data: [
            {
              id: "job-unknown",
              job_type: "no-such-handler",
              payload: {},
              attempts: 0,
              max_attempts: 3,
            },
          ],
          error: null,
        }),
        update,
      })),
    } as unknown as unknown as SupabaseClient;

    (eq as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({ error: null });

    const result = await processPendingJobs(db as unknown as SupabaseClient, 10);
    expect(result).toEqual({ processed: 0, failed: 1 });
  });
});
