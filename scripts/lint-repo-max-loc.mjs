import fs from "node:fs/promises";
import path from "node:path";

const DEFAULT_MAX_LINES = 600;
const DEFAULT_SCAN_ROOTS = ["server/src", "frontend/src", "modules", "scripts"];
const SOURCE_FILE_PATTERN = /\.(js|mjs|jsx)$/i;
const SKIP_DIRS = new Set([".git", "node_modules", "dist", "coverage", "build"]);

function parseMaxLinesArg(argv) {
  const arg = argv.find((value) => value.startsWith("--max-lines="));
  if (!arg) {
    return DEFAULT_MAX_LINES;
  }

  const parsed = Number.parseInt(arg.slice("--max-lines=".length), 10);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`Invalid --max-lines value: '${arg}'`);
  }
  return parsed;
}

function parseScanRootsArg(argv) {
  const arg = argv.find((value) => value.startsWith("--scan-roots="));
  if (!arg) {
    return DEFAULT_SCAN_ROOTS;
  }

  const roots = arg
    .slice("--scan-roots=".length)
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);

  return roots.length > 0 ? roots : DEFAULT_SCAN_ROOTS;
}

function countLines(content) {
  if (content.length === 0) {
    return 0;
  }

  const normalized = content.replace(/\r\n/g, "\n").replace(/\n$/, "");
  if (normalized.length === 0) {
    return 0;
  }

  return normalized
    .split("\n")
    .filter((line) => line.length > 0)
    .length;
}

async function collectSourceFiles(rootDir, relativeRoot) {
  const resolvedRoot = path.resolve(rootDir, relativeRoot);
  const files = [];

  async function walk(currentPath) {
    let entries = [];
    try {
      entries = await fs.readdir(currentPath, { withFileTypes: true });
    } catch (error) {
      if (error && error.code === "ENOENT") {
        return;
      }
      throw error;
    }

    for (const entry of entries) {
      if (entry.isDirectory()) {
        if (!SKIP_DIRS.has(entry.name)) {
          await walk(path.join(currentPath, entry.name));
        }
        continue;
      }

      if (!entry.isFile()) {
        continue;
      }

      const absolutePath = path.join(currentPath, entry.name);
      const relativeFilePath = path.relative(rootDir, absolutePath).replace(/\\/g, "/");
      if (SOURCE_FILE_PATTERN.test(relativeFilePath)) {
        files.push(relativeFilePath);
      }
    }
  }

  await walk(resolvedRoot);
  return files;
}

async function buildReport() {
  const rootDir = process.cwd();
  const maxLines = parseMaxLinesArg(process.argv.slice(2));
  const scanRoots = parseScanRootsArg(process.argv.slice(2));
  const files = [];

  for (const scanRoot of scanRoots) {
    const discovered = await collectSourceFiles(rootDir, scanRoot);
    files.push(...discovered);
  }

  const uniqueFiles = Array.from(new Set(files)).sort();
  const results = [];

  for (const relativeFilePath of uniqueFiles) {
    const absolutePath = path.resolve(rootDir, relativeFilePath);
    const content = await fs.readFile(absolutePath, "utf8");
    const lines = countLines(content);
    results.push({
      file: relativeFilePath,
      lines
    });
  }

  results.sort((left, right) => {
    if (right.lines !== left.lines) {
      return right.lines - left.lines;
    }
    return left.file.localeCompare(right.file);
  });

  const violations = results.filter((entry) => entry.lines > maxLines);
  const maxObservedLines = results.length > 0 ? results[0].lines : 0;

  return {
    ok: violations.length === 0,
    threshold: maxLines,
    scannedRoots: scanRoots,
    scannedFileCount: results.length,
    maxObservedLines,
    violations,
    topFiles: results.slice(0, 10),
    timestamp: new Date().toISOString()
  };
}

async function main() {
  try {
    const report = await buildReport();
    console.log(JSON.stringify(report, null, 2));
    if (!report.ok) {
      process.exitCode = 1;
    }
  } catch (error) {
    console.error(
      JSON.stringify(
        {
          ok: false,
          code: "REPO_LOC_LINT_ERROR",
          message: error instanceof Error ? error.message : String(error),
          timestamp: new Date().toISOString()
        },
        null,
        2
      )
    );
    process.exitCode = 1;
  }
}

main();
