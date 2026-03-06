export function registerServices({ registry }) {
  registry.register({
    serviceId: "test-modules-operations-dispatch-index-service",
    moduleId: "test-modules-operations-dispatch",
    service: {
      label: "Test Modules Operations Dispatch Index Service",
      description: "Provides runtime metadata for test modules operations dispatch indexing and search refresh."
    }
  });

  registry.register({
    serviceId: "dispatches-index-service",
    moduleId: "test-modules-operations-dispatch",
    service: {
      label: "Dispatches Index Service",
      description: "Provides runtime metadata for dispatch indexing and search refresh."
    }
  });
}
