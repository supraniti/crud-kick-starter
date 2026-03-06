import { registerScaffolderProfileValidationRejectionsSuite } from "./scaffolder-profile.validation.rejections.core.test.js";
import { registerScaffolderProfileValidationObjectFormSuite } from "./scaffolder-profile.validation.object-form.core.test.js";
import { registerScaffolderProfileValidationDeterministicOutputSuite } from "./scaffolder-profile.validation.deterministic-output.core.test.js";

function registerScaffolderProfileValidationCoreSuite() {
  registerScaffolderProfileValidationRejectionsSuite();
  registerScaffolderProfileValidationObjectFormSuite();
  registerScaffolderProfileValidationDeterministicOutputSuite();
}

export { registerScaffolderProfileValidationCoreSuite };
