import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, "..");

const SERVER_MANIFEST_PATH = path.join(
  ROOT_DIR,
  "docs",
  "contracts",
  "artifacts",
  "server-lane-manifest-v1.json"
);
const FRONTEND_MANIFEST_PATH = path.join(
  ROOT_DIR,
  "docs",
  "contracts",
  "artifacts",
  "frontend-lane-manifest-v1.json"
);

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function normalizeList(values) {
  return [...new Set(values.map((value) => String(value).trim()).filter(Boolean))].sort();
}

function loadPhase1Manifests() {
  const serverManifest = readJson(SERVER_MANIFEST_PATH);
  const frontendManifest = readJson(FRONTEND_MANIFEST_PATH);
  return {
    serverManifest,
    frontendManifest
  };
}

export function getConformanceFileList(target) {
  return getLaneFileList(target, "conformance");
}

export function getCoreFileList(target) {
  return getLaneFileList(target, "core");
}

export function getLaneFileList(target, laneGroup) {
  const { serverManifest, frontendManifest } = loadPhase1Manifests();
  const normalizedLaneGroup = String(laneGroup || "").trim();

  if (target === "server") {
    if (normalizedLaneGroup === "core") {
      return normalizeList(
        (serverManifest.entries || [])
          .filter((entry) => entry.lane === "core-fast")
          .map((entry) => entry.test_file_path)
      );
    }
    if (normalizedLaneGroup === "conformance") {
      return normalizeList(
        (serverManifest.entries || [])
          .filter((entry) => entry.lane === "module-conformance")
          .map((entry) => entry.test_file_path)
      );
    }
    if (normalizedLaneGroup === "runtime" || normalizedLaneGroup === "runtime-integration") {
      return normalizeList(
        (serverManifest.entries || [])
          .filter((entry) => entry.lane === "runtime-integration")
          .map((entry) => entry.test_file_path)
      );
    }
    throw new Error(
      `Unsupported lane group '${laneGroup}' for target '${target}'. Expected 'core', 'conformance', or 'runtime-integration'.`
    );
  }

  if (target === "frontend") {
    if (normalizedLaneGroup === "core") {
      return normalizeList(
        (frontendManifest.entries || [])
          .filter((entry) => entry.lane === "core-fast")
          .map((entry) => entry.test_file_path)
      );
    }
    if (normalizedLaneGroup === "conformance") {
      return normalizeList(
        (frontendManifest.entries || [])
          .filter((entry) => entry.lane === "frontend-conformance")
          .map((entry) => entry.test_file_path)
      );
    }
    if (normalizedLaneGroup === "integration") {
      return normalizeList(
        (frontendManifest.entries || [])
          .filter((entry) => entry.lane === "frontend-integration")
          .map((entry) => entry.test_file_path)
      );
    }
    throw new Error(
      `Unsupported lane group '${laneGroup}' for target '${target}'. Expected 'core', 'conformance', or 'integration'.`
    );
  }

  throw new Error(`Unsupported target '${target}'. Expected 'server' or 'frontend'.`);
}
