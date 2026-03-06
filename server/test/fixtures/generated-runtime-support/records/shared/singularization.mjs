function singularFromValue(value) {
  const trimmed = `${value}`.trim();
  if (trimmed.length === 0) {
    return trimmed;
  }

  const lower = trimmed.toLowerCase();
  if (lower === "news" || lower === "series" || lower === "species") {
    return trimmed;
  }

  if (lower.endsWith("ies") && trimmed.length > 3) {
    const preceding = lower.at(-4) ?? "";
    if ("aeiou".includes(preceding)) {
      return trimmed.slice(0, -1);
    }
    return `${trimmed.slice(0, -3)}y`;
  }

  if (/(ches|shes|xes|zes|sses|oes)$/i.test(lower) && trimmed.length > 2) {
    return trimmed.slice(0, -2);
  }

  if (lower.endsWith("s") && !lower.endsWith("ss") && trimmed.length > 1) {
    return trimmed.slice(0, -1);
  }

  return trimmed;
}

export { singularFromValue };
