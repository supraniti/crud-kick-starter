function createDiagnostic(code, message, details = {}) {
  return {
    code,
    message,
    ...details
  };
}

export function createCollectionHandlerRegistry() {
  const handlers = new Map();
  const registrationDiagnostics = [];

  function register({ collectionId, moduleId, handler }) {
    if (typeof collectionId !== "string" || collectionId.length === 0) {
      const diagnostic = createDiagnostic(
        "COLLECTION_HANDLER_REGISTRATION_INVALID",
        "Collection handler registration requires a non-empty collectionId",
        {
          moduleId: moduleId ?? null
        }
      );
      registrationDiagnostics.push(diagnostic);
      return {
        ok: false,
        error: diagnostic
      };
    }

    if (!handler || typeof handler !== "object") {
      const diagnostic = createDiagnostic(
        "COLLECTION_HANDLER_REGISTRATION_INVALID",
        `Collection '${collectionId}' handler registration requires a handler object`,
        {
          collectionId,
          moduleId: moduleId ?? null
        }
      );
      registrationDiagnostics.push(diagnostic);
      return {
        ok: false,
        error: diagnostic
      };
    }

    if (handlers.has(collectionId)) {
      const existing = handlers.get(collectionId);
      const diagnostic = createDiagnostic(
        "COLLECTION_HANDLER_DUPLICATE",
        `Collection '${collectionId}' handler is already registered`,
        {
          collectionId,
          moduleId: moduleId ?? null,
          firstModuleId: existing.moduleId ?? null
        }
      );
      registrationDiagnostics.push(diagnostic);
      return {
        ok: false,
        error: diagnostic
      };
    }

    handlers.set(collectionId, {
      collectionId,
      moduleId: moduleId ?? null,
      handler
    });

    return {
      ok: true
    };
  }

  function get(collectionId) {
    return handlers.get(collectionId)?.handler ?? null;
  }

  function list() {
    return [...handlers.values()].map((entry) => ({
      collectionId: entry.collectionId,
      moduleId: entry.moduleId
    }));
  }

  function resolveStatus(collectionResolution) {
    const collectionDefinitions = collectionResolution?.definitions ?? {};
    const collectionModuleMap = collectionResolution?.collectionModuleMap ?? {};
    const missingDiagnostics = [], mismatchDiagnostics = [];

    for (const collectionId of Object.keys(collectionDefinitions)) {
      if (!handlers.has(collectionId)) {
        missingDiagnostics.push(
          createDiagnostic(
            "COLLECTION_HANDLER_NOT_REGISTERED",
            `Collection '${collectionId}' does not have a registered handler`,
            {
              collectionId,
              moduleId: collectionModuleMap[collectionId] ?? null
            }
          )
        );
        continue;
      }

      const expectedModuleId = collectionModuleMap[collectionId] ?? null;
      const actualModuleId = handlers.get(collectionId)?.moduleId ?? null;
      if (expectedModuleId && actualModuleId && expectedModuleId !== actualModuleId) {
        mismatchDiagnostics.push(
          createDiagnostic(
            "COLLECTION_HANDLER_MODULE_MISMATCH",
            `Collection '${collectionId}' handler module '${actualModuleId}' does not match owner '${expectedModuleId}'`,
            {
              collectionId,
              moduleId: expectedModuleId,
              registeredModuleId: actualModuleId
            }
          )
        );
      }
    }

    const registered = list();
    const collectionHandlerModuleMap = {};
    for (const entry of registered) {
      collectionHandlerModuleMap[entry.collectionId] = entry.moduleId;
    }

    return {
      registeredCollectionIds: registered.map((entry) => entry.collectionId).sort(),
      collectionHandlerModuleMap,
      diagnostics: [...registrationDiagnostics, ...missingDiagnostics, ...mismatchDiagnostics]
    };
  }

  return {
    register,
    get,
    list,
    resolveStatus
  };
}
