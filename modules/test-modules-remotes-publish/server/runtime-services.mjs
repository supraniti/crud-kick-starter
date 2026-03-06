export function registerServices({ registry }) {
  registry.register({
    serviceId: "test-modules-remotes-publish-index-service",
    moduleId: "test-modules-remotes-publish",
    service: {
      label: "Test Modules Remotes Publish Index Service",
      description: "Provides runtime metadata for test modules remotes publish indexing and search refresh."
    }
  });

  registry.register({
    serviceId: "briefs-index-service",
    moduleId: "test-modules-remotes-publish",
    service: {
      label: "Briefs Index Service",
      description: "Provides runtime metadata for brief indexing and search refresh."
    }
  });

  registry.register({
    serviceId: "digests-index-service",
    moduleId: "test-modules-remotes-publish",
    service: {
      label: "Digests Index Service",
      description: "Provides runtime metadata for digest indexing and search refresh."
    }
  });

  registry.register({
    serviceId: "remote-deploy-connector",
    moduleId: "test-modules-remotes-publish",
    service: {
      label: "Remote Deploy Connector",
      description: "Provides normalized remote deployment connector metadata."
    }
  });
}
