import { MongoClient } from "mongodb";

function errorResponse(reply, error) {
  const statusCode =
    error?.statusCode ??
    (error?.code === "UNKNOWN_CONTAINER_ID" ? 404 : 500);

  reply.code(statusCode);
  return {
    ok: false,
    error: {
      code: error?.code ?? "INTERNAL_ERROR",
      message: error?.message ?? "Unhandled error"
    },
    timestamp: new Date().toISOString()
  };
}

async function runContainerOperation(reply, action) {
  try {
    const payload = await action();

    if (!payload.ok) {
      const code = payload.error?.code;
      const statusCode =
        code === "DOCKER_UNAVAILABLE"
          ? 503
          : code === "DOCKER_CONTAINER_NOT_FOUND"
            ? 404
            : 500;
      reply.code(statusCode);
    }

    return payload;
  } catch (error) {
    return errorResponse(reply, error);
  }
}

async function checkMongoConnectivity(mongoUri) {
  let client;
  const result = {
    attempted: false,
    ok: false,
    error: null
  };

  try {
    result.attempted = true;
    client = new MongoClient(mongoUri, {
      serverSelectionTimeoutMS: 1200
    });
    await client.connect();
    await client.db("admin").command({ ping: 1 });
    result.ok = true;
  } catch (error) {
    result.error = {
      code: error?.code ?? "MONGO_CONNECTIVITY_ERROR",
      message: error?.message ?? "Mongo connectivity check failed"
    };
  } finally {
    if (client) {
      await client.close();
    }
  }

  return result;
}

export async function registerInfraRoutes(fastify) {
  fastify.get("/api/infra/containers/:id/status", async (request, reply) => {
    const { id } = request.params;
    return runContainerOperation(reply, () => fastify.containerManager.status(id));
  });

  fastify.post("/api/infra/containers/:id/start", async (request, reply) => {
    const { id } = request.params;
    return runContainerOperation(reply, () => fastify.containerManager.start(id));
  });

  fastify.post("/api/infra/containers/:id/stop", async (request, reply) => {
    const { id } = request.params;
    return runContainerOperation(reply, () => fastify.containerManager.stop(id));
  });

  fastify.post("/api/infra/containers/:id/restart", async (request, reply) => {
    const { id } = request.params;
    return runContainerOperation(reply, () =>
      fastify.containerManager.restart(id)
    );
  });

  fastify.get("/api/infra/mongo/check", async (_, reply) => {
    const statusPayload = await runContainerOperation(reply, () =>
      fastify.containerManager.status("mongo")
    );

    if (!statusPayload.ok) {
      return {
        ok: false,
        status: "docker-unavailable",
        container: statusPayload,
        connectivity: {
          attempted: false,
          ok: false,
          error: statusPayload.error
        },
        timestamp: new Date().toISOString()
      };
    }

    if (!statusPayload.status?.running) {
      return {
        ok: false,
        status: "container-not-running",
        container: statusPayload,
        connectivity: {
          attempted: false,
          ok: false,
          error: {
            code: "MONGO_CONTAINER_NOT_RUNNING",
            message: "Mongo container is not running"
          }
        },
        timestamp: new Date().toISOString()
      };
    }

    const connectivity = await checkMongoConnectivity(fastify.config.mongoUri);

    return {
      ok: connectivity.ok,
      status: connectivity.ok ? "connected" : "mongo-unreachable",
      container: statusPayload,
      connectivity,
      timestamp: new Date().toISOString()
    };
  });
}
