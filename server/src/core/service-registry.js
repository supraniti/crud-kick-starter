function createDiagnostic(code, message, details = {}) {
  return {
    code,
    message,
    ...details
  };
}

function normalizeDiagnosticEntries(entries) {
  if (!Array.isArray(entries)) {
    return [];
  }

  return entries.filter((entry) => entry && typeof entry === "object").map((entry) => ({ ...entry }));
}

function validateServiceRegistrationInput({ serviceId, moduleId, service }) {
  if (typeof serviceId !== "string" || serviceId.length === 0) {
    return {
      ok: false,
      diagnostic: createDiagnostic(
        "SERVICE_REGISTRATION_INVALID",
        "Service registration requires a non-empty serviceId",
        {
          moduleId: moduleId ?? null
        }
      )
    };
  }

  if (typeof moduleId !== "string" || moduleId.length === 0) {
    return {
      ok: false,
      diagnostic: createDiagnostic(
        "SERVICE_REGISTRATION_INVALID",
        `Service '${serviceId}' registration requires a non-empty moduleId`,
        {
          serviceId,
          moduleId: moduleId ?? null
        }
      )
    };
  }

  if (!service || typeof service !== "object") {
    return {
      ok: false,
      diagnostic: createDiagnostic(
        "SERVICE_REGISTRATION_INVALID",
        `Service '${serviceId}' registration requires a service definition object`,
        {
          serviceId,
          moduleId
        }
      )
    };
  }

  return {
    ok: true,
    value: {
      serviceId,
      moduleId,
      service
    }
  };
}

function registerServiceEntry(services, registrationDiagnostics, input) {
  const validation = validateServiceRegistrationInput(input);
  if (!validation.ok) {
    registrationDiagnostics.push(validation.diagnostic);
    return {
      ok: false,
      error: validation.diagnostic
    };
  }

  const { serviceId, moduleId, service } = validation.value;
  if (services.has(serviceId)) {
    const existing = services.get(serviceId);
    const diagnostic = createDiagnostic(
      "SERVICE_DUPLICATE",
      `Service '${serviceId}' is already registered`,
      {
        serviceId,
        moduleId,
        firstModuleId: existing.moduleId
      }
    );
    registrationDiagnostics.push(diagnostic);
    return {
      ok: false,
      error: diagnostic
    };
  }

  services.set(serviceId, {
    serviceId,
    moduleId,
    service: { ...service }
  });

  return {
    ok: true
  };
}

function getServiceEntry(services, serviceId) {
  const service = services.get(serviceId)?.service;
  if (!service) {
    return null;
  }

  return { ...service };
}

function listServiceEntries(services) {
  return [...services.values()]
    .map((entry) => ({
      serviceId: entry.serviceId,
      moduleId: entry.moduleId,
      service: { ...entry.service }
    }))
    .sort((left, right) => left.serviceId.localeCompare(right.serviceId));
}

function resolveServiceRegistryStatus(services, registrationDiagnostics, options = {}) {
  const moduleRegistry = options.moduleRegistry ?? null;
  const extraDiagnostics = normalizeDiagnosticEntries(options.additionalDiagnostics);
  const entries = listServiceEntries(services);
  const serviceModuleMap = {};
  const activeServiceModuleMap = {};
  const diagnostics = [...registrationDiagnostics, ...extraDiagnostics];

  for (const entry of entries) {
    serviceModuleMap[entry.serviceId] = entry.moduleId;

    if (!moduleRegistry) {
      activeServiceModuleMap[entry.serviceId] = entry.moduleId;
      continue;
    }

    const state = moduleRegistry.getState(entry.moduleId);
    if (state === null) {
      diagnostics.push(
        createDiagnostic(
          "SERVICE_MODULE_NOT_DISCOVERED",
          `Service '${entry.serviceId}' module '${entry.moduleId}' is not discovered`,
          {
            serviceId: entry.serviceId,
            moduleId: entry.moduleId
          }
        )
      );
      continue;
    }

    if (state === "enabled") {
      activeServiceModuleMap[entry.serviceId] = entry.moduleId;
    }
  }

  return {
    registeredServiceIds: entries.map((entry) => entry.serviceId),
    activeRegisteredServiceIds: Object.keys(activeServiceModuleMap).sort(),
    serviceModuleMap,
    activeServiceModuleMap,
    diagnostics
  };
}

export function createServiceRegistry() {
  const services = new Map();
  const registrationDiagnostics = [];

  const register = (input) => registerServiceEntry(services, registrationDiagnostics, input);
  const get = (serviceId) => getServiceEntry(services, serviceId);
  const list = () => listServiceEntries(services);
  const resolveStatus = (options = {}) =>
    resolveServiceRegistryStatus(services, registrationDiagnostics, options);

  return {
    register,
    get,
    list,
    resolveStatus
  };
}
