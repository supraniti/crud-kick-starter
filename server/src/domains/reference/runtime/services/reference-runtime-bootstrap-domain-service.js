import { createAsyncJobRunner } from "../../../../core/async-job-runner.js";

function recordJobPersistenceDiagnostic(jobPersistenceDiagnostics, phase, error) {
  jobPersistenceDiagnostics.push({
    code: error?.code ?? "REFERENCE_STATE_PERSISTENCE_FAILED",
    message:
      error?.message ?? `Reference-state persistence failed while handling '${phase}'`,
    phase
  });
}

export async function createReferenceJobsRuntime({ jobsRepository, pushJobLog }) {
  const restoredJobsState = await jobsRepository.readState();
  const jobLogStore = new Map(restoredJobsState.logs.map((entry) => [entry.jobId, entry.entries]));
  const jobPersistenceDiagnostics = [];
  let jobRunner;

  const buildJobLogSnapshot = () =>
    Array.from(jobLogStore.entries()).map(([jobId, entries]) => ({
      jobId,
      entries
    }));
  const persistJobRuntimeState = async () =>
    jobsRepository.transact(async (workingState) => {
      workingState.sequence =
        typeof jobRunner?.getSequence === "function"
          ? jobRunner.getSequence()
          : workingState.sequence;
      workingState.jobs =
        typeof jobRunner?.list === "function" ? jobRunner.list() : workingState.jobs;
      workingState.logs = buildJobLogSnapshot();

      return {
        commit: true,
        value: null
      };
    });

  jobRunner = createAsyncJobRunner({
    initialJobs: restoredJobsState.jobs,
    initialSequence: restoredJobsState.sequence,
    onJobUpdate: async () => {
      try {
        await persistJobRuntimeState();
      } catch (error) {
        recordJobPersistenceDiagnostic(jobPersistenceDiagnostics, "job-update", error);
      }
    }
  });

  try {
    await persistJobRuntimeState();
  } catch (error) {
    recordJobPersistenceDiagnostic(jobPersistenceDiagnostics, "startup-seed", error);
  }

  const pushJobLogWithPersistence = async (logStore, jobId, level, message, context = {}) => {
    pushJobLog(logStore, jobId, level, message, context);
    try {
      await persistJobRuntimeState();
    } catch (error) {
      recordJobPersistenceDiagnostic(jobPersistenceDiagnostics, "job-log-write", error);
    }
  };

  return {
    jobRunner,
    jobLogStore,
    jobPersistenceDiagnostics,
    pushJobLogWithPersistence
  };
}

export function buildReferenceRuntimeDiagnostics({
  moduleDiscovery,
  runtimeStateLoad,
  referenceStateHydration,
  remotesDeployHydration,
  jobPersistenceDiagnostics
}) {
  return [
    ...moduleDiscovery.diagnostics,
    ...runtimeStateLoad.diagnostics,
    ...(referenceStateHydration.diagnostics ?? []),
    ...(remotesDeployHydration.diagnostics ?? []),
    ...jobPersistenceDiagnostics
  ];
}

export function applyReferenceRuntimeSnapshot(
  moduleRuntimeStateStore,
  moduleRegistry,
  runtimeStateLoad,
  runtimeDiagnostics
) {
  if (!runtimeStateLoad.snapshot) {
    return 0;
  }

  const reconcileResult = moduleRuntimeStateStore.applySnapshot(
    moduleRegistry,
    runtimeStateLoad.snapshot
  );
  runtimeDiagnostics.push(...reconcileResult.diagnostics);
  return reconcileResult.appliedCount;
}

export async function persistReferenceRuntimeSnapshot(
  moduleRuntimeStateStore,
  moduleRegistry,
  runtimeDiagnostics
) {
  const runtimeStatePersistResult = await moduleRuntimeStateStore.saveSnapshot(moduleRegistry);
  if (!runtimeStatePersistResult.ok && runtimeStatePersistResult.error) {
    runtimeDiagnostics.push(runtimeStatePersistResult.error);
  }

  return runtimeStatePersistResult;
}
