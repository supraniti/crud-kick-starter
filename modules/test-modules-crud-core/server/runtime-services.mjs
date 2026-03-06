export function registerServices({ registry }) {
  registry.register({
    serviceId: "test-modules-crud-core-index-service",
    moduleId: "test-modules-crud-core",
    service: {
      label: "Test Modules CRUD Core Index Service",
      description: "Provides runtime metadata for test modules crud core indexing and search refresh."
    }
  });

  registry.register({
    serviceId: "articles-index-service",
    moduleId: "test-modules-crud-core",
    service: {
      label: "Articles Index Service",
      description: "Provides runtime metadata for article indexing and search refresh."
    }
  });
}
