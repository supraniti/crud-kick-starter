const validManifest = {
  contractVersion: 1,
  id: "products",
  version: "1.0.0",
  name: "Products Module",
  capabilities: ["schema", "ui.route"],
  lifecycle: {
    install: "products.install",
    uninstall: "products.uninstall"
  }
};

export { validManifest };
