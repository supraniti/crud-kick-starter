export function getSafeguardSeverity(decision) {
  if (decision === "require-confirmation") {
    return "warning";
  }

  if (decision === "deny") {
    return "error";
  }

  return "success";
}

