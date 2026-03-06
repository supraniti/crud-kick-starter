import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { buildServer } from "../src/app.js";
import { createReferenceStatePersistenceAdapter } from "../src/domains/reference/runtime-kernel/state-persistence.js";
import {
  renderScenarioReportMarkdown,
  runScenarioPack
} from "./api-runner/scenario-runner.mjs";
import {
  resolveScenarioModuleIdBindings
} from "../../scripts/module-id-bindings.mjs";

const CURRENT_FILE = fileURLToPath(import.meta.url);
const CURRENT_DIR = path.dirname(CURRENT_FILE);
const DEFAULT_SCENARIO_PACK_PATH = path.resolve(
  CURRENT_DIR,
  "api-runner",
  "scenarios",
  "m22-step-a-baseline.json"
);
const DEFAULT_REPORT_DIR = path.resolve(CURRENT_DIR, "..", "runtime", "api-runner");
const DEFAULT_JSON_REPORT_PATH = path.resolve(
  DEFAULT_REPORT_DIR,
  "m22-step-a-latest.json"
);
const DEFAULT_MARKDOWN_REPORT_PATH = path.resolve(
  DEFAULT_REPORT_DIR,
  "m22-step-a-latest.md"
);
const DEFAULT_SERVER_HOST = "127.0.0.1";
const DEFAULT_MONGO_URI = "mongodb://127.0.0.1:27017/admin";

function createMockContainerManager() {
  return {
    async status() {
      return {
        ok: true,
        operation: "status",
        container: {
          id: "mongo",
          label: "MongoDB",
          dockerName: "crud-control-mongo",
          tags: ["database", "mongo"]
        },
        engine: {
          available: true
        },
        status: {
          exists: true,
          running: true,
          state: "running",
          statusText: "running"
        },
        timestamp: new Date().toISOString()
      };
    },
    async start() {
      return this.status();
    },
    async stop() {
      return this.status();
    },
    async restart() {
      return this.status();
    }
  };
}

function parseArgs(argv = []) {
  const parsed = {
    scenarioPath: DEFAULT_SCENARIO_PACK_PATH,
    baseUrl: null,
    jsonReportPath: DEFAULT_JSON_REPORT_PATH,
    markdownReportPath: DEFAULT_MARKDOWN_REPORT_PATH,
    writeReports: true,
    moduleIdMode: null,
    moduleIdMapFile: null
  };

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];

    if (token === "--scenario" && argv[index + 1]) {
      parsed.scenarioPath = path.resolve(argv[index + 1]);
      index += 1;
      continue;
    }
    if (token === "--base-url" && argv[index + 1]) {
      parsed.baseUrl = argv[index + 1];
      index += 1;
      continue;
    }
    if (token === "--json-report" && argv[index + 1]) {
      parsed.jsonReportPath = path.resolve(argv[index + 1]);
      index += 1;
      continue;
    }
    if (token === "--markdown-report" && argv[index + 1]) {
      parsed.markdownReportPath = path.resolve(argv[index + 1]);
      index += 1;
      continue;
    }
    if (token === "--no-write-reports") {
      parsed.writeReports = false;
      continue;
    }
    if (token === "--module-id-mode" && argv[index + 1]) {
      parsed.moduleIdMode = argv[index + 1];
      index += 1;
      continue;
    }
    if (token === "--module-id-map" && argv[index + 1]) {
      parsed.moduleIdMapFile = argv[index + 1];
      index += 1;
      continue;
    }
  }

  return parsed;
}

function resolveRunToken() {
  return new Date().toISOString().replace(/[^0-9]/g, "");
}

async function startIsolatedServer({
  moduleIdMode,
  moduleIdMapFile
} = {}) {
  const referenceStatePersistence = createReferenceStatePersistenceAdapter({
    enabled: true,
    mode: "memory",
    allowMemoryFallback: false,
    mongoUri: DEFAULT_MONGO_URI
  });
  const moduleIdBindings = resolveScenarioModuleIdBindings({
    mode: moduleIdMode,
    mapPath: moduleIdMapFile
  });

  const server = buildServer({
    logger: false,
    containerManager: createMockContainerManager(),
    referenceStatePersistence,
    moduleIdTranslationMode: moduleIdBindings.mode,
    moduleIdTranslationMapFile: moduleIdBindings.mapPath
  });

  await server.listen({
    host: DEFAULT_SERVER_HOST,
    port: 0
  });

  const address = server.server.address();
  if (!address || typeof address !== "object" || typeof address.port !== "number") {
    throw new Error("Failed to resolve isolated server listening port");
  }

  return {
    server,
    baseUrl: `http://${DEFAULT_SERVER_HOST}:${address.port}`,
    moduleIdBindings
  };
}

async function writeReports({
  report,
  jsonReportPath,
  markdownReportPath
}) {
  await fs.mkdir(path.dirname(jsonReportPath), {
    recursive: true
  });
  await fs.mkdir(path.dirname(markdownReportPath), {
    recursive: true
  });

  await fs.writeFile(jsonReportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  await fs.writeFile(
    markdownReportPath,
    renderScenarioReportMarkdown(report),
    "utf8"
  );
}

export async function runM22ApiRunner(options = {}) {
  const scenarioPath = options.scenarioPath ?? DEFAULT_SCENARIO_PACK_PATH;
  const scenarioText = await fs.readFile(scenarioPath, "utf8");
  const pack = JSON.parse(scenarioText);
  const moduleIdBindings = resolveScenarioModuleIdBindings({
    mode: options.moduleIdMode,
    mapPath: options.moduleIdMapFile
  });

  let isolatedServer = null;
  let baseUrl = options.baseUrl ?? null;

  try {
    if (!baseUrl) {
      isolatedServer = await startIsolatedServer({
        moduleIdMode: moduleIdBindings.mode,
        moduleIdMapFile: moduleIdBindings.mapPath
      });
      baseUrl = isolatedServer.baseUrl;
    }

    const report = await runScenarioPack({
      pack,
      baseUrl,
      initialVariables: {
        runToken: resolveRunToken(),
        moduleIds: moduleIdBindings.moduleIds,
        targetModuleIds: moduleIdBindings.targetModuleIds
      },
      defaultTimeoutMs: 5000
    });

    const result = {
      ok: report.ok,
      scenarioPath,
      baseUrl,
      moduleIdMode: moduleIdBindings.mode,
      moduleIdMapFile: moduleIdBindings.mapPath,
      report
    };

    const shouldWriteReports = options.writeReports !== false;
    if (shouldWriteReports) {
      const jsonReportPath = options.jsonReportPath ?? DEFAULT_JSON_REPORT_PATH;
      const markdownReportPath =
        options.markdownReportPath ?? DEFAULT_MARKDOWN_REPORT_PATH;
      await writeReports({
        report,
        jsonReportPath,
        markdownReportPath
      });

      result.jsonReportPath = jsonReportPath;
      result.markdownReportPath = markdownReportPath;
    }

    return result;
  } finally {
    if (isolatedServer?.server) {
      await isolatedServer.server.close();
    }
  }
}

async function runCli() {
  const args = parseArgs(process.argv.slice(2));
  const result = await runM22ApiRunner(args);

  const summary = {
    ok: result.ok,
    scenarioPath: result.scenarioPath,
    baseUrl: result.baseUrl,
    report: {
      packId: result.report.packId,
      scenarioCount: result.report.scenarioCount,
      passedCount: result.report.passedCount,
      failedCount: result.report.failedCount,
      durationMs: result.report.durationMs,
      failedScenarioId: result.report.failedScenarioId
    },
    moduleIdMode: result.moduleIdMode,
    moduleIdMapFile: result.moduleIdMapFile,
    jsonReportPath: result.jsonReportPath ?? null,
    markdownReportPath: result.markdownReportPath ?? null,
    timestamp: new Date().toISOString()
  };
  console.log(JSON.stringify(summary, null, 2));

  if (!result.ok) {
    process.exitCode = 1;
  }
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  runCli().catch((error) => {
    const payload = {
      ok: false,
      error: {
        code: error?.code ?? "M22_API_RUNNER_FAILED",
        message: error?.message ?? "M22 API runner failed"
      },
      timestamp: new Date().toISOString()
    };
    console.error(JSON.stringify(payload, null, 2));
    process.exitCode = 1;
  });
}


