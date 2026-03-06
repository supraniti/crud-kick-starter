const DEFAULTS = {
  host: "127.0.0.1",
  port: 3001,
  mongoContainerName: "crud-control-mongo",
  mongoImage: "mongo:7.0",
  mongoPort: 27017,
  mongoUri: "mongodb://127.0.0.1:27017/admin"
};

export function readConfig() {
  return {
    host: process.env.SERVER_HOST ?? DEFAULTS.host,
    port: Number.parseInt(process.env.SERVER_PORT ?? `${DEFAULTS.port}`, 10),
    mongoContainerName:
      process.env.MONGO_CONTAINER_NAME ?? DEFAULTS.mongoContainerName,
    mongoImage: process.env.MONGO_IMAGE ?? DEFAULTS.mongoImage,
    mongoPort: Number.parseInt(
      process.env.MONGO_PORT ?? `${DEFAULTS.mongoPort}`,
      10
    ),
    mongoUri: process.env.MONGO_URI ?? DEFAULTS.mongoUri
  };
}
