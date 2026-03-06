import {
  BUILTIN_ROUTE_STATE_ADAPTERS_BY_MODULE_ID,
  COLLECTIONS_ROUTE_STATE_ADAPTER,
  DEFAULT_MODULE_ID,
  DEFAULT_ROUTE_STATE_ADAPTER,
  MODULE_VIEW_ENTRYPOINTS,
  PRODUCTS_ROUTE_STATE_ADAPTER,
  VIEW_REGISTRATION_CODES,
  normalizeRouteStateValue,
  setQueryParam
} from "./registration-primitives/parts/00-route-state-and-constants.js";
import {
  validateViewDescriptor
} from "./registration-primitives/parts/02-validate-view-descriptor.js";
import {
  createViewRegistry
} from "./registration-primitives/parts/03-create-view-registry.js";

export {
  BUILTIN_ROUTE_STATE_ADAPTERS_BY_MODULE_ID,
  COLLECTIONS_ROUTE_STATE_ADAPTER,
  DEFAULT_MODULE_ID,
  DEFAULT_ROUTE_STATE_ADAPTER,
  MODULE_VIEW_ENTRYPOINTS,
  PRODUCTS_ROUTE_STATE_ADAPTER,
  VIEW_REGISTRATION_CODES,
  createViewRegistry,
  normalizeRouteStateValue,
  setQueryParam,
  validateViewDescriptor
};
