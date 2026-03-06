import { buildServer } from "../src/app.js";

async function callJson(baseUrl, path, method = "GET") {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      accept: "application/json"
    }
  });

  const body = await response.json();
  return {
    path,
    method,
    statusCode: response.status,
    body
  };
}

function isDockerUnavailable(result) {
  return (
    result.statusCode === 503 &&
    (result.body?.error?.code === "DOCKER_UNAVAILABLE" ||
      result.body?.status === "docker-unavailable")
  );
}

async function run() {
  const server = buildServer({ logger: false });
  await server.listen({
    host: "127.0.0.1",
    port: 0
  });

  const address = server.server.address();
  const baseUrl = `http://127.0.0.1:${address.port}`;

  const report = {
    timestamp: new Date().toISOString(),
    status: "unknown",
    results: []
  };

  try {
    const initialStatus = await callJson(
      baseUrl,
      "/api/infra/containers/mongo/status",
      "GET"
    );
    report.results.push(initialStatus);

    if (isDockerUnavailable(initialStatus)) {
      report.status = "blocked-docker-unavailable";
      console.log(JSON.stringify(report, null, 2));
      process.exitCode = 2;
      return;
    }

    const startResult = await callJson(
      baseUrl,
      "/api/infra/containers/mongo/start",
      "POST"
    );
    report.results.push(startResult);

    const checkResult = await callJson(baseUrl, "/api/infra/mongo/check", "GET");
    report.results.push(checkResult);

    const restartResult = await callJson(
      baseUrl,
      "/api/infra/containers/mongo/restart",
      "POST"
    );
    report.results.push(restartResult);

    const stopResult = await callJson(
      baseUrl,
      "/api/infra/containers/mongo/stop",
      "POST"
    );
    report.results.push(stopResult);

    report.status =
      checkResult.body?.status === "connected"
        ? "passed"
        : "partial-nonconnected";
    console.log(JSON.stringify(report, null, 2));
  } finally {
    await server.close();
  }
}

run().catch((error) => {
  const payload = {
    timestamp: new Date().toISOString(),
    status: "failed",
    error: {
      message: error?.message ?? "Unhandled live-check failure"
    }
  };

  console.log(JSON.stringify(payload, null, 2));
  process.exitCode = 1;
});
