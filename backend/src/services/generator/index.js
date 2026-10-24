/**
 * Test Generator domain services.
 * Controllers stay thin HTTP adapters; business logic lives here.
 *
 * Bank (catalog / syllabus / search / pick) lives under `./bank`.
 */

export * as bank from "./bank/index.js";
export * as paperService from "./paperService.js";
export * as activityService from "./activityService.js";
export * as subAccountService from "./subAccountService.js";
export { httpError } from "./httpError.js";
export {
  asQuestionRef,
  sectionMarks,
  paperOwnerFilter,
  normalizeSections,
  assertSectionsHaveMarks,
} from "./paperHelpers.js";
