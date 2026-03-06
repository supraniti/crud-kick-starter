import { buildServer } from "./app.js";

const server = buildServer();

try {
  await server.listen({
    host: server.config.host,
    port: server.config.port
  });
  server.log.info(
    `Server running on http://${server.config.host}:${server.config.port}`
  );
} catch (error) {
  server.log.error(error);
  process.exit(1);
}
