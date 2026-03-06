import * as articlesViewEntrypoint from "../../ui/module-entrypoints/articles/view-entrypoint.jsx";
import * as dispatchesViewEntrypoint from "../../ui/module-entrypoints/dispatches/view-entrypoint.jsx";

const COMPAT_MODULE_VIEW_ENTRYPOINTS = Object.freeze({
  "../../../../modules/articles/frontend/view-entrypoint.jsx": articlesViewEntrypoint,
  "../../../../modules/dispatches/frontend/view-entrypoint.jsx": dispatchesViewEntrypoint
});

const DISCOVERED_MODULE_VIEW_ENTRYPOINTS = import.meta.glob(
  "../../../../modules/*/frontend/**/*.{js,mjs,jsx}",
  {
    eager: true
  }
);

const MODULE_VIEW_ENTRYPOINTS = {
  ...COMPAT_MODULE_VIEW_ENTRYPOINTS,
  ...DISCOVERED_MODULE_VIEW_ENTRYPOINTS
};

export { MODULE_VIEW_ENTRYPOINTS };
