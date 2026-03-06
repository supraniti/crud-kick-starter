import { ITER5_FIELD_TYPE_PLUGINS } from "../../../server/src/core/shared/capability-contracts/local-kernel/field-type-plugins/iter5-field-type-plugins.mjs";

const collectionFieldTypePlugins = Object.freeze([...ITER5_FIELD_TYPE_PLUGINS]);

export { collectionFieldTypePlugins };

export function registerCollectionFieldTypePlugins() {
  return collectionFieldTypePlugins;
}