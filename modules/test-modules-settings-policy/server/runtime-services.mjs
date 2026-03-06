export function registerServices({ registry }) {
  registry.register({
    serviceId: "test-modules-settings-policy-index-service",
    moduleId: "test-modules-settings-policy",
    service: {
      label: "Test Modules Settings Policy Index Service",
      description: "Provides runtime metadata for test modules settings policy indexing and search refresh."
    }
  });

  registry.register({
    serviceId: "settings-policy-service",
    moduleId: "test-modules-settings-policy",
    service: {
      label: "WPX Settings Policy Service",
      description: "Provides the active WPX settings profile for publish policy decisions.",
      readActiveProfile: async () => null
    }
  });
}

