import fs from "node:fs/promises";
import path from "node:path";
import { expect, test } from "vitest";
import { scaffoldModule } from "../../scripts/module-scaffold.mjs";
import { SUPPORTED_PROFILE_ROUTE_VIEW_KINDS } from "../../scripts/module-scaffold/shared.mjs";
import { ROUTE_VIEW_KIND_LIST } from "../../src/core/module-registry-helpers/route-view-contract.js";
import { createTempModulesDir } from "../helpers/module-scaffolder-runtime-test-helpers.js";

function registerModuleScaffolderContractCoreRouteViewSuite() {
test("keeps scaffolder routeView kind support synchronized with manifest routeView contract", () => {
  expect([...SUPPORTED_PROFILE_ROUTE_VIEW_KINDS].sort()).toEqual(
    [...ROUTE_VIEW_KIND_LIST].sort()
  );
});

test("accepts custom routeView profile and emits deterministic frontend entrypoint artifact", async () => {
  const targetDir = await createTempModulesDir();

  const result = await scaffoldModule({
    profile: {
      moduleId: "bulletins",
      routeSegment: "bulletins",
      navigationTitle: "Bulletins",
      routeView: {
        kind: "custom",
        entrypoint: "./frontend/view-entrypoint.jsx",
        bannerMessage: "Generated module-owned bulletin view",
        quickActions: ["open-remotes", "open-missions", "open-remotes"],
        actions: [
          {
            id: "open-review-queue",
            label: "Open review queue",
            type: "navigate",
            route: {
              moduleId: "bulletins",
              state: {
                status: "review"
              }
            }
          },
          {
            id: "bulletin-runbook",
            label: "Bulletin runbook",
            type: "external",
            href: "https://bulletins.example.invalid/runbook",
            target: "blank"
          },
          {
            id: "reset-bulletin-filters",
            label: "Reset bulletin filters",
            type: "module:filters",
            commandId: "reset-filters",
            payload: {
              status: "",
              collectionId: "bulletins"
            }
          }
        ]
      },
      collections: [
        {
          id: "bulletins",
          label: "Bulletins"
        }
      ],
      includeSettings: true,
      includeRuntimeServices: true
    },
    targetDir
  });

  expect(result.ok).toBe(true);
  expect(result.files).toHaveLength(5);
  expect(
    result.files.some((filePath) =>
      filePath.endsWith(path.join("frontend", "view-entrypoint.jsx"))
    )
  ).toBe(true);

  const moduleDir = path.resolve(targetDir, "bulletins");
  const manifest = JSON.parse(
    await fs.readFile(path.resolve(moduleDir, "module.json"), "utf8")
  );
  const viewEntrypoint = await fs.readFile(
    path.resolve(moduleDir, "frontend", "view-entrypoint.jsx"),
    "utf8"
  );

  expect(manifest.ui.routeView).toEqual(
    expect.objectContaining({
      kind: "custom",
      entrypoint: "./frontend/view-entrypoint.jsx",
      viewId: "bulletins",
      bannerMessage: "Generated module-owned bulletin view",
      quickActions: ["open-remotes", "open-missions"],
      actions: [
        {
          id: "open-review-queue",
          label: "Open review queue",
          type: "navigate",
          route: {
            moduleId: "bulletins",
            state: {
              status: "review"
            }
          }
        },
        {
          id: "bulletin-runbook",
          label: "Bulletin runbook",
          type: "external",
          href: "https://bulletins.example.invalid/runbook",
          target: "blank"
        },
        {
          id: "reset-bulletin-filters",
          label: "Reset bulletin filters",
          type: "module:filters",
          commandId: "reset-filters",
          payload: {
            status: "",
            collectionId: "bulletins"
          }
        }
      ],
      capabilities: {
        usesCollectionsDomain: true
      }
    })
  );
  expect(viewEntrypoint).toContain("createCollectionsRouteViewDescriptor");
  expect(viewEntrypoint).toContain('moduleId: "bulletins"');
  expect(viewEntrypoint).toContain('bannerMessage: "Generated module-owned bulletin view"');
  expect(viewEntrypoint).toContain('quickActions: ["open-remotes","open-missions"]');
  expect(viewEntrypoint).toContain("function runAction({ action } = {})");
  expect(viewEntrypoint).toContain(
    'actions: [{"id":"open-review-queue","label":"Open review queue","type":"navigate","route":{"moduleId":"bulletins","state":{"status":"review"}}},{"id":"bulletin-runbook","label":"Bulletin runbook","type":"external","href":"https://bulletins.example.invalid/runbook","target":"blank"},{"id":"reset-bulletin-filters","label":"Reset bulletin filters","type":"module:filters","commandId":"reset-filters","payload":{"status":"","collectionId":"bulletins"}}]'
  );
});

test("supports custom routeView capability switches in generated frontend entrypoint output", async () => {
  const targetDir = await createTempModulesDir();

  const result = await scaffoldModule({
    profile: {
      moduleId: "operations",
      routeSegment: "operations",
      navigationTitle: "Operations",
      routeView: {
        kind: "custom",
        entrypoint: "./frontend/view-entrypoint.jsx",
        capabilities: {
          usesCollectionsDomain: false
        },
        bannerMessage: "Operations custom route mounted without collections domain",
        quickActions: ["open-remotes"],
        actions: [
          {
            id: "operations-runbook",
            label: "Operations runbook",
            type: "external",
            href: "https://operations.example.invalid/runbook",
            target: "blank"
          }
        ]
      },
      collections: [
        {
          id: "operations",
          label: "Operations"
        }
      ],
      includeSettings: true,
      includeRuntimeServices: true
    },
    targetDir
  });

  expect(result.ok).toBe(true);
  expect(result.files).toHaveLength(5);

  const moduleDir = path.resolve(targetDir, "operations");
  const manifest = JSON.parse(
    await fs.readFile(path.resolve(moduleDir, "module.json"), "utf8")
  );
  const viewEntrypoint = await fs.readFile(
    path.resolve(moduleDir, "frontend", "view-entrypoint.jsx"),
    "utf8"
  );

  expect(manifest.ui.routeView).toEqual(
    expect.objectContaining({
      kind: "custom",
      entrypoint: "./frontend/view-entrypoint.jsx",
      viewId: "operations",
      quickActions: ["open-remotes"],
      actions: [
        {
          id: "operations-runbook",
          label: "Operations runbook",
          type: "external",
          href: "https://operations.example.invalid/runbook",
          target: "blank"
        }
      ],
      capabilities: {
        usesCollectionsDomain: false
      }
    })
  );
  expect(viewEntrypoint).toContain("const viewDescriptor = Object.freeze");
  expect(viewEntrypoint).toContain("usesCollectionsDomain: false");
  expect(viewEntrypoint).toContain('quickActions: ["open-remotes"]');
  expect(viewEntrypoint).toContain(
    'actions: [{"id":"operations-runbook","label":"Operations runbook","type":"external","href":"https://operations.example.invalid/runbook","target":"blank"}]'
  );
  expect(viewEntrypoint).toContain("GeneratedModuleRouteView");
});

test("supports built-in non-collections routeView kinds without generating custom frontend entrypoints", async () => {
  const targetDir = await createTempModulesDir();

  const result = await scaffoldModule({
    profile: {
      moduleId: "mission-console",
      routeSegment: "mission-console",
      navigationTitle: "Mission Console",
      routeView: {
        kind: "missions",
        capabilities: {
          usesCollectionsDomain: false
        },
        bannerMessage: "Mission console built-in route view",
        quickActions: ["open-remotes"]
      },
      collections: [
        {
          id: "mission-console",
          label: "Mission Console"
        }
      ],
      includeSettings: true,
      includeRuntimeServices: true
    },
    targetDir
  });

  expect(result.ok).toBe(true);
  expect(result.files).toHaveLength(4);
  expect(
    result.files.some((filePath) =>
      filePath.endsWith(path.join("frontend", "view-entrypoint.jsx"))
    )
  ).toBe(false);

  const moduleDir = path.resolve(targetDir, "mission-console");
  const manifest = JSON.parse(
    await fs.readFile(path.resolve(moduleDir, "module.json"), "utf8")
  );

  expect(manifest.ui.routeView).toEqual(
    expect.objectContaining({
      kind: "missions",
      viewId: "mission-console",
      bannerMessage: "Mission console built-in route view",
      quickActions: ["open-remotes"],
      capabilities: {
        usesCollectionsDomain: false
      }
    })
  );
  expect(manifest.ui.routeView.entrypoint).toBeUndefined();
});


test("rejects unknown routeView profile fields deterministically", async () => {
  await expect(
    scaffoldModule({
      profile: {
        moduleId: "dispatch",
        routeSegment: "dispatch",
        navigationTitle: "Dispatch",
        routeView: {
          kind: "custom",
          entrypoint: "./frontend/view-entrypoint.jsx",
          unsupportedRouteField: true,
          capabilities: {
            usesCollectionsDomain: true,
            unsupportedCapability: true
          }
        },
        collections: [
          {
            id: "dispatch",
            label: "Dispatch"
          }
        ],
        includeSettings: true,
        includeRuntimeServices: true
      }
    })
  ).rejects.toMatchObject({
    code: "MODULE_SCAFFOLDER_PROFILE_UNKNOWN_FIELD",
    details: expect.arrayContaining([
      "profile.routeView.unsupportedRouteField",
      "profile.routeView.capabilities.unsupportedCapability"
    ])
  });
});

test("accepts custom routeView entrypoint path overrides and emits deterministic artifact path", async () => {
  const targetDir = await createTempModulesDir();

  const result = await scaffoldModule({
    profile: {
      moduleId: "dispatch",
      routeSegment: "dispatch",
      navigationTitle: "Dispatch",
      routeView: {
        kind: "custom",
        entrypoint: "./frontend/custom-dispatch-entrypoint.mjs",
        capabilities: {
          usesCollectionsDomain: false
        },
        bannerMessage: "Dispatch custom route without collections domain"
      },
      collections: [
        {
          id: "dispatch",
          label: "Dispatch"
        }
      ],
      includeSettings: true,
      includeRuntimeServices: true
    },
    targetDir
  });

  expect(result.ok).toBe(true);
  expect(
    result.files.some((filePath) =>
      filePath.endsWith(path.join("frontend", "custom-dispatch-entrypoint.mjs"))
    )
  ).toBe(true);

  const moduleDir = path.resolve(targetDir, "dispatch");
  const manifest = JSON.parse(
    await fs.readFile(path.resolve(moduleDir, "module.json"), "utf8")
  );
  const entrypoint = await fs.readFile(
    path.resolve(moduleDir, "frontend", "custom-dispatch-entrypoint.mjs"),
    "utf8"
  );

  expect(manifest.ui.routeView).toEqual(
    expect.objectContaining({
      kind: "custom",
      entrypoint: "./frontend/custom-dispatch-entrypoint.mjs",
      viewId: "dispatch",
      capabilities: {
        usesCollectionsDomain: false
      }
    })
  );
  expect(entrypoint).toContain('moduleId: "dispatch"');
  expect(entrypoint).toContain("createElement(Alert");
});

test("rejects invalid routeView quickActions values deterministically", async () => {
  await expect(
    scaffoldModule({
      profile: {
        moduleId: "dispatch",
        routeSegment: "dispatch",
        navigationTitle: "Dispatch",
        routeView: {
          kind: "custom",
          entrypoint: "./frontend/view-entrypoint.jsx",
          quickActions: ["open-remotes", "Invalid Action"]
        },
        collections: [
          {
            id: "dispatch",
            label: "Dispatch"
          }
        ],
        includeSettings: true,
        includeRuntimeServices: true
      }
    })
  ).rejects.toMatchObject({
    code: "MODULE_SCAFFOLDER_PROFILE_INVALID",
    details: expect.arrayContaining([
      "profile.routeView.quickActions[1] must be lowercase kebab-case (legacy built-ins: open-products, open-taxonomies, open-remotes, open-missions)"
    ])
  });
});

test("rejects invalid routeView actions values deterministically", async () => {
  await expect(
    scaffoldModule({
      profile: {
        moduleId: "dispatch",
        routeSegment: "dispatch",
        navigationTitle: "Dispatch",
        routeView: {
          kind: "custom",
          entrypoint: "./frontend/view-entrypoint.jsx",
          actions: [
            {
              id: "dispatch-runbook",
              label: "Dispatch runbook",
              type: "external",
              href: "ftp://dispatch.example.invalid/runbook"
            }
          ]
        },
        collections: [
          {
            id: "dispatch",
            label: "Dispatch"
          }
        ],
        includeSettings: true,
        includeRuntimeServices: true
      }
    })
  ).rejects.toMatchObject({
    code: "MODULE_SCAFFOLDER_PROFILE_INVALID",
    details: expect.arrayContaining([
      "profile.routeView.actions[0].href Route view action href must be a valid http(s) URL"
    ])
  });
});

test("rejects invalid custom routeView entrypoint paths deterministically", async () => {
  await expect(
    scaffoldModule({
      profile: {
        moduleId: "dispatch",
        routeSegment: "dispatch",
        navigationTitle: "Dispatch",
        routeView: {
          kind: "custom",
          entrypoint: "../frontend/escape.mjs"
        },
        collections: [
          {
            id: "dispatch",
            label: "Dispatch"
          }
        ],
        includeSettings: true,
        includeRuntimeServices: true
      }
    })
  ).rejects.toMatchObject({
    code: "MODULE_SCAFFOLDER_PROFILE_INVALID",
    details: expect.arrayContaining([
      "profile.routeView.entrypoint must be a relative frontend module path like './frontend/view-entrypoint.jsx'"
    ])
  });
});

test("rejects non-custom routeView entrypoint usage deterministically", async () => {
  await expect(
    scaffoldModule({
      profile: {
        moduleId: "taxonomies-hub",
        routeSegment: "taxonomies-hub",
        navigationTitle: "Taxonomies Hub",
        routeView: {
          kind: "taxonomies",
          entrypoint: "./frontend/taxonomies-view.jsx"
        },
        collections: [
          {
            id: "taxonomies-hub",
            label: "Taxonomies Hub"
          }
        ],
        includeSettings: true,
        includeRuntimeServices: true
      }
    })
  ).rejects.toMatchObject({
    code: "MODULE_SCAFFOLDER_PROFILE_INVALID",
    details: expect.arrayContaining([
      "profile.routeView.entrypoint is only supported when profile.routeView.kind='custom'"
    ])
  });
});

test("rejects module-contributed routeView kind without explicit entrypoint", async () => {
  await expect(
    scaffoldModule({
      profile: {
        moduleId: "ops-console",
        routeSegment: "ops-console",
        navigationTitle: "Ops Console",
        routeView: {
          kind: "ops-runtime"
        },
        collections: [
          {
            id: "ops-console",
            label: "Ops Console"
          }
        ],
        includeSettings: true,
        includeRuntimeServices: true
      }
    })
  ).rejects.toMatchObject({
    code: "MODULE_SCAFFOLDER_PROFILE_INVALID",
    details: expect.arrayContaining([
      "profile.routeView.entrypoint is required when profile.routeView.kind is module-contributed"
    ])
  });
});

test("accepts module-contributed routeView kind with explicit entrypoint", async () => {
  const targetDir = await createTempModulesDir();

  const result = await scaffoldModule({
    profile: {
      moduleId: "ops-console",
      routeSegment: "ops-console",
      navigationTitle: "Ops Console",
      routeView: {
        kind: "ops-runtime",
        entrypoint: "./frontend/ops-runtime-entrypoint.mjs",
        capabilities: {
          usesCollectionsDomain: false
        }
      },
      collections: [
        {
          id: "ops-console",
          label: "Ops Console"
        }
      ],
      includeSettings: true,
      includeRuntimeServices: true
    },
    targetDir
  });

  expect(result.ok).toBe(true);
  expect(
    result.files.some((filePath) =>
      filePath.endsWith(path.join("frontend", "ops-runtime-entrypoint.mjs"))
    )
  ).toBe(true);
});

test("rejects incompatible usesCollectionsDomain values for built-in route kinds deterministically", async () => {
  await expect(
    scaffoldModule({
      profile: {
        moduleId: "ops-console",
        routeSegment: "ops-console",
        navigationTitle: "Ops Console",
        routeView: {
          kind: "collections",
          capabilities: {
            usesCollectionsDomain: false
          }
        },
        collections: [
          {
            id: "ops-console",
            label: "Ops Console"
          }
        ],
        includeSettings: true,
        includeRuntimeServices: true
      }
    })
  ).rejects.toMatchObject({
    code: "MODULE_SCAFFOLDER_PROFILE_INVALID",
    details: expect.arrayContaining([
      "profile.routeView.capabilities.usesCollectionsDomain must be true when profile.routeView.kind='collections'"
    ])
  });

  await expect(
    scaffoldModule({
      profile: {
        moduleId: "products-hub",
        routeSegment: "products-hub",
        navigationTitle: "Products Hub",
        routeView: {
          kind: "products",
          capabilities: {
            usesCollectionsDomain: true
          }
        },
        collections: [
          {
            id: "products-hub",
            label: "Products Hub"
          }
        ],
        includeSettings: true,
        includeRuntimeServices: true
      }
    })
  ).rejects.toMatchObject({
    code: "MODULE_SCAFFOLDER_PROFILE_INVALID",
    details: expect.arrayContaining([
      "profile.routeView.capabilities.usesCollectionsDomain must be false when profile.routeView.kind='products'"
    ])
  });
});

}

registerModuleScaffolderContractCoreRouteViewSuite();

export { registerModuleScaffolderContractCoreRouteViewSuite };
