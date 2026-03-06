import Fastify from "fastify";
import { readConfig } from "./config.js";
import { createContainerManager } from "./infra/container-manager.js";
import { registerInfraRoutes } from "./routes/infra.js";
import { registerReferenceDomainRoutes } from "./routes/reference-domain-routes.js";
import { registerSystemRoutes } from "./routes/system.js";

export function buildServer(options = {}) {
  const config = options.config ?? readConfig();
  const pluginTimeoutMs =
    options.pluginTimeout ??
    (process.env.NODE_ENV === "test" ? 30_000 : undefined);
  const server = Fastify({
    logger: options.logger ?? true,
    ...(pluginTimeoutMs ? { pluginTimeout: pluginTimeoutMs } : {})
  });

  server.decorate("config", config);
  server.decorate(
    "containerManager",
    options.containerManager ?? createContainerManager()
  );

  server.setErrorHandler((error, _, reply) => {
    const statusCode = error?.statusCode ?? 500;
    reply.code(statusCode).send({
      ok: false,
      error: {
        code: error?.code ?? "INTERNAL_SERVER_ERROR",
        message: error?.message ?? "Unhandled server error"
      },
      timestamp: new Date().toISOString()
    });
  });

  server.register(registerSystemRoutes);
  server.register(registerInfraRoutes);
  server.register(registerReferenceDomainRoutes, {
    moduleRuntimeStateFile: options.moduleRuntimeStateFile,
    modulesDir: options.modulesDir,
    referenceStatePersistence: options.referenceStatePersistence,
    moduleIdTranslationMapFile: options.moduleIdTranslationMapFile,
    moduleIdTranslationMode: options.moduleIdTranslationMode
  });

  return server;
}

