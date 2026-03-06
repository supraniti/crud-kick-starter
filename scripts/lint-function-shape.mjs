import fs from "node:fs/promises";
import path from "node:path";
import { ESLint } from "eslint";

const DEFAULT_MAX_FUNCTION_LINES = 120;
const DEFAULT_MAX_COMPLEXITY = 20;
const DEFAULT_MAX_REPORT_ITEMS = 200;
const DEFAULT_SCAN_ROOTS = ["server/src", "frontend/src", "modules", "scripts"];
const SOURCE_FILE_PATTERN = /\.(js|mjs|jsx)$/i;
const SKIP_DIRS = new Set([".git", "node_modules", "dist", "coverage", "build"]);

function parsePositiveIntegerArg(argv, argPrefix, fallbackValue) {
  const arg = argv.find((value) => value.startsWith(argPrefix));
  if (!arg) {
    return fallbackValue;
  }

  const parsed = Number.parseInt(arg.slice(argPrefix.length), 10);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`Invalid ${argPrefix.slice(0, -1)} value: '${arg}'`);
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

function toRuleSummary(violations) {
  const byRule = new Map();
  const byFile = new Map();

  for (const violation of violations) {
    byRule.set(violation.ruleId, (byRule.get(violation.ruleId) ?? 0) + 1);
    byFile.set(violation.file, (byFile.get(violation.file) ?? 0) + 1);
  }

  return {
    byRule: Array.from(byRule.entries())
      .sort((left, right) => {
        if (right[1] !== left[1]) {
          return right[1] - left[1];
        }
        return left[0].localeCompare(right[0]);
      })
      .map(([ruleId, count]) => ({ ruleId, count })),
    byFileTop: Array.from(byFile.entries())
      .sort((left, right) => {
        if (right[1] !== left[1]) {
          return right[1] - left[1];
        }
        return left[0].localeCompare(right[0]);
      })
      .slice(0, 20)
      .map(([file, count]) => ({ file, count }))
  };
}

function parseRuleMetrics(ruleId, message) {
  const text = typeof message === "string" ? message : "";

  if (ruleId === "complexity") {
    const match = text.match(/complexity of (\d+)\. Maximum allowed is (\d+)/i);
    if (!match) {
      return { actual: null, limit: null, overBy: null };
    }
    const actual = Number.parseInt(match[1], 10);
    const limit = Number.parseInt(match[2], 10);
    if (!Number.isInteger(actual) || !Number.isInteger(limit)) {
      return { actual: null, limit: null, overBy: null };
    }
    return {
      actual,
      limit,
      overBy: Math.max(0, actual - limit)
    };
  }

  if (ruleId === "max-lines-per-function") {
    const match = text.match(/too many lines \((\d+)\)\. Maximum allowed is (\d+)/i);
    if (!match) {
      return { actual: null, limit: null, overBy: null };
    }
    const actual = Number.parseInt(match[1], 10);
    const limit = Number.parseInt(match[2], 10);
    if (!Number.isInteger(actual) || !Number.isInteger(limit)) {
      return { actual: null, limit: null, overBy: null };
    }
    return {
      actual,
      limit,
      overBy: Math.max(0, actual - limit)
    };
  }

  return { actual: null, limit: null, overBy: null };
}

function parseViolationSubject(message) {
  const text = typeof message === "string" ? message : "";
  const namedMatch = text.match(/^[A-Za-z ]*'([^']+)'/);
  if (namedMatch && namedMatch[1]) {
    return namedMatch[1];
  }

  const genericMatch = text.match(/^(Async arrow function|Arrow function|Async function|Function|Async method|Method)/i);
  if (genericMatch && genericMatch[1]) {
    return genericMatch[1];
  }

  return null;
}

async function buildReport() {
  const rootDir = process.cwd();
  const argv = process.argv.slice(2);
  const maxFunctionLines = parsePositiveIntegerArg(
    argv,
    "--max-function-lines=",
    DEFAULT_MAX_FUNCTION_LINES
  );
  const maxComplexity = parsePositiveIntegerArg(
    argv,
    "--max-complexity=",
    DEFAULT_MAX_COMPLEXITY
  );
  const maxReportItems = parsePositiveIntegerArg(
    argv,
    "--max-report-items=",
    DEFAULT_MAX_REPORT_ITEMS
  );
  const scanRoots = parseScanRootsArg(argv);
  const files = [];

  for (const scanRoot of scanRoots) {
    const discovered = await collectSourceFiles(rootDir, scanRoot);
    files.push(...discovered);
  }

  const uniqueFiles = Array.from(new Set(files)).sort();
  if (uniqueFiles.length === 0) {
    return {
      ok: true,
      threshold: {
        maxFunctionLines,
        maxComplexity
      },
      scannedRoots: scanRoots,
      scannedFileCount: 0,
      totalViolations: 0,
      violations: [],
      timestamp: new Date().toISOString()
    };
  }

  const eslint = new ESLint({
    ignore: false,
    overrideConfigFile: true,
    overrideConfig: {
      languageOptions: {
        ecmaVersion: "latest",
        sourceType: "module",
        parserOptions: {
          ecmaFeatures: {
            jsx: true
          }
        }
      },
      rules: {
        complexity: ["error", maxComplexity],
        "max-lines-per-function": [
          "error",
          {
            max: maxFunctionLines,
            skipBlankLines: true,
            skipComments: true,
            IIFEs: true
          }
        ]
      }
    }
  });

  const lintResults = await eslint.lintFiles(uniqueFiles.map((file) => path.resolve(rootDir, file)));
  const violations = [];

  for (const result of lintResults) {
    const relativeFilePath = path.relative(rootDir, result.filePath).replace(/\\/g, "/");
    for (const message of result.messages) {
      if (message.severity !== 2) {
        continue;
      }
      if (message.ruleId !== "complexity" && message.ruleId !== "max-lines-per-function") {
        continue;
      }

      const metrics = parseRuleMetrics(message.ruleId, message.message);

      violations.push({
        file: relativeFilePath,
        ruleId: message.ruleId,
        line: message.line ?? 0,
        column: message.column ?? 0,
        subject: parseViolationSubject(message.message),
        actual: metrics.actual,
        limit: metrics.limit,
        overBy: metrics.overBy,
        message: message.message
      });
    }
  }

  violations.sort((left, right) => {
    if (left.file !== right.file) {
      return left.file.localeCompare(right.file);
    }
    if (left.line !== right.line) {
      return left.line - right.line;
    }
    if (left.column !== right.column) {
      return left.column - right.column;
    }
    return left.ruleId.localeCompare(right.ruleId);
  });

  const summary = toRuleSummary(violations);

  return {
    ok: violations.length === 0,
    threshold: {
      maxFunctionLines,
      maxComplexity
    },
    scannedRoots: scanRoots,
    scannedFileCount: uniqueFiles.length,
    totalViolations: violations.length,
    reportedViolations: Math.min(violations.length, maxReportItems),
    reportTruncated: violations.length > maxReportItems,
    violationSummary: summary,
    violations: violations.slice(0, maxReportItems),
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
          code: "FUNCTION_SHAPE_LINT_ERROR",
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
