import { readConfig } from "../config.js";

export function createContainerRegistry() {
  const { mongoContainerName, mongoImage, mongoPort } = readConfig();

  const mongoPortBinding = `${mongoPort}`;

  return {
    mongo: {
      id: "mongo",
      label: "MongoDB",
      dockerName: mongoContainerName,
      tags: ["database", "mongo"],
      provision: {
        image: mongoImage,
        createOptions: {
          ExposedPorts: {
            "27017/tcp": {}
          },
          HostConfig: {
            PortBindings: {
              "27017/tcp": [
                {
                  HostPort: mongoPortBinding
                }
              ]
            },
            RestartPolicy: {
              Name: "unless-stopped"
            }
          }
        }
      }
    }
  };
}

export function resolveContainer(registry, id) {
  const container = registry[id];

  if (!container) {
    const error = new Error(`Unknown container id: ${id}`);
    error.code = "UNKNOWN_CONTAINER_ID";
    error.statusCode = 404;
    throw error;
  }

  return container;
}
