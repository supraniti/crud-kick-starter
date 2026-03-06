function parseCliArgs(argv) {
  const input = {
    _unsupportedOptions: []
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") {
      input.help = true;
      continue;
    }

    if (arg === "--force") {
      input.force = true;
      continue;
    }

    if (arg === "--dry-run") {
      input.dryRun = true;
      continue;
    }

    const withValue = (key) => {
      const value = argv[index + 1];
      if (value === undefined || value.startsWith("--")) {
        input._unsupportedOptions.push(`${arg} (missing value)`);
        return;
      }
      input[key] = value;
      index += 1;
    };

    switch (arg) {
      case "--module-id":
        withValue("moduleId");
        break;
      case "--module-label":
        withValue("moduleLabel");
        break;
      case "--collection-id":
        withValue("collectionId");
        break;
      case "--collection-label":
        withValue("collectionLabel");
        break;
      case "--entity-singular":
        withValue("entitySingular");
        break;
      case "--icon":
        withValue("icon");
        break;
      case "--order":
        withValue("order");
        break;
      case "--id-prefix":
        withValue("idPrefix");
        break;
      case "--persistence-mode":
        withValue("persistenceMode");
        break;
      case "--target-dir":
        withValue("targetDir");
        break;
      default:
        input._unsupportedOptions.push(arg);
        break;
    }
  }

  return input;
}

export { parseCliArgs };
