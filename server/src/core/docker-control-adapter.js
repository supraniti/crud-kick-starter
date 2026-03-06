function normalizedError(code, message) {
  return {
    code: code ?? "DOCKER_CONTROL_OPERATION_FAILED",
    message: message ?? "Docker control operation failed"
  };
}

function resolveOperationContainer(payload, fallbackContainerId) {
  return {
    id: payload?.container?.id ?? fallbackContainerId ?? "unknown",
    dockerName: payload?.container?.dockerName ?? "unknown"
  };
}

function resolveOperationEngine(payload) {
  return payload?.engine ?? { available: false };
}

function resolveOperationTimestamp(payload) {
  return payload?.timestamp ?? new Date().toISOString();
}

function invalidOperationPayloadResult(operation, fallbackContainerId) {
  return {
    ok: false,
    operation,
    container: resolveOperationContainer(null, fallbackContainerId),
    engine: resolveOperationEngine(null),
    error: normalizedError(
      "DOCKER_CONTROL_INVALID_PAYLOAD",
      "Adapter received invalid payload"
    ),
    timestamp: resolveOperationTimestamp(null)
  };
}

function successfulOperationResult(operation, payload, fallbackContainerId) {
  return {
    ok: true,
    operation,
    container: resolveOperationContainer(payload, fallbackContainerId),
    engine: resolveOperationEngine(payload),
    status: payload.status ?? null,
    timestamp: resolveOperationTimestamp(payload)
  };
}

function failedOperationResult(operation, payload, fallbackContainerId) {
  return {
    ok: false,
    operation,
    container: resolveOperationContainer(payload, fallbackContainerId),
    engine: resolveOperationEngine(payload),
    error: normalizedError(payload?.error?.code, payload?.error?.message),
    timestamp: resolveOperationTimestamp(payload)
  };
}

function operationResult({ operation, payload, fallbackContainerId }) {
  if (!payload || typeof payload !== "object") {
    return invalidOperationPayloadResult(operation, fallbackContainerId);
  }

  if (payload.ok) {
    return successfulOperationResult(operation, payload, fallbackContainerId);
  }

  return failedOperationResult(operation, payload, fallbackContainerId);
}

async function run({ containerId, operation, executor }) {
  try {
    const payload = await executor(containerId);
    return operationResult({
      operation,
      payload,
      fallbackContainerId: containerId
    });
  } catch (error) {
    return {
      ok: false,
      operation,
      container: {
        id: containerId,
        dockerName: "unknown"
      },
      engine: {
        available: false
      },
      error: normalizedError(error?.code, error?.message),
      timestamp: new Date().toISOString()
    };
  }
}

export function createDockerControlAdapter({ containerManager }) {
  if (!containerManager) {
    throw new Error("containerManager dependency is required");
  }

  return {
    status(containerId) {
      return run({
        containerId,
        operation: "status",
        executor: (id) => containerManager.status(id)
      });
    },
    start(containerId) {
      return run({
        containerId,
        operation: "start",
        executor: (id) => containerManager.start(id)
      });
    },
    stop(containerId) {
      return run({
        containerId,
        operation: "stop",
        executor: (id) => containerManager.stop(id)
      });
    },
    restart(containerId) {
      return run({
        containerId,
        operation: "restart",
        executor: (id) => containerManager.restart(id)
      });
    }
  };
}
