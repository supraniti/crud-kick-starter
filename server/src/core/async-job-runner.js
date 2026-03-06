const TERMINAL_STATES = new Set(["completed", "failed", "cancelled"]);
const VALID_JOB_STATUSES = new Set([
  "queued",
  "running",
  "completed",
  "failed",
  "cancelled"
]);
const DEFAULT_CREATED_AT = "1970-01-01T00:00:00.000Z";

function cloneValue(value) {
  if (value === null || value === undefined) {
    return value;
  }

  if (typeof value !== "object") {
    return value;
  }

  try {
    return structuredClone(value);
  } catch {
    try {
      return JSON.parse(JSON.stringify(value));
    } catch {
      return null;
    }
  }
}

function normalizeTimestamp(value, fallback = null) {
  return typeof value === "string" ? value : fallback;
}

function normalizeError(error) {
  if (!error || typeof error !== "object") {
    return null;
  }

  return {
    code:
      typeof error.code === "string" && error.code.length > 0
        ? error.code
        : "ASYNC_JOB_HANDLER_ERROR",
    message:
      typeof error.message === "string" && error.message.length > 0
        ? error.message
        : "Async job handler failed"
  };
}

function normalizeSeedJob(rawJob) {
  if (!rawJob || typeof rawJob !== "object") {
    return null;
  }

  const id = typeof rawJob.id === "string" ? rawJob.id : "";
  const type = typeof rawJob.type === "string" ? rawJob.type : "";
  if (id.length === 0 || type.length === 0) {
    return null;
  }

  const status = VALID_JOB_STATUSES.has(rawJob.status) ? rawJob.status : "failed";

  return {
    id,
    type,
    status,
    createdAt: normalizeTimestamp(rawJob.createdAt, DEFAULT_CREATED_AT),
    startedAt: normalizeTimestamp(rawJob.startedAt, null),
    finishedAt: normalizeTimestamp(rawJob.finishedAt, null),
    payload:
      rawJob.payload && typeof rawJob.payload === "object" && !Array.isArray(rawJob.payload)
        ? cloneValue(rawJob.payload)
        : {},
    result: rawJob.result === undefined ? null : cloneValue(rawJob.result),
    error: normalizeError(rawJob.error)
  };
}

function parseSequenceFromJobId(jobId) {
  if (typeof jobId !== "string") {
    return 0;
  }

  const match = /^job-(\d+)$/.exec(jobId);
  if (!match) {
    return 0;
  }

  const parsed = Number.parseInt(match[1], 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
}

function cloneJob(job) {
  return {
    ...job,
    payload: cloneValue(job.payload),
    result: cloneValue(job.result),
    error: cloneValue(job.error)
  };
}

function createError(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}

function seedJobs(jobs, initialJobs, initialSequence, now) {
  let sequence =
    Number.isInteger(initialSequence) && initialSequence >= 0 ? initialSequence : 0;
  for (const candidate of initialJobs) {
    const normalizedJob = normalizeSeedJob(candidate);
    if (!normalizedJob) {
      continue;
    }

    if (normalizedJob.status === "queued" || normalizedJob.status === "running") {
      normalizedJob.status = "failed";
      normalizedJob.finishedAt = normalizedJob.finishedAt ?? now();
      normalizedJob.error = normalizedJob.error ?? {
        code: "ASYNC_JOB_RECOVERED_ON_STARTUP",
        message: "Job could not resume after runtime restart"
      };
    }

    jobs.set(normalizedJob.id, normalizedJob);
    sequence = Math.max(sequence, parseSequenceFromJobId(normalizedJob.id));
  }
  return sequence;
}

function createJobUpdateNotifier(onJobUpdate) {
  return async function notifyJobUpdate(event, job) {
    if (typeof onJobUpdate !== "function") {
      return;
    }
    try {
      await onJobUpdate({
        event,
        job: cloneJob(job)
      });
    } catch {
      // Observers should not break runtime job execution.
    }
  };
}

function createNextJobIdResolver(sequenceRef) {
  return () => {
    sequenceRef.value += 1;
    return `job-${sequenceRef.value.toString().padStart(6, "0")}`;
  };
}

function createJobExecutor({ jobs, now, notifyJobUpdate }) {
  return async function execute(jobId, handler) {
    const job = jobs.get(jobId);
    if (!job || job.status !== "queued") {
      return;
    }

    job.status = "running";
    job.startedAt = now();
    await notifyJobUpdate("running", job);

    try {
      const result = await handler(job.payload, {
        jobId
      });

      if (job.status === "cancelled") {
        return;
      }

      job.status = "completed";
      job.result = result;
      job.finishedAt = now();
      await notifyJobUpdate("completed", job);
    } catch (error) {
      job.status = "failed";
      job.error = {
        code: error?.code ?? "ASYNC_JOB_HANDLER_ERROR",
        message: error?.message ?? "Async job handler failed"
      };
      job.finishedAt = now();
      await notifyJobUpdate("failed", job);
    }
  };
}

function validateSubmitInput(input) {
  if (!input || typeof input !== "object") {
    throw createError("ASYNC_JOB_INVALID_SUBMIT_INPUT", "Job input must be an object");
  }
  if (typeof input.type !== "string" || input.type.length === 0) {
    throw createError("ASYNC_JOB_INVALID_SUBMIT_INPUT", "Job type is required");
  }
  if (typeof input.handler !== "function") {
    throw createError("ASYNC_JOB_INVALID_SUBMIT_INPUT", "Job handler function is required");
  }
}

function createSubmitHandler({ jobs, now, notifyJobUpdate, nextId, execute }) {
  return (input) => {
    validateSubmitInput(input);

    const job = {
      id: nextId(),
      type: input.type,
      status: "queued",
      createdAt: now(),
      startedAt: null,
      finishedAt: null,
      payload:
        input.payload && typeof input.payload === "object" ? { ...input.payload } : {},
      result: null,
      error: null
    };

    jobs.set(job.id, job);
    void notifyJobUpdate("queued", job);
    setTimeout(() => {
      void execute(job.id, input.handler);
    }, 0);

    return {
      ok: true,
      job: cloneJob(job)
    };
  };
}

function createCancelHandler({ jobs, now, notifyJobUpdate }) {
  return (jobId) => {
    const job = jobs.get(jobId);
    if (!job) {
      return {
        ok: false,
        status: "unknown-job"
      };
    }
    if (TERMINAL_STATES.has(job.status)) {
      return {
        ok: false,
        status: job.status
      };
    }
    if (job.status === "running") {
      return {
        ok: false,
        status: "running"
      };
    }

    job.status = "cancelled";
    job.finishedAt = now();
    void notifyJobUpdate("cancelled", job);
    return {
      ok: true,
      status: "cancelled"
    };
  };
}

function createAwaitJobHandler(jobs) {
  return async (jobId, options = {}) => {
    const timeoutMs = options.timeoutMs ?? 3000;
    const pollMs = options.pollMs ?? 20;
    const startedAtMs = Date.now();

    while (Date.now() - startedAtMs <= timeoutMs) {
      const job = jobs.get(jobId);
      if (!job) {
        throw createError("ASYNC_JOB_NOT_FOUND", `Unknown job id '${jobId}'`);
      }
      if (TERMINAL_STATES.has(job.status)) {
        return cloneJob(job);
      }
      await new Promise((resolve) => setTimeout(resolve, pollMs));
    }
    throw createError("ASYNC_JOB_TIMEOUT", `Timed out waiting for job '${jobId}'`);
  };
}

export function createAsyncJobRunner(options = {}) {
  const jobs = new Map();
  const now = options.now ?? (() => new Date().toISOString());
  const initialJobs = Array.isArray(options.initialJobs) ? options.initialJobs : [];
  const sequenceRef = {
    value: seedJobs(jobs, initialJobs, options.initialSequence, now)
  };
  const notifyJobUpdate = createJobUpdateNotifier(options.onJobUpdate);
  const nextId = createNextJobIdResolver(sequenceRef);
  const execute = createJobExecutor({
    jobs,
    now,
    notifyJobUpdate
  });
  const submit = createSubmitHandler({
    jobs,
    now,
    notifyJobUpdate,
    nextId,
    execute
  });
  const cancel = createCancelHandler({
    jobs,
    now,
    notifyJobUpdate
  });
  const awaitJob = createAwaitJobHandler(jobs);

  return {
    submit,
    get(jobId) {
      const job = jobs.get(jobId);
      return job ? cloneJob(job) : null;
    },
    list() {
      return Array.from(jobs.values()).map((job) => cloneJob(job));
    },
    getSequence() {
      return sequenceRef.value;
    },
    cancel,
    awaitJob
  };
}
