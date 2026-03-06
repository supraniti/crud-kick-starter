export function registerServices({ registry }) {
  registry.register({
    serviceId: "test-modules-relations-taxonomy-index-service",
    moduleId: "test-modules-relations-taxonomy",
    service: {
      label: "Test Modules Relations Taxonomy Index Service",
      description: "Provides runtime metadata for test modules relations taxonomy indexing and search refresh."
    }
  });

  registry.register({
    serviceId: "authors-index-service",
    moduleId: "test-modules-relations-taxonomy",
    service: {
      label: "Authors Index Service",
      description: "Provides runtime metadata for author indexing and search refresh."
    }
  });

  registry.register({
    serviceId: "publishers-index-service",
    moduleId: "test-modules-relations-taxonomy",
    service: {
      label: "Publishers Index Service",
      description: "Provides runtime metadata for publisher indexing and search refresh."
    }
  });

  registry.register({
    serviceId: "editors-index-service",
    moduleId: "test-modules-relations-taxonomy",
    service: {
      label: "Editors Index Service",
      description: "Provides runtime metadata for editor indexing and search refresh."
    }
  });

  registry.register({
    serviceId: "reviews-index-service",
    moduleId: "test-modules-relations-taxonomy",
    service: {
      label: "Reviews Index Service",
      description: "Provides runtime metadata for review indexing and search refresh."
    }
  });
}
