export function registerPersistencePlugins({
  registry,
  manifest,
  recordsNotesRepository
}) {
  registry.register({
    pluginId: "records-collections-persistence",
    moduleId: manifest?.id ?? "records",
    collections: [
      {
        collectionId: "records",
        repository: recordsNotesRepository
      },
      {
        collectionId: "notes",
        repository: recordsNotesRepository
      }
    ]
  });
}
