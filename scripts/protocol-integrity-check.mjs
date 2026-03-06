import fs from "node:fs";
import path from "node:path";

const CONTRACT_INDEX_FILE = "docs/contracts/contract-index.md";
const REQUIRED_CONTRACT_FILES = [
  CONTRACT_INDEX_FILE,
  "docs/contracts/delivery-scope-contract.md",
  "docs/contracts/quality-gate-contract.md"
];
const REQUIRED_ARTIFACT_FILES = [
  "docs/contracts/artifacts/server-lane-manifest-v1.json",
  "docs/contracts/artifacts/frontend-lane-manifest-v1.json",
  "docs/contracts/artifacts/module-id-alias-map-v1.json",
  "docs/contracts/artifacts/deterministic-replay-results.json"
];
const REQUIRED_FILES = [
  "handoff.md",
  ...REQUIRED_CONTRACT_FILES,
  ...REQUIRED_ARTIFACT_FILES
];
const POINTER_REQUIRED_FILES = [
  "docs/contracts/delivery-scope-contract.md",
  "docs/contracts/quality-gate-contract.md",
  ...REQUIRED_ARTIFACT_FILES
];
const TEXT_CHECKS = [
  {
    file: "handoff.md",
    pattern: "Active execution target",
    code: "HANDOFF_ACTIVE_TARGET_MISSING",
    message: "Handoff must include an active execution target."
  },
  {
    file: CONTRACT_INDEX_FILE,
    pattern: "Active Contracts",
    code: "CONTRACT_INDEX_ACTIVE_CONTRACTS_MISSING",
    message: "Contract index must include the Active Contracts section."
  }
];

function readText(filePath) {
  try {
    return fs.readFileSync(filePath, "utf8");
  } catch {
    return null;
  }
}

function parseBacktickedFilePaths(text) {
  if (!text) {
    return [];
  }
  const files = [];
  const matches = [...text.matchAll(/`([^`]+)`/g)];
  for (const match of matches) {
    const value = match[1].trim();
    if (!value.includes("/")) {
      continue;
    }
    if (!value.endsWith(".md") && !value.endsWith(".json")) {
      continue;
    }
    files.push(value);
  }
  return [...new Set(files)];
}

function run() {
  const root = process.cwd();
  const missingFiles = [];
  const failedTextChecks = [];
  const indexPath = path.resolve(root, CONTRACT_INDEX_FILE);
  const indexText = readText(indexPath) ?? "";
  const contractReferencedFiles = parseBacktickedFilePaths(indexText);

  for (const relPath of REQUIRED_FILES) {
    const absPath = path.resolve(root, relPath);
    if (!fs.existsSync(absPath)) {
      missingFiles.push(relPath);
    }
  }

  const missingContractPointers = POINTER_REQUIRED_FILES.filter(
    (relPath) => !contractReferencedFiles.includes(relPath)
  );

  for (const check of TEXT_CHECKS) {
    const absPath = path.resolve(root, check.file);
    const contents = readText(absPath);
    if (contents === null || !contents.includes(check.pattern)) {
      failedTextChecks.push({
        file: check.file,
        code: check.code,
        message: check.message
      });
    }
  }

  const ok =
    missingFiles.length === 0 &&
    failedTextChecks.length === 0 &&
    missingContractPointers.length === 0;
  const summary = {
    ok,
    checks: {
      requiredFiles: REQUIRED_FILES.length,
      textChecks: TEXT_CHECKS.length,
      contractPointerFiles: POINTER_REQUIRED_FILES.length
    },
    contractReferencedFiles,
    missingFiles,
    missingContractPointers,
    failedTextChecks,
    timestamp: new Date().toISOString()
  };

  console.log(JSON.stringify(summary, null, 2));

  if (!ok) {
    process.exitCode = 1;
  }
}

run();

