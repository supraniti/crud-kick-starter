import { MODERATION_PROFILE_FIELD_TYPE_PLUGINS } from "../../../server/src/core/shared/capability-contracts/local-kernel/field-type-plugins/moderation-profile-field-type-plugins.mjs";

const collectionFieldTypePlugins = Object.freeze([...MODERATION_PROFILE_FIELD_TYPE_PLUGINS]);

export { collectionFieldTypePlugins };

export function registerCollectionFieldTypePlugins() {
  return collectionFieldTypePlugins;
}
