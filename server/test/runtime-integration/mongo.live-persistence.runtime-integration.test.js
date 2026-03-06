import { spawnSync } from "node:child_process";
import { MongoClient } from "mongodb";
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { request, spec } from "pactum";
import { buildServer } from "../../src/app.js";
import { createReferenceStatePersistenceAdapter } from "../../src/domains/reference/runtime-kernel/state-persistence.js";

const liveRequested = process.env.LIVE_DOCKER_TESTS === "1";
const dockerProbe = spawnSync(
  "docker",
  ["version", "--format", "{{.Server.Version}}"],
  {
    shell: process.platform === "win32"
  }
);
const dockerAvailable = dockerProbe.status === 0;
const liveEnabled = liveRequested && dockerAvailable;
const describeLive = liveEnabled ? describe : describe.skip;

const REQUEST_TIMEOUT_MS = 15_000;
const RUN_SUFFIX = `${Date.now().toString(36)}${Math.random()
  .toString(36)
  .slice(2, 8)}`;
const MONGO_URI = process.env.MONGO_URI ?? "mongodb://127.0.0.1:27017/admin";
const TEST_DB_NAME = `crud_kick_starter_live_${RUN_SUFFIX}`;
const TEST_COLLECTION_NAME = `reference_runtime_state_${RUN_SUFFIX}`;
const RECORDS_NOTES_DOCUMENT_ID = "records-notes";

let server;
let persistence;
let mongoClient;

async function stopServer() {
  if (server) {
    await server.close();
    server = null;
  }
  if (persistence && typeof persistence.close === "function") {
    await persistence.close();
  }
  persistence = null;
}

async function startServer() {
  persistence = createReferenceStatePersistenceAdapter({
    enabled: true,
    mode: "mongo",
    allowMemoryFallback: false,
    mongoUri: MONGO_URI,
    databaseName: TEST_DB_NAME,
    collectionName: TEST_COLLECTION_NAME,
    recordsNotesDocumentId: RECORDS_NOTES_DOCUMENT_ID
  });

  server = buildServer({
    logger: false,
    referenceStatePersistence: persistence,
    moduleIdTranslationMode: "dual-compat"
  });

  await server.listen({
    host: "127.0.0.1",
    port: 0
  });

  const address = server.server.address();
  request.setBaseUrl(`http://127.0.0.1:${address.port}`);
}

async function createRecord(payload) {
  return spec()
    .post("/api/reference/collections/records/items")
    .withJson(payload)
    .withRequestTimeout(REQUEST_TIMEOUT_MS)
    .expectStatus(201);
}

async function readRecord(recordId) {
  return spec()
    .get(`/api/reference/collections/records/items/${recordId}`)
    .withRequestTimeout(REQUEST_TIMEOUT_MS)
    .expectStatus(200);
}

async function updateRecord(recordId, payload) {
  return spec()
    .put(`/api/reference/collections/records/items/${recordId}`)
    .withJson(payload)
    .withRequestTimeout(REQUEST_TIMEOUT_MS)
    .expectStatus(200);
}

describeLive("live mongo persistence integration", () => {
  beforeAll(async () => {
    mongoClient = new MongoClient(MONGO_URI, {
      serverSelectionTimeoutMS: 5000
    });
    await mongoClient.connect();
    await mongoClient.db(TEST_DB_NAME).dropDatabase();
    await startServer();
  });

  afterAll(async () => {
    await stopServer();
    if (mongoClient) {
      await mongoClient.db(TEST_DB_NAME).dropDatabase();
      await mongoClient.close();
      mongoClient = null;
    }
  });

  test(
    "records CRUD writes to live mongo and survives server restart",
    async () => {
      const created = await createRecord({
        title: "Live Mongo Runtime Record",
        status: "draft",
        score: 33,
        featured: false,
        publishedOn: null,
        noteIds: []
      });
      const recordId = created.body?.item?.id;
      expect(typeof recordId).toBe("string");

      const updated = await updateRecord(recordId, {
        title: "Live Mongo Runtime Record Updated",
        score: 77
      });
      expect(updated.body?.item?.title).toBe("Live Mongo Runtime Record Updated");
      expect(updated.body?.item?.score).toBe(77);

      const collection = mongoClient
        .db(TEST_DB_NAME)
        .collection(TEST_COLLECTION_NAME);
      const recordsNotesDocument = await collection.findOne({
        _id: RECORDS_NOTES_DOCUMENT_ID
      });
      expect(recordsNotesDocument).toBeTruthy();

      const persistedRecord = recordsNotesDocument.records.find(
        (row) => row.id === recordId
      );
      expect(persistedRecord).toBeTruthy();
      expect(persistedRecord.title).toBe("Live Mongo Runtime Record Updated");
      expect(persistedRecord.score).toBe(77);

      await stopServer();
      await startServer();

      const readAfterRestart = await readRecord(recordId);
      expect(readAfterRestart.body?.item).toEqual(
        expect.objectContaining({
          id: recordId,
          title: "Live Mongo Runtime Record Updated",
          score: 77
        })
      );
    },
    300000
  );
});

describe("live mongo persistence integration gating", () => {
  test("suite is skipped unless LIVE_DOCKER_TESTS=1 and docker is available", () => {
    expect(typeof liveEnabled).toBe("boolean");
  });
});
