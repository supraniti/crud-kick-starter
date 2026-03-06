import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildArtifacts } from "./module-scaffold/artifact-builders.mjs";
import { parseCliArgs } from "./module-scaffold/cli-parser.mjs";
import { ScaffoldError, buildDefaultCollectionFieldDescriptors, normalizeInput } from "./module-scaffold/profile-normalization.mjs";


const SCRIPT_FILE_PATH = fileURLToPath(import.meta.url);
const SCRIPT_DIR_PATH = path.dirname(SCRIPT_FILE_PATH);
const REPO_ROOT = path.resolve(SCRIPT_DIR_PATH, "..", "..");
const TEMPLATE_MANIFEST_PATH = path.resolve(
  SCRIPT_DIR_PATH,
  "module-scaffold",
  "template-manifest.json"
);

async function readManifestTemplate() {
  return fs.readFile(TEMPLATE_MANIFEST_PATH, "utf8");
}

async function writeArtifacts(moduleDir, artifacts, dryRun) {
  const writtenFiles = [];
  for (const [relativePath, contents] of Object.entries(artifacts)) {
    const targetPath = path.resolve(moduleDir, relativePath);
    writtenFiles.push(targetPath);

    if (dryRun) {
      continue;
    }

    await fs.mkdir(path.dirname(targetPath), {
      recursive: true
    });
    await fs.writeFile(targetPath, contents, "utf8");
  }

  return writtenFiles;
}

export async function scaffoldModule(rawInput = {}) {
  const normalized = normalizeInput(rawInput);
  const moduleDir = path.resolve(normalized.targetDir, normalized.moduleId);
  const moduleExists = await fs
    .stat(moduleDir)
    .then((stats) => stats.isDirectory())
    .catch((error) => {
      if (error?.code === "ENOENT") {
        return false;
      }
      throw error;
    });

  if (moduleExists && !normalized.force) {
    throw new ScaffoldError(
      "MODULE_SCAFFOLDER_PATH_COLLISION",
      `Module path '${moduleDir}' already exists`,
      [moduleDir]
    );
  }

  const templateManifest = await readManifestTemplate();
  const artifacts = buildArtifacts(
    templateManifest,
    normalized,
    buildDefaultCollectionFieldDescriptors
  );
  const files = await writeArtifacts(moduleDir, artifacts, normalized.dryRun);

  return {
    ok: true,
    moduleId: normalized.moduleId,
    moduleDir,
    dryRun: normalized.dryRun,
    files
  };
}

function printUsage() {
  console.log(`Usage: node server/scripts/module-scaffold.mjs --module-id <id> [options]

Options:
  --module-label <label>       Navigation/module label (default: title-cased module id)
  --collection-id <id>         Collection id (default: module id)
  --collection-label <label>   Collection label (default: module label)
  --entity-singular <label>    Singular entity name (default: singularized collection label)
  --icon <icon>                Navigation icon token (default: inventory_2)
  --order <n>                  Navigation order (default: 30)
  --id-prefix <prefix>         Item id prefix used in generated handlers (default: first 3 chars of module id)
  --persistence-mode <mode>    Generated collection persistence mode: auto|file|memory (default: auto)
  --target-dir <path>          Modules root directory (default: <repo>/modules)
  --force                      Allow writing into an existing module directory
  --dry-run                    Validate and print result without writing files
  --help                       Show usage
`);
}

async function runCli() {
  const cliInput = parseCliArgs(process.argv.slice(2));
  if (cliInput.help) {
    printUsage();
    return;
  }

  try {
    const result = await scaffoldModule(cliInput);
    console.log(
      JSON.stringify(
        {
          ok: true,
          moduleId: result.moduleId,
          moduleDir: result.moduleDir,
          dryRun: result.dryRun,
          files: result.files.map((filePath) => path.relative(REPO_ROOT, filePath))
        },
        null,
        2
      )
    );
  } catch (error) {
    const code =
      typeof error?.code === "string" ? error.code : "MODULE_SCAFFOLDER_WRITE_FAILURE";
    const details = Array.isArray(error?.details) ? error.details : [];
    const message =
      typeof error?.message === "string" && error.message.length > 0
        ? error.message
        : "Module scaffolder failed";

    console.error(
      JSON.stringify(
        {
          ok: false,
          error: {
            code,
            message,
            details
          }
        },
        null,
        2
      )
    );
    process.exitCode = 1;
  }
}

const isDirectCliExecution =
  process.argv[1] && path.resolve(process.argv[1]) === SCRIPT_FILE_PATH;

if (isDirectCliExecution) {
  await runCli();
}

export { ScaffoldError, parseCliArgs, normalizeInput };
