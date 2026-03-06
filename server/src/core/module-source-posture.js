import { execFile } from "node:child_process";
import path from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

function toPosixPath(inputPath) {
  return `${inputPath ?? ""}`.replace(/\\/g, "/");
}

function normalizePathForGitQuery({ repoRootDir, manifestPath }) {
  if (typeof repoRootDir !== "string" || repoRootDir.trim().length === 0) {
    return {
      ok: false,
      reason: "repo-root-missing"
    };
  }

  if (typeof manifestPath !== "string" || manifestPath.trim().length === 0) {
    return {
      ok: false,
      reason: "manifest-path-missing"
    };
  }

  const relativePath = path.relative(repoRootDir, manifestPath);
  if (relativePath.startsWith("..") || path.isAbsolute(relativePath)) {
    return {
      ok: false,
      reason: "manifest-outside-repo"
    };
  }

  return {
    ok: true,
    gitPath: toPosixPath(relativePath)
  };
}

export async function resolveModuleManifestTrackingStatus({
  repoRootDir,
  manifestPath
} = {}) {
  const normalizedPath = normalizePathForGitQuery({
    repoRootDir,
    manifestPath
  });

  if (!normalizedPath.ok) {
    return {
      tracking: "unknown",
      reason: normalizedPath.reason
    };
  }

  try {
    await execFileAsync(
      "git",
      ["-C", repoRootDir, "ls-files", "--error-unmatch", "--", normalizedPath.gitPath],
      {
        windowsHide: true
      }
    );

    return {
      tracking: "tracked",
      reason: "git-index"
    };
  } catch (error) {
    const diagnosticText = `${error?.stderr ?? ""}\n${error?.stdout ?? ""}\n${error?.message ?? ""}`
      .toLowerCase()
      .trim();

    if (
      diagnosticText.includes("did not match any file") ||
      diagnosticText.includes("did not match any files") ||
      diagnosticText.includes("pathspec")
    ) {
      return {
        tracking: "untracked",
        reason: "not-in-git-index"
      };
    }

    return {
      tracking: "unknown",
      reason: "git-query-failed",
      errorMessage: error?.message ?? "Failed to resolve module tracking state"
    };
  }
}

function normalizeTrackingResult(result) {
  if (!result || typeof result !== "object") {
    return {
      tracking: "unknown",
      reason: "unknown",
      errorMessage: null
    };
  }

  return {
    tracking:
      result.tracking === "tracked" ||
      result.tracking === "untracked" ||
      result.tracking === "unknown"
        ? result.tracking
        : "unknown",
    reason:
      typeof result.reason === "string" && result.reason.length > 0
        ? result.reason
        : "unknown",
    errorMessage:
      typeof result.errorMessage === "string" && result.errorMessage.length > 0
        ? result.errorMessage
        : null
  };
}

export function createModuleSourcePostureSummary({ repoRootDir } = {}) {
  const normalizedRepoRoot =
    typeof repoRootDir === "string" && repoRootDir.trim().length > 0
      ? repoRootDir
      : null;

  return {
    provider: normalizedRepoRoot ? "git-index" : "unavailable",
    repoRootDir: normalizedRepoRoot,
    trackedModuleIds: [],
    untrackedModuleIds: [],
    unknownModuleIds: [],
    warnings: []
  };
}

export function appendModuleSourceTracking(
  sourcePosture,
  {
    moduleId,
    manifestPath = null,
    moduleDir = null,
    tracking = "unknown",
    reason = "unknown",
    errorMessage = null
  } = {}
) {
  if (!sourcePosture || typeof moduleId !== "string" || moduleId.length === 0) {
    return;
  }

  if (tracking === "tracked") {
    sourcePosture.trackedModuleIds.push(moduleId);
    return;
  }

  if (tracking === "untracked") {
    sourcePosture.untrackedModuleIds.push(moduleId);
    sourcePosture.warnings.push({
      code: "MODULE_SOURCE_UNTRACKED",
      message: `Module '${moduleId}' manifest source is not tracked by git`,
      moduleId,
      moduleDir,
      manifestPath,
      reason
    });
    return;
  }

  sourcePosture.unknownModuleIds.push(moduleId);
  sourcePosture.warnings.push({
    code: "MODULE_SOURCE_TRACKING_UNKNOWN",
    message: `Module '${moduleId}' manifest source tracking could not be verified`,
    moduleId,
    moduleDir,
    manifestPath,
    reason,
    ...(typeof errorMessage === "string" && errorMessage.length > 0
      ? { errorMessage }
      : {})
  });
}

export async function resolveAndAppendModuleSourceTracking({
  resolveManifestTrackingStatus,
  sourcePosture,
  moduleId,
  moduleDir,
  manifestPath,
  modulesDir,
  repoRootDir,
  manifest
} = {}) {
  let trackingResult = {
    tracking: "unknown",
    reason: "tracking-not-evaluated",
    errorMessage: null
  };

  try {
    const resolvedTracking = await resolveManifestTrackingStatus({
      moduleId,
      moduleDir,
      manifestPath,
      modulesDir,
      repoRootDir,
      manifest
    });
    trackingResult = normalizeTrackingResult(resolvedTracking);
  } catch (error) {
    trackingResult = {
      tracking: "unknown",
      reason: "tracking-resolver-failed",
      errorMessage: error?.message ?? "Tracking resolver failed"
    };
  }

  appendModuleSourceTracking(sourcePosture, {
    moduleId,
    moduleDir,
    manifestPath,
    tracking: trackingResult.tracking,
    reason: trackingResult.reason,
    errorMessage: trackingResult.errorMessage
  });

  return {
    tracking: trackingResult.tracking,
    trackingReason: trackingResult.reason
  };
}

export function finalizeModuleSourcePostureSummary(sourcePosture) {
  const trackedModuleIds = [...new Set(sourcePosture?.trackedModuleIds ?? [])].sort();
  const untrackedModuleIds = [...new Set(sourcePosture?.untrackedModuleIds ?? [])].sort();
  const unknownModuleIds = [...new Set(sourcePosture?.unknownModuleIds ?? [])].sort();
  const warnings = Array.isArray(sourcePosture?.warnings)
    ? sourcePosture.warnings
    : [];

  return {
    provider:
      typeof sourcePosture?.provider === "string"
        ? sourcePosture.provider
        : "unavailable",
    repoRootDir: sourcePosture?.repoRootDir ?? null,
    trackedModuleIds,
    untrackedModuleIds,
    unknownModuleIds,
    hasUntrackedModules: untrackedModuleIds.length > 0,
    reproducible: untrackedModuleIds.length === 0 && unknownModuleIds.length === 0,
    warningCount: warnings.length,
    warnings
  };
}
