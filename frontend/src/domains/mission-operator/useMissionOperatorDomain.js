import { useCallback, useEffect, useMemo, useState } from "react";
import {
  MISSIONS_MODULE_ID,
  buildMissionPayload,
  buildPayloadValues,
  createDefaultJobDetailState,
  createDefaultJobsState,
  createDefaultMissionsState,
  createDefaultRunFormState,
  formatSubmissionError,
  haveSamePayloadValues,
  normalizeMissionPayloadFields,
  resolveSelectedMission
} from "./domain-helpers.js";

function useMissionsStateLoader({
  api,
  enabled,
  isAuthenticated,
  activeModuleId,
  setMissionsState
}) {
  useEffect(() => {
    if (!enabled || !isAuthenticated || activeModuleId !== MISSIONS_MODULE_ID) {
      return;
    }

    let cancelled = false;
    setMissionsState((previous) => ({
      ...previous,
      loading: true,
      errorMessage: null
    }));

    api
      .listMissions()
      .then((payload) => {
        if (cancelled) {
          return;
        }

        setMissionsState({
          loading: false,
          errorMessage: null,
          items: payload?.items ?? []
        });
      })
      .catch((error) => {
        if (cancelled) {
          return;
        }

        setMissionsState({
          loading: false,
          errorMessage: error?.message ?? "Failed to load missions",
          items: []
        });
      });

    return () => {
      cancelled = true;
    };
  }, [activeModuleId, api, enabled, isAuthenticated, setMissionsState]);
}

function useRunFormMissionSynchronization({ missionsItems, setRunFormState }) {
  useEffect(() => {
    setRunFormState((previous) => {
      const selectedMission = resolveSelectedMission(missionsItems, previous.missionId);
      if (!selectedMission) {
        if (previous.missionId === "" && Object.keys(previous.payloadValues).length === 0) {
          return previous;
        }

        return {
          ...previous,
          missionId: "",
          payloadValues: {}
        };
      }

      const fields = normalizeMissionPayloadFields(selectedMission);
      const shouldResetValues = selectedMission.missionId !== previous.missionId;
      const nextPayloadValues = buildPayloadValues(
        fields,
        shouldResetValues ? null : previous.payloadValues
      );

      if (
        previous.missionId === selectedMission.missionId &&
        haveSamePayloadValues(previous.payloadValues, nextPayloadValues)
      ) {
        return previous;
      }

      return {
        ...previous,
        missionId: selectedMission.missionId,
        payloadValues: nextPayloadValues
      };
    });
  }, [missionsItems, setRunFormState]);
}

function useMissionJobsStateLoader({
  api,
  enabled,
  isAuthenticated,
  activeModuleId,
  jobsReloadToken,
  setJobsState
}) {
  useEffect(() => {
    if (!enabled || !isAuthenticated || activeModuleId !== MISSIONS_MODULE_ID) {
      return;
    }

    let cancelled = false;
    setJobsState((previous) => ({
      ...previous,
      loading: true,
      errorMessage: null
    }));

    api
      .listMissionJobs()
      .then((payload) => {
        if (cancelled) {
          return;
        }

        setJobsState((previous) => ({
          ...previous,
          loading: false,
          errorMessage: null,
          items: payload?.items ?? []
        }));
      })
      .catch((error) => {
        if (cancelled) {
          return;
        }

        setJobsState((previous) => ({
          ...previous,
          loading: false,
          errorMessage: error?.message ?? "Failed to load mission jobs",
          items: []
        }));
      });

    return () => {
      cancelled = true;
    };
  }, [activeModuleId, api, enabled, isAuthenticated, jobsReloadToken, setJobsState]);
}

function useSelectedMissionJobSync({ jobsItems, selectedJobId, setSelectedJobId }) {
  useEffect(() => {
    if (jobsItems.length === 0) {
      setSelectedJobId("");
      return;
    }

    const exists = jobsItems.some((item) => item.id === selectedJobId);
    if (exists) {
      return;
    }

    setSelectedJobId(jobsItems[0].id);
  }, [jobsItems, selectedJobId, setSelectedJobId]);
}

function useMissionJobDetailLoader({
  api,
  enabled,
  isAuthenticated,
  activeModuleId,
  selectedJobId,
  jobsReloadToken,
  setJobDetailState
}) {
  useEffect(() => {
    if (!enabled || !isAuthenticated || activeModuleId !== MISSIONS_MODULE_ID || !selectedJobId) {
      setJobDetailState(createDefaultJobDetailState());
      return;
    }

    let cancelled = false;
    setJobDetailState((previous) => ({
      ...previous,
      loading: true,
      errorMessage: null
    }));

    api
      .readMissionJob({
        jobId: selectedJobId
      })
      .then((payload) => {
        if (cancelled) {
          return;
        }

        if (!payload?.ok) {
          setJobDetailState({
            loading: false,
            errorMessage: `[${payload?.error?.code ?? "MISSION_JOB_READ_FAILED"}] ${
              payload?.error?.message ?? "Failed to read mission job"
            }`,
            job: null
          });
          return;
        }

        setJobDetailState({
          loading: false,
          errorMessage: null,
          job: payload?.job ?? null
        });
      })
      .catch((error) => {
        if (cancelled) {
          return;
        }

        setJobDetailState({
          loading: false,
          errorMessage: error?.message ?? "Failed to read mission job",
          job: null
        });
      });

    return () => {
      cancelled = true;
    };
  }, [
    activeModuleId,
    api,
    enabled,
    isAuthenticated,
    jobsReloadToken,
    selectedJobId,
    setJobDetailState
  ]);
}

function useMissionJobsPolling({
  enabled,
  isAuthenticated,
  activeModuleId,
  jobsItems,
  setJobsReloadToken
}) {
  useEffect(() => {
    if (!enabled || !isAuthenticated || activeModuleId !== MISSIONS_MODULE_ID) {
      return;
    }

    const hasRunningJob = jobsItems.some(
      (item) => item.status === "queued" || item.status === "running"
    );
    if (!hasRunningJob) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setJobsReloadToken((value) => value + 1);
    }, 250);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [activeModuleId, enabled, isAuthenticated, jobsItems, setJobsReloadToken]);
}

function useMissionDomainReset({
  enabled,
  setMissionsState,
  setRunFormState,
  setJobsState,
  setJobDetailState,
  setSelectedJobId
}) {
  useEffect(() => {
    if (enabled) {
      return;
    }

    setMissionsState(createDefaultMissionsState());
    setRunFormState(createDefaultRunFormState());
    setJobsState(createDefaultJobsState());
    setJobDetailState(createDefaultJobDetailState());
    setSelectedJobId("");
  }, [
    enabled,
    setMissionsState,
    setRunFormState,
    setJobsState,
    setJobDetailState,
    setSelectedJobId
  ]);
}

function useSelectMissionHandler(missionsItems, setRunFormState) {
  return useCallback(
    (missionId) => {
      const mission = resolveSelectedMission(missionsItems, missionId);
      const fields = normalizeMissionPayloadFields(mission);

      setRunFormState((previous) => ({
        ...previous,
        missionId: mission?.missionId ?? "",
        payloadValues: buildPayloadValues(fields),
        errorMessage: null,
        successMessage: null
      }));
    },
    [missionsItems, setRunFormState]
  );
}

function usePayloadFieldChangeHandler(setRunFormState) {
  return useCallback((fieldId, value) => {
    setRunFormState((previous) => ({
      ...previous,
      payloadValues: {
        ...previous.payloadValues,
        [fieldId]: value
      },
      errorMessage: null,
      successMessage: null
    }));
  }, [setRunFormState]);
}

function useRunMissionHandler({
  api,
  missionsItems,
  runFormState,
  setRunFormState,
  setSelectedJobId,
  setJobsReloadToken
}) {
  return useCallback(async () => {
    const mission = resolveSelectedMission(missionsItems, runFormState.missionId);
    const selectedMissionId = mission?.missionId ?? "";
    if (!selectedMissionId) {
      setRunFormState((previous) => ({
        ...previous,
        errorMessage: "Select a mission first"
      }));
      return;
    }

    const payloadFields = normalizeMissionPayloadFields(mission);
    const missionPayload = buildMissionPayload(payloadFields, runFormState.payloadValues);

    setRunFormState((previous) => ({
      ...previous,
      submitting: true,
      errorMessage: null,
      successMessage: null
    }));

    try {
      const payload = await api.startMissionJob({
        missionId: selectedMissionId,
        payload: missionPayload
      });

      if (!payload?.ok) {
        setRunFormState((previous) => ({
          ...previous,
          missionId: selectedMissionId,
          submitting: false,
          errorMessage: formatSubmissionError(payload),
          successMessage: null
        }));
        return;
      }

      const submittedJobId = payload?.job?.id ?? "";
      setRunFormState((previous) => ({
        ...previous,
        missionId: selectedMissionId,
        submitting: false,
        errorMessage: null,
        successMessage:
          submittedJobId.length > 0
            ? `Mission submitted: ${submittedJobId}`
            : "Mission submitted"
      }));
      if (submittedJobId.length > 0) {
        setSelectedJobId(submittedJobId);
      }
      setJobsReloadToken((value) => value + 1);
    } catch (error) {
      setRunFormState((previous) => ({
        ...previous,
        missionId: selectedMissionId,
        submitting: false,
        errorMessage: error?.message ?? "Failed to submit mission job",
        successMessage: null
      }));
    }
  }, [
    api,
    missionsItems,
    runFormState.missionId,
    runFormState.payloadValues,
    setRunFormState,
    setSelectedJobId,
    setJobsReloadToken
  ]);
}

function useMissionJobHandlers({ api, setSelectedJobId, setJobsState, setJobsReloadToken }) {
  const handleSelectJob = useCallback((jobId) => {
    setSelectedJobId(jobId);
    setJobsState((previous) => ({
      ...previous,
      errorMessage: null,
      successMessage: null
    }));
  }, [setJobsState, setSelectedJobId]);

  const handleCancelJob = useCallback(
    async (jobId) => {
      if (!jobId) {
        return;
      }

      setJobsState((previous) => ({
        ...previous,
        cancellingJobId: jobId,
        errorMessage: null,
        successMessage: null
      }));

      try {
        const payload = await api.cancelMissionJob({
          jobId
        });

        if (!payload?.ok) {
          setJobsState((previous) => ({
            ...previous,
            cancellingJobId: null,
            errorMessage: `[${payload?.error?.code ?? "MISSION_CANCEL_FAILED"}] ${
              payload?.error?.message ?? "Mission job cancellation was rejected"
            }`
          }));
          return;
        }

        setJobsState((previous) => ({
          ...previous,
          cancellingJobId: null,
          errorMessage: null,
          successMessage: `Mission job '${jobId}' cancelled`
        }));
        setSelectedJobId(jobId);
        setJobsReloadToken((value) => value + 1);
      } catch (error) {
        setJobsState((previous) => ({
          ...previous,
          cancellingJobId: null,
          errorMessage: error?.message ?? "Failed to cancel mission job"
        }));
      }
    },
    [api, setJobsReloadToken, setJobsState, setSelectedJobId]
  );

  const handleRefresh = useCallback(() => {
    setJobsReloadToken((value) => value + 1);
  }, [setJobsReloadToken]);

  return {
    handleSelectJob,
    handleCancelJob,
    handleRefresh
  };
}

function useMissionOperatorDomain({ api, isAuthenticated, enabled = false, activeModuleId }) {
  const [missionsState, setMissionsState] = useState(() => createDefaultMissionsState());
  const [runFormState, setRunFormState] = useState(() => createDefaultRunFormState());
  const [jobsState, setJobsState] = useState(() => createDefaultJobsState());
  const [jobDetailState, setJobDetailState] = useState(() => createDefaultJobDetailState());
  const [selectedJobId, setSelectedJobId] = useState("");
  const [jobsReloadToken, setJobsReloadToken] = useState(0);

  useMissionsStateLoader({
    api,
    enabled,
    isAuthenticated,
    activeModuleId,
    setMissionsState
  });
  useRunFormMissionSynchronization({
    missionsItems: missionsState.items,
    setRunFormState
  });
  useMissionJobsStateLoader({
    api,
    enabled,
    isAuthenticated,
    activeModuleId,
    jobsReloadToken,
    setJobsState
  });
  useSelectedMissionJobSync({
    jobsItems: jobsState.items,
    selectedJobId,
    setSelectedJobId
  });
  useMissionJobDetailLoader({
    api,
    enabled,
    isAuthenticated,
    activeModuleId,
    selectedJobId,
    jobsReloadToken,
    setJobDetailState
  });
  useMissionJobsPolling({
    enabled,
    isAuthenticated,
    activeModuleId,
    jobsItems: jobsState.items,
    setJobsReloadToken
  });
  useMissionDomainReset({
    enabled,
    setMissionsState,
    setRunFormState,
    setJobsState,
    setJobDetailState,
    setSelectedJobId
  });

  const selectedMission = useMemo(
    () => resolveSelectedMission(missionsState.items, runFormState.missionId),
    [missionsState.items, runFormState.missionId]
  );
  const selectedMissionPayloadFields = useMemo(
    () => normalizeMissionPayloadFields(selectedMission),
    [selectedMission]
  );

  const handleSelectMission = useSelectMissionHandler(missionsState.items, setRunFormState);
  const handlePayloadFieldChange = usePayloadFieldChangeHandler(setRunFormState);
  const handleRunMission = useRunMissionHandler({
    api,
    missionsItems: missionsState.items,
    runFormState,
    setRunFormState,
    setSelectedJobId,
    setJobsReloadToken
  });
  const { handleSelectJob, handleCancelJob, handleRefresh } = useMissionJobHandlers({
    api,
    setSelectedJobId,
    setJobsState,
    setJobsReloadToken
  });

  return {
    missionsModuleId: MISSIONS_MODULE_ID,
    missionsState,
    runFormState,
    selectedMission,
    selectedMissionPayloadFields,
    jobsState,
    selectedJobId,
    jobDetailState,
    handleSelectMission,
    handlePayloadFieldChange,
    handleRunMission,
    handleSelectJob,
    handleCancelJob,
    handleRefresh
  };
}

export { useMissionOperatorDomain };
