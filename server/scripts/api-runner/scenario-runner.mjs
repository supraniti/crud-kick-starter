import { isDeepStrictEqual } from "node:util";

function toPlainError(error) {
  return {
    code: error?.code ?? "API_RUNNER_ERROR",
    message: error?.message ?? "API runner step failed"
  };
}

function tokenizePath(path) {
  if (typeof path !== "string" || path.trim().length === 0) {
    return [];
  }

  const tokens = [];
  const pattern = /([^[.\]]+)|\[(\d+)\]/g;
  let match;
  while ((match = pattern.exec(path)) !== null) {
    if (match[1] !== undefined) {
      tokens.push(match[1]);
      continue;
    }
    tokens.push(Number.parseInt(match[2], 10));
  }

  return tokens;
}

export function resolvePath(source, path) {
  const tokens = tokenizePath(path);
  if (tokens.length === 0) {
    return source;
  }

  let current = source;
  for (const token of tokens) {
    if (current === null || current === undefined) {
      return undefined;
    }

    if (typeof token === "number") {
      if (!Array.isArray(current) || token < 0 || token >= current.length) {
        return undefined;
      }
      current = current[token];
      continue;
    }

    if (!Object.prototype.hasOwnProperty.call(current, token)) {
      return undefined;
    }
    current = current[token];
  }

  return current;
}

function resolveVariable(variables, variableName) {
  if (
    variableName &&
    Object.prototype.hasOwnProperty.call(variables, variableName)
  ) {
    return variables[variableName];
  }

  return resolvePath(variables, variableName);
}

function interpolateString(value, variables) {
  return value.replace(/\{\{\s*([^{}\s]+)\s*\}\}/g, (_, variableName) => {
    const resolved = resolveVariable(variables, variableName);
    if (resolved === undefined) {
      throw new Error(`Missing scenario variable '${variableName}'`);
    }

    if (resolved === null) {
      return "null";
    }

    if (
      typeof resolved === "string" ||
      typeof resolved === "number" ||
      typeof resolved === "boolean"
    ) {
      return `${resolved}`;
    }

    throw new Error(
      `Scenario variable '${variableName}' must be string/number/boolean/null for interpolation`
    );
  });
}

function resolveTemplateValue(value, variables) {
  if (typeof value === "string") {
    return interpolateString(value, variables);
  }

  if (Array.isArray(value)) {
    return value.map((item) => resolveTemplateValue(item, variables));
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, entryValue]) => [
        key,
        resolveTemplateValue(entryValue, variables)
      ])
    );
  }

  return value;
}

function containsPartial(actualValue, expectedValue) {
  if (
    expectedValue === null ||
    typeof expectedValue !== "object" ||
    Array.isArray(expectedValue) === false && typeof expectedValue !== "object"
  ) {
    return isDeepStrictEqual(actualValue, expectedValue);
  }

  if (Array.isArray(expectedValue)) {
    if (!Array.isArray(actualValue)) {
      return false;
    }

    for (const expectedItem of expectedValue) {
      const matched = actualValue.some((actualItem) =>
        containsPartial(actualItem, expectedItem)
      );
      if (!matched) {
        return false;
      }
    }

    return true;
  }

  if (!actualValue || typeof actualValue !== "object") {
    return false;
  }

  for (const [key, value] of Object.entries(expectedValue)) {
    if (!Object.prototype.hasOwnProperty.call(actualValue, key)) {
      return false;
    }
    if (!containsPartial(actualValue[key], value)) {
      return false;
    }
  }

  return true;
}

function validatePack(pack) {
  if (!pack || typeof pack !== "object") {
    throw new Error("Scenario pack must be an object");
  }

  if (pack.contractVersion !== 1) {
    throw new Error(
      `Unsupported scenario pack contract version '${pack.contractVersion}'`
    );
  }

  if (!Array.isArray(pack.scenarios) || pack.scenarios.length === 0) {
    throw new Error("Scenario pack must include at least one scenario");
  }

  const ids = new Set();
  for (const scenario of pack.scenarios) {
    if (!scenario || typeof scenario !== "object") {
      throw new Error("Scenario entries must be objects");
    }
    if (typeof scenario.id !== "string" || scenario.id.trim().length === 0) {
      throw new Error("Scenario id is required");
    }
    if (ids.has(scenario.id)) {
      throw new Error(`Scenario id '${scenario.id}' is duplicated`);
    }
    ids.add(scenario.id);
    if (!Array.isArray(scenario.steps) || scenario.steps.length === 0) {
      throw new Error(`Scenario '${scenario.id}' must include at least one step`);
    }
  }
}

async function fetchJsonResponse({
  fetchImpl,
  url,
  method,
  headers,
  body,
  timeoutMs
}) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    controller.abort();
  }, timeoutMs);

  try {
    const response = await fetchImpl(url, {
      method,
      headers,
      body,
      signal: controller.signal
    });
    const textBody = await response.text();
    let parsedBody = null;
    if (textBody.length > 0) {
      try {
        parsedBody = JSON.parse(textBody);
      } catch {
        parsedBody = textBody;
      }
    }

    return {
      status: response.status,
      headers: Object.fromEntries(response.headers.entries()),
      body: parsedBody
    };
  } finally {
    clearTimeout(timeoutId);
  }
}

function runAssertions({
  responseContext,
  assertions = {},
  variables
}) {
  const checks = [];

  if (assertions.status !== undefined) {
    const expectedStatus = assertions.status;
    const actualStatus = responseContext.status;
    if (actualStatus !== expectedStatus) {
      throw new Error(
        `Expected status ${expectedStatus}, received ${actualStatus}`
      );
    }
    checks.push(`status == ${expectedStatus}`);
  }

  const equalsChecks = Array.isArray(assertions.equals) ? assertions.equals : [];
  for (const assertion of equalsChecks) {
    const actual = resolvePath(responseContext, assertion.path);
    const expected =
      assertion.fromVar !== undefined
        ? resolveVariable(variables, assertion.fromVar)
        : assertion.value;

    if (!isDeepStrictEqual(actual, expected)) {
      throw new Error(
        `Expected '${assertion.path}' to equal ${JSON.stringify(
          expected
        )}, received ${JSON.stringify(actual)}`
      );
    }
    checks.push(`equals(${assertion.path})`);
  }

  const containsObjectChecks = Array.isArray(assertions.containsObject)
    ? assertions.containsObject
    : [];
  for (const assertion of containsObjectChecks) {
    const actual = resolvePath(responseContext, assertion.path);
    if (!Array.isArray(actual)) {
      throw new Error(
        `Expected '${assertion.path}' to resolve to an array for containsObject assertion`
      );
    }
    if (!actual.some((item) => containsPartial(item, assertion.value))) {
      throw new Error(
        `Expected '${assertion.path}' to contain matching object ${JSON.stringify(
          assertion.value
        )}`
      );
    }
    checks.push(`containsObject(${assertion.path})`);
  }

  const notContainsObjectChecks = Array.isArray(assertions.notContainsObject)
    ? assertions.notContainsObject
    : [];
  for (const assertion of notContainsObjectChecks) {
    const actual = resolvePath(responseContext, assertion.path);
    if (!Array.isArray(actual)) {
      throw new Error(
        `Expected '${assertion.path}' to resolve to an array for notContainsObject assertion`
      );
    }
    if (actual.some((item) => containsPartial(item, assertion.value))) {
      throw new Error(
        `Expected '${assertion.path}' not to contain object ${JSON.stringify(
          assertion.value
        )}`
      );
    }
    checks.push(`notContainsObject(${assertion.path})`);
  }

  return checks;
}

function applyCaptures({
  capture = {},
  responseContext,
  variables
}) {
  const captures = [];
  for (const [variableName, responsePath] of Object.entries(capture)) {
    const value = resolvePath(responseContext, responsePath);
    variables[variableName] = value;
    captures.push({
      variableName,
      responsePath,
      value
    });
  }

  return captures;
}

async function runStep({
  fetchImpl,
  baseUrl,
  scenarioId,
  step,
  variables,
  defaultTimeoutMs
}) {
  if (!step || typeof step !== "object") {
    throw new Error("Scenario step must be an object");
  }
  const request = step.request ?? {};
  const method =
    typeof request.method === "string" && request.method.length > 0
      ? request.method.toUpperCase()
      : "GET";
  const path = typeof request.path === "string" ? request.path : "";
  if (path.length === 0) {
    throw new Error(`Scenario '${scenarioId}' step '${step.id}' is missing request.path`);
  }

  const timeoutMs =
    Number.isInteger(step.timeoutMs) && step.timeoutMs > 0
      ? step.timeoutMs
      : defaultTimeoutMs;

  const resolvedPath = resolveTemplateValue(path, variables);
  const url = new URL(resolvedPath, baseUrl);
  const query = request.query ? resolveTemplateValue(request.query, variables) : null;
  if (query && typeof query === "object" && !Array.isArray(query)) {
    for (const [key, value] of Object.entries(query)) {
      if (value === null || value === undefined) {
        continue;
      }
      url.searchParams.set(key, `${value}`);
    }
  }

  const resolvedHeaders = request.headers
    ? resolveTemplateValue(request.headers, variables)
    : {};
  const headers = {
    accept: "application/json",
    ...resolvedHeaders
  };
  const resolvedBody =
    request.body !== undefined ? resolveTemplateValue(request.body, variables) : undefined;
  const body =
    resolvedBody !== undefined &&
    method !== "GET" &&
    method !== "HEAD" &&
    method !== "DELETE"
      ? JSON.stringify(resolvedBody)
      : undefined;
  if (body !== undefined && !Object.prototype.hasOwnProperty.call(headers, "content-type")) {
    headers["content-type"] = "application/json";
  }

  const startedAt = Date.now();
  const response = await fetchJsonResponse({
    fetchImpl,
    url,
    method,
    headers,
    body,
    timeoutMs
  });
  const responseContext = {
    status: response.status,
    headers: response.headers,
    body: response.body
  };

  const assertionChecks = runAssertions({
    responseContext,
    assertions: step.expect ?? {},
    variables
  });
  const captures = applyCaptures({
    capture: step.capture ?? {},
    responseContext,
    variables
  });

  return {
    id: step.id,
    description: step.description ?? "",
    ok: true,
    durationMs: Date.now() - startedAt,
    request: {
      method,
      url: url.toString(),
      query: query ?? undefined,
      body: resolvedBody
    },
    response: {
      status: response.status,
      body: response.body
    },
    assertions: assertionChecks,
    captures
  };
}

async function runScenario({
  fetchImpl,
  baseUrl,
  scenario,
  initialVariables,
  defaultTimeoutMs
}) {
  const startedAt = Date.now();
  const variables = {
    ...initialVariables
  };
  const steps = [];
  let failure = null;

  for (const step of scenario.steps) {
    try {
      const stepResult = await runStep({
        fetchImpl,
        baseUrl,
        scenarioId: scenario.id,
        step,
        variables,
        defaultTimeoutMs
      });
      steps.push(stepResult);
    } catch (error) {
      failure = toPlainError(error);
      steps.push({
        id: step?.id ?? "unknown-step",
        description: step?.description ?? "",
        ok: false,
        durationMs: 0,
        request: {
          method: step?.request?.method ?? "GET",
          path: step?.request?.path ?? ""
        },
        error: failure
      });
      break;
    }
  }

  return {
    id: scenario.id,
    description: scenario.description ?? "",
    ok: failure === null,
    durationMs: Date.now() - startedAt,
    steps,
    failure,
    variables
  };
}

export async function runScenarioPack({
  pack,
  baseUrl,
  fetchImpl = globalThis.fetch,
  initialVariables = {},
  defaultTimeoutMs = 5000
}) {
  if (typeof fetchImpl !== "function") {
    throw new Error("fetch implementation is required for scenario runner");
  }

  validatePack(pack);

  const startedAt = Date.now();
  const scenarios = [];

  for (const scenario of pack.scenarios) {
    const scenarioResult = await runScenario({
      fetchImpl,
      baseUrl,
      scenario,
      initialVariables,
      defaultTimeoutMs
    });
    scenarios.push(scenarioResult);
  }

  const failedScenario = scenarios.find((scenario) => !scenario.ok) ?? null;
  const summary = {
    ok: failedScenario === null,
    packId: pack.packId ?? "scenario-pack",
    contractVersion: pack.contractVersion,
    scenarioCount: scenarios.length,
    passedCount: scenarios.filter((scenario) => scenario.ok).length,
    failedCount: scenarios.filter((scenario) => !scenario.ok).length,
    durationMs: Date.now() - startedAt,
    failedScenarioId: failedScenario?.id ?? null,
    timestamp: new Date().toISOString()
  };

  return {
    ...summary,
    scenarios
  };
}

export function renderScenarioReportMarkdown(report) {
  const lines = [
    `# API Runner Report`,
    ``,
    `- Pack: \`${report.packId}\``,
    `- Result: ${report.ok ? "pass" : "fail"}`,
    `- Scenarios: ${report.passedCount}/${report.scenarioCount} passed`,
    `- Duration: ${report.durationMs}ms`,
    `- Timestamp: ${report.timestamp}`,
    ``
  ];

  for (const scenario of report.scenarios) {
    lines.push(`## Scenario: ${scenario.id}`);
    lines.push(`- Result: ${scenario.ok ? "pass" : "fail"}`);
    lines.push(`- Duration: ${scenario.durationMs}ms`);
    if (scenario.failure) {
      lines.push(`- Failure: [${scenario.failure.code}] ${scenario.failure.message}`);
    }
    lines.push(``);

    for (const step of scenario.steps) {
      lines.push(`### Step: ${step.id}`);
      lines.push(`- Result: ${step.ok ? "pass" : "fail"}`);
      if (step.request?.url) {
        lines.push(`- Request: \`${step.request.method} ${step.request.url}\``);
      } else {
        lines.push(`- Request: \`${step.request?.method ?? "GET"} ${step.request?.path ?? ""}\``);
      }
      if (step.response) {
        lines.push(`- Status: ${step.response.status}`);
      }
      if (Array.isArray(step.assertions) && step.assertions.length > 0) {
        lines.push(`- Assertions: ${step.assertions.join(", ")}`);
      }
      if (step.error) {
        lines.push(`- Error: [${step.error.code}] ${step.error.message}`);
      }
      lines.push(``);
    }
  }

  return `${lines.join("\n").trim()}\n`;
}
