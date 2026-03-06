import { describe } from "vitest";
import { registerManifestDiscoverySchemaCollectionsSuite } from "./manifest-discovery.schema.collections.core.test.js";
import { registerManifestDiscoverySchemaComputedBehaviorSuite } from "./manifest-discovery.schema.computed-behavior.core.test.js";
import { registerManifestDiscoverySchemaRouteViewSettingsSuite } from "./manifest-discovery.schema.route-view-settings.core.test.js";
import { registerManifestDiscoverySchemaRouteViewRuntimeSuite } from "./manifest-discovery.schema.route-view-runtime.core.test.js";

describe("module manifest contract", () => {
  registerManifestDiscoverySchemaCollectionsSuite();
  registerManifestDiscoverySchemaComputedBehaviorSuite();
  registerManifestDiscoverySchemaRouteViewSettingsSuite();
  registerManifestDiscoverySchemaRouteViewRuntimeSuite();
});
