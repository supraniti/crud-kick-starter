import { createDockerEngine } from "./docker-engine.js";
import { createContainerRegistry, resolveContainer } from "./container-registry.js";

function toErrorShape(error) {
  return {
    code: error?.code ?? "CONTAINER_MANAGER_ERROR",
    message: error?.message ?? "Container manager request failed"
  };
}

function withMetadata(container, payload, operation) {
  return {
    ok: true,
    operation,
    container: {
      id: container.id,
      label: container.label,
      dockerName: container.dockerName,
      tags: container.tags
    },
    engine: payload.engine,
    status: payload.status,
    timestamp: new Date().toISOString()
  };
}

async function runOperation({
  registry,
  engine,
  containerId,
  operation,
  executor
}) {
  const container = resolveContainer(registry, containerId);
  const engineProbe = await engine.probe();

  if (!engineProbe.available) {
    return {
      ok: false,
      operation,
      container: {
        id: container.id,
        label: container.label,
        dockerName: container.dockerName,
        tags: container.tags
      },
      engine: engineProbe,
      error: {
        code: "DOCKER_UNAVAILABLE",
        message: "Docker engine is not available"
      },
      timestamp: new Date().toISOString()
    };
  }

  try {
    const status = await executor(container);
    return withMetadata(
      container,
      {
        engine: engineProbe,
        status
      },
      operation
    );
  } catch (error) {
    return {
      ok: false,
      operation,
      container: {
        id: container.id,
        label: container.label,
        dockerName: container.dockerName,
        tags: container.tags
      },
      engine: engineProbe,
      error: toErrorShape(error),
      timestamp: new Date().toISOString()
    };
  }
}

export function createContainerManager(dependencies = {}) {
  const registry = dependencies.registry ?? createContainerRegistry();
  const engine = dependencies.engine ?? createDockerEngine();

  return {
    async status(containerId) {
    return runOperation({
      registry,
      engine,
      containerId,
      operation: "status",
      executor: (container) => engine.status(container)
    });
  },
  async start(containerId) {
    return runOperation({
      registry,
      engine,
      containerId,
      operation: "start",
      executor: (container) => engine.start(container)
    });
  },
  async stop(containerId) {
    return runOperation({
      registry,
      engine,
      containerId,
      operation: "stop",
      executor: (container) => engine.stop(container)
    });
  },
  async restart(containerId) {
    return runOperation({
      registry,
      engine,
      containerId,
      operation: "restart",
      executor: (container) => engine.restart(container)
    });
  }
  };
}
