export async function registerSystemRoutes(fastify) {
  fastify.get("/health", async () => {
    return {
      ok: true,
      status: "healthy",
      service: "crud-control-server",
      uptimeSeconds: Math.floor(process.uptime()),
      timestamp: new Date().toISOString()
    };
  });

  fastify.get("/ready", async () => {
    const mongoStatus = await fastify.containerManager.status("mongo");
    const engineAvailable = Boolean(mongoStatus.engine?.available);

    return {
      ok: true,
      status: engineAvailable ? "ready" : "degraded",
      checks: {
        server: {
          ok: true,
          status: "up"
        },
        docker: {
          ok: engineAvailable,
          status: engineAvailable ? "available" : "unavailable",
          error: mongoStatus.engine?.error ?? null
        },
        mongoContainer: {
          ok: Boolean(mongoStatus.status?.exists),
          status: mongoStatus.status?.state ?? "unknown"
        }
      },
      timestamp: new Date().toISOString()
    };
  });

  fastify.get("/api/system/ping", async () => {
    return {
      ok: true,
      ping: "pong",
      timestamp: new Date().toISOString()
    };
  });
}
