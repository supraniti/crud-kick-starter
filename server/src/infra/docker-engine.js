import Docker from "dockerode";

function resolveDockerClientOptions() {
  if (process.env.DOCKER_HOST && process.env.DOCKER_PORT) {
    return {
      host: process.env.DOCKER_HOST,
      port: Number.parseInt(process.env.DOCKER_PORT, 10)
    };
  }

  if (process.env.DOCKER_SOCKET_PATH) {
    return { socketPath: process.env.DOCKER_SOCKET_PATH };
  }

  if (process.platform === "win32") {
    return { socketPath: "//./pipe/docker_engine" };
  }

  return { socketPath: "/var/run/docker.sock" };
}

function toEngineErrorShape(code, message, fallbackMessage) {
  return {
    code,
    message: message ?? fallbackMessage
  };
}

function hasExplicitDockerErrorCode(error) {
  return Boolean(error?.code) && error.code !== "Error";
}

function isNoSuchImageError(error) {
  return `${error?.message ?? ""}`.toLowerCase().includes("no such image");
}

function toErrorShape(error) {
  if (hasExplicitDockerErrorCode(error)) {
    return toEngineErrorShape(
      error.code,
      error?.message,
      "Docker engine request failed"
    );
  }

  if (error?.statusCode === 404) {
    if (isNoSuchImageError(error)) {
      return toEngineErrorShape(
        "DOCKER_IMAGE_NOT_FOUND",
        error?.message,
        "Docker image was not found"
      );
    }

    return toEngineErrorShape(
      "DOCKER_CONTAINER_NOT_FOUND",
      error?.message,
      "Docker container was not found"
    );
  }

  if (error?.statusCode === 304) {
    return toEngineErrorShape(
      "DOCKER_CONTAINER_STATE_UNCHANGED",
      error?.message,
      "Container already in requested state"
    );
  }

  return toEngineErrorShape(
    "DOCKER_ENGINE_ERROR",
    error?.message,
    "Docker engine request failed"
  );
}

function toOperationError(error, code, message) {
  const operationError = new Error(message ?? error?.message ?? "Docker request failed");
  operationError.code = code;
  operationError.statusCode = error?.statusCode ?? 500;
  operationError.cause = error;
  return operationError;
}

function resolveContainer(containerOrName) {
  if (typeof containerOrName === "string") {
    return {
      dockerName: containerOrName
    };
  }

  return containerOrName;
}

function buildCreateOptions(containerDescriptor) {
  const descriptor = resolveContainer(containerDescriptor);
  const provision = descriptor?.provision;

  if (!provision?.image) {
    throw toOperationError(
      null,
      "CONTAINER_PROVISION_UNAVAILABLE",
      `No provision spec found for container ${descriptor?.dockerName ?? "unknown"}`
    );
  }

  return {
    name: descriptor.dockerName,
    Image: provision.image,
    ...(provision.createOptions ?? {})
  };
}

async function pullImage(docker, image) {
  await new Promise((resolve, reject) => {
    docker.pull(image, (pullError, stream) => {
      if (pullError) {
        reject(pullError);
        return;
      }

      docker.modem.followProgress(stream, (progressError) => {
        if (progressError) {
          reject(progressError);
          return;
        }

        resolve();
      });
    });
  });
}

async function createContainerIfMissing(docker, containerDescriptor) {
  const createOptions = buildCreateOptions(containerDescriptor);

  try {
    await docker.createContainer(createOptions);
  } catch (error) {
    if (error?.statusCode === 404 && toErrorShape(error).code === "DOCKER_IMAGE_NOT_FOUND") {
      try {
        await pullImage(docker, createOptions.Image);
      } catch (pullError) {
        throw toOperationError(
          pullError,
          "DOCKER_IMAGE_PULL_FAILED",
          pullError?.message ?? "Failed to pull Docker image"
        );
      }

      await docker.createContainer(createOptions);
      return;
    }

    throw toOperationError(
      error,
      toErrorShape(error).code,
      error?.message ?? "Failed to create missing container"
    );
  }
}

function mapStateFromInspect(inspectPayload) {
  const state = inspectPayload?.State?.Status ?? "unknown";

  return {
    exists: true,
    running: Boolean(inspectPayload?.State?.Running),
    state,
    statusText: inspectPayload?.State?.Status ?? "unknown"
  };
}

export function createDockerEngine() {
  const docker = new Docker(resolveDockerClientOptions());

  return {
    async probe() {
      try {
        await docker.ping();
        return {
          available: true
        };
      } catch (error) {
        return {
          available: false,
          error: toErrorShape(error)
        };
      }
    },
    async status(containerOrName) {
      const descriptor = resolveContainer(containerOrName);
      const container = docker.getContainer(descriptor.dockerName);

      try {
        const inspectPayload = await container.inspect();
        return mapStateFromInspect(inspectPayload);
      } catch (error) {
        if (error?.statusCode === 404) {
          return {
            exists: false,
            running: false,
            state: "missing",
            statusText: "container-not-found"
          };
        }

        throw error;
      }
    },
    async start(containerOrName) {
      const descriptor = resolveContainer(containerOrName);
      const container = docker.getContainer(descriptor.dockerName);

      try {
        await container.start();
      } catch (error) {
        if (error?.statusCode === 304) {
          return this.status(descriptor);
        }

        if (error?.statusCode === 404) {
          await createContainerIfMissing(docker, descriptor);
          await docker.getContainer(descriptor.dockerName).start();
          return this.status(descriptor);
        }

        throw toOperationError(
          error,
          toErrorShape(error).code,
          error?.message ?? "Failed to start container"
        );
      }

      return this.status(descriptor);
    },
    async stop(containerOrName) {
      const descriptor = resolveContainer(containerOrName);
      const container = docker.getContainer(descriptor.dockerName);

      try {
        await container.stop();
      } catch (error) {
        if (error?.statusCode === 304) {
          return this.status(descriptor);
        }

        if (error?.statusCode === 404) {
          throw toOperationError(
            error,
            "DOCKER_CONTAINER_NOT_FOUND",
            `Container ${descriptor.dockerName} was not found`
          );
        }

        throw toOperationError(
          error,
          toErrorShape(error).code,
          error?.message ?? "Failed to stop container"
        );
      }

      return this.status(descriptor);
    },
    async restart(containerOrName) {
      const descriptor = resolveContainer(containerOrName);
      const container = docker.getContainer(descriptor.dockerName);

      try {
        await container.restart();
      } catch (error) {
        if (error?.statusCode === 404) {
          return this.start(descriptor);
        }

        throw toOperationError(
          error,
          toErrorShape(error).code,
          error?.message ?? "Failed to restart container"
        );
      }

      return this.status(descriptor);
    }
  };
}
