function dedupeFieldDescriptors(descriptors = []) {
  const seen = new Set();
  const normalized = [];

  for (const descriptor of descriptors) {
    if (!descriptor || typeof descriptor !== "object") {
      continue;
    }
    if (typeof descriptor.id !== "string" || descriptor.id.length === 0) {
      continue;
    }
    if (seen.has(descriptor.id)) {
      continue;
    }
    seen.add(descriptor.id);
    normalized.push(descriptor);
  }

  return normalized;
}

export { dedupeFieldDescriptors };
