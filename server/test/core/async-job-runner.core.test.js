import { describe, expect, test } from "vitest";
import { createAsyncJobRunner } from "../../src/core/index.js";

describe("async job runner contract", () => {
  test("completes successful jobs with terminal state", async () => {
    const runner = createAsyncJobRunner();
    const submitted = runner.submit({
      type: "demo",
      payload: { value: 2 },
      handler: async (payload) => payload.value * 2
    });

    const job = await runner.awaitJob(submitted.job.id);
    expect(job.status).toBe("completed");
    expect(job.result).toBe(4);
    expect(job.finishedAt).not.toBeNull();
  });

  test("marks failed jobs with structured error", async () => {
    const runner = createAsyncJobRunner();
    const submitted = runner.submit({
      type: "demo-fail",
      payload: {},
      handler: async () => {
        const error = new Error("boom");
        error.code = "DEMO_FAIL";
        throw error;
      }
    });

    const job = await runner.awaitJob(submitted.job.id);
    expect(job.status).toBe("failed");
    expect(job.error.code).toBe("DEMO_FAIL");
  });

  test("supports cancellation from queued state", () => {
    const runner = createAsyncJobRunner();
    const submitted = runner.submit({
      type: "queued-job",
      payload: {},
      handler: async () => {
        return "ok";
      }
    });

    const cancelled = runner.cancel(submitted.job.id);
    expect(cancelled.ok).toBe(true);
    expect(cancelled.status).toBe("cancelled");
  });

  test("throws timeout error when awaiting too long", async () => {
    const runner = createAsyncJobRunner();
    const submitted = runner.submit({
      type: "slow-job",
      payload: {},
      handler: async () => {
        await new Promise((resolve) => setTimeout(resolve, 100));
        return "slow";
      }
    });

    await expect(
      runner.awaitJob(submitted.job.id, {
        timeoutMs: 10,
        pollMs: 5
      })
    ).rejects.toMatchObject({
      code: "ASYNC_JOB_TIMEOUT"
    });
  });

  test("hydrates persisted jobs and continues sequence", async () => {
    const runner = createAsyncJobRunner({
      initialJobs: [
        {
          id: "job-000011",
          type: "persisted",
          status: "completed",
          createdAt: "2026-02-13T12:00:00.000Z",
          startedAt: "2026-02-13T12:00:00.100Z",
          finishedAt: "2026-02-13T12:00:00.200Z",
          payload: {
            source: "seed"
          },
          result: {
            ok: true
          },
          error: null
        }
      ],
      initialSequence: 7
    });

    const restored = runner.get("job-000011");
    expect(restored).toEqual(
      expect.objectContaining({
        id: "job-000011",
        status: "completed"
      })
    );

    const submitted = runner.submit({
      type: "next",
      payload: {},
      handler: async () => "ok"
    });
    expect(submitted.job.id).toBe("job-000012");
  });

  test("reconciles interrupted persisted jobs to failed on startup", () => {
    const runner = createAsyncJobRunner({
      initialJobs: [
        {
          id: "job-000002",
          type: "seed-running",
          status: "running",
          createdAt: "2026-02-13T12:00:00.000Z",
          startedAt: "2026-02-13T12:00:00.100Z",
          finishedAt: null,
          payload: {},
          result: null,
          error: null
        }
      ]
    });

    const recovered = runner.get("job-000002");
    expect(recovered.status).toBe("failed");
    expect(recovered.finishedAt).not.toBeNull();
    expect(recovered.error).toEqual(
      expect.objectContaining({
        code: "ASYNC_JOB_RECOVERED_ON_STARTUP"
      })
    );
  });
});
