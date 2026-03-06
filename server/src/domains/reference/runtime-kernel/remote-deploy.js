import fs from "node:fs/promises";
import path from "node:path";
import {
  normalizeRemoteKind as normalizeSharedRemoteKind,
  normalizeRemoteConfigInput,
  validateRemoteConfigInput
} from "../../../domains/reference/contracts/remote-config/remote-config-contract.js";
import { resolveNoteRow, resolveRecordRow } from "./collections.js";
import { buildTagsPayload, resolveProductRow } from "./products-taxonomies.js";

const JOB_LOG_LIMIT = 50;

export function normalizeRemoteKind(kind) {
  return normalizeSharedRemoteKind(kind);
}

export function normalizeRemoteInput(input) {
  return normalizeRemoteConfigInput(input, {
    partial: true
  });
}

export function validateRemoteInput(input, options = {}) {
  return validateRemoteConfigInput(input, options);
}

export function findRemoteById(state, remoteId) {
  return state.remotes.find((remote) => remote.id === remoteId) ?? null;
}

export function hasRemoteLabelConflict(state, label, excludeId = null) {
  const normalized = label.trim().toLowerCase();
  return state.remotes.some((remote) => {
    if (excludeId && remote.id === excludeId) {
      return false;
    }

    return remote.label.trim().toLowerCase() === normalized;
  });
}

export function nextRemoteId(state) {
  const id = `remote-${String(state.nextRemoteNumber).padStart(3, "0")}`;
  state.nextRemoteNumber += 1;
  return id;
}

export function buildRemotesPayload(state) {
  return [...state.remotes]
    .sort((a, b) => a.label.localeCompare(b.label))
    .map((remote) => ({
      ...remote
    }));
}

export function normalizeJobStatus(status) {
  if (status === "completed") {
    return "succeeded";
  }

  return status;
}

export function pushJobLog(logStore, jobId, level, message, context = {}) {
  const logs = logStore.get(jobId) ?? [];
  logs.push({
    timestamp: new Date().toISOString(),
    level,
    message,
    context
  });

  while (logs.length > JOB_LOG_LIMIT) {
    logs.shift();
  }

  logStore.set(jobId, logs);
}

export function toPublicJob(job, logStore) {
  if (!job) {
    return null;
  }

  return {
    ...job,
    status: normalizeJobStatus(job.status),
    logs: [...(logStore.get(job.id) ?? [])]
  };
}

export async function writeArtifact(filePath, contents) {
  await fs.writeFile(filePath, contents, "utf8");
  const stat = await fs.stat(filePath);
  return {
    path: filePath,
    bytes: stat.size
  };
}

export function buildReferenceHtml(snapshot, generatedAt, revision) {
  const productsMarkup = snapshot.products
    .map((row) => {
      const resolved = resolveProductRow(row, snapshot);
      const tags = resolved.tagLabels.join(", ");
      return `<li><strong>${resolved.name}</strong> (${resolved.categoryLabel}) - $${resolved.price} - Tags: ${tags}</li>`;
    })
    .join("");

  return [
    "<!doctype html>",
    "<html lang=\"en\">",
    "<head>",
    "  <meta charset=\"utf-8\" />",
    "  <title>Crud Control Reference Export</title>",
    "</head>",
    "<body>",
    `  <h1>Crud Control Reference Export - Revision ${revision}</h1>`,
    `  <p>Generated at ${generatedAt}</p>`,
    "  <ul>",
    `    ${productsMarkup}`,
    "  </ul>",
    "</body>",
    "</html>"
  ].join("\n");
}

export async function generateDeployArtifacts(snapshot, revision, outputRoot) {
  const revisionFolder = `rev-${String(revision).padStart(6, "0")}`;
  const outputDir = path.join(outputRoot, revisionFolder);
  const generatedAt = new Date().toISOString();

  await fs.rm(outputDir, {
    recursive: true,
    force: true
  });
  await fs.mkdir(outputDir, {
    recursive: true
  });

  const files = [];
  const productsPath = path.join(outputDir, "products.json");
  const categoriesPath = path.join(outputDir, "categories.json");
  const tagsPath = path.join(outputDir, "tags.json");
  const htmlPath = path.join(outputDir, "index.html");

  const resolvedProducts = snapshot.products.map((row) => resolveProductRow(row, snapshot));
  const tagsPayload = buildTagsPayload(snapshot);
  const recordsPayload = snapshot.records.map((row) => resolveRecordRow(row, snapshot));
  const notesPayload = snapshot.notes.map((row) => resolveNoteRow(row, snapshot));

  files.push({
    type: "json",
    ...(await writeArtifact(productsPath, JSON.stringify(resolvedProducts, null, 2)))
  });
  files.push({
    type: "json",
    ...(await writeArtifact(categoriesPath, JSON.stringify(snapshot.categories, null, 2)))
  });
  files.push({
    type: "json",
    ...(await writeArtifact(tagsPath, JSON.stringify(tagsPayload, null, 2)))
  });
  const recordsPath = path.join(outputDir, "records.json");
  files.push({
    type: "json",
    ...(await writeArtifact(recordsPath, JSON.stringify(recordsPayload, null, 2)))
  });
  const notesPath = path.join(outputDir, "notes.json");
  files.push({
    type: "json",
    ...(await writeArtifact(notesPath, JSON.stringify(notesPayload, null, 2)))
  });
  files.push({
    type: "html",
    ...(await writeArtifact(htmlPath, buildReferenceHtml(snapshot, generatedAt, revision)))
  });

  const manifest = {
    generatedAt,
    revision,
    outputDir,
    counts: {
      products: resolvedProducts.length,
      categories: snapshot.categories.length,
      tags: tagsPayload.length,
      records: recordsPayload.length,
      notes: notesPayload.length,
      files: files.length + 1
    },
    files
  };

  const manifestPath = path.join(outputDir, "manifest.json");
  const manifestFile = await writeArtifact(manifestPath, JSON.stringify(manifest, null, 2));
  files.push({
    type: "json",
    ...manifestFile
  });

  return {
    ...manifest,
    files
  };
}

export async function executeRemoteDeploy(remote, artifacts) {
  if (remote.kind === "filesystem") {
    return {
      mode: "filesystem",
      destination: remote.endpoint,
      status: "succeeded",
      artifactDir: artifacts.outputDir
    };
  }

  return {
    mode: "simulated-remote",
    destination: remote.endpoint,
    status: "succeeded",
    artifactDir: artifacts.outputDir
  };
}
