import { normalizeWorkingState } from "./state-and-item-helpers.mjs";

function errorPayload(code, message) {
  return {
    ok: false,
    error: {
      code,
      message
    },
    timestamp: new Date().toISOString()
  };
}

function createGeneratedRuntimeStateAccess({
  definitions,
  fallbackState,
  readModuleSettingsValues
}) {
  const resolveModuleSettingsValues = async () =>
    typeof readModuleSettingsValues === "function"
      ? await readModuleSettingsValues()
      : null;

  const readWorkingState = async (repository) =>
    normalizeWorkingState(
      repository ? await repository.readState() : fallbackState,
      definitions,
      fallbackState,
      {
        moduleSettingsValues: await resolveModuleSettingsValues()
      }
    );
  const mutateWorkingState = async (repository, mutator) => {
    if (repository) {
      return repository.transact(async (workingState) => {
        const moduleSettingsValues = await resolveModuleSettingsValues();
        const normalized = normalizeWorkingState(
          workingState,
          definitions,
          fallbackState,
          {
            moduleSettingsValues
          }
        );
        for (const [key, value] of Object.entries(normalized)) {
          workingState[key] = value;
        }
        return mutator(workingState, {
          moduleSettingsValues
        });
      });
    }

    const outcome = await mutator(fallbackState, {
      moduleSettingsValues: await resolveModuleSettingsValues()
    });
    return Object.prototype.hasOwnProperty.call(outcome ?? {}, "value")
      ? outcome.value
      : outcome;
  };

  return {
    readWorkingState,
    mutateWorkingState
  };
}

export {
  createGeneratedRuntimeStateAccess,
  errorPayload
};
