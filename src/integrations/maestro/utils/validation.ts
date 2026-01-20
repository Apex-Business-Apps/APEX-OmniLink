/**
 * JSON Schema Validation Utilities
 *
 * Validates MAESTRO data structures against JSON Schema 2020-12.
 * Client must validate before persisting locally or sending to server.
 */

import Ajv from 'ajv';
import addFormats from 'ajv-formats';

// Import JSON schemas
import canonicalEventSchema from '../schemas/canonical-event.schema.json';
import executionIntentSchema from '../schemas/execution-intent.schema.json';
import groundingResultSchema from '../schemas/grounding-result.schema.json';

/**
 * AJV instance (singleton)
 */
let ajvInstance: Ajv | null = null;

/**
 * Get or create AJV validator instance
 */
function getAjv(): Ajv {
  if (!ajvInstance) {
    ajvInstance = new Ajv({
      allErrors: true,
      strict: true,
      validateFormats: true,
    });

    // Add format validators (date-time, uuid, etc.)
    addFormats(ajvInstance);

    // Add schemas
    ajvInstance.addSchema(canonicalEventSchema, 'canonical-event');
    ajvInstance.addSchema(executionIntentSchema, 'execution-intent');
    ajvInstance.addSchema(groundingResultSchema, 'grounding-result');
  }

  return ajvInstance;
}

/**
 * Validation result
 */
export interface ValidationResult {
  valid: boolean;
  errors?: string[];
}

/**
 * Validate a canonical event
 */
export function validateCanonicalEvent(data: unknown): ValidationResult {
  const ajv = getAjv();
  const validate = ajv.getSchema('canonical-event');

  if (!validate) {
    return { valid: false, errors: ['Schema not found: canonical-event'] };
  }

  const valid = validate(data);

  if (!valid && validate.errors) {
    return {
      valid: false,
      errors: validate.errors.map(
        (err) => `${err.instancePath} ${err.message || 'validation error'}`
      ),
    };
  }

  return { valid: true };
}

/**
 * Validate an execution intent
 */
export function validateExecutionIntent(data: unknown): ValidationResult {
  const ajv = getAjv();
  const validate = ajv.getSchema('execution-intent');

  if (!validate) {
    return { valid: false, errors: ['Schema not found: execution-intent'] };
  }

  const valid = validate(data);

  if (!valid && validate.errors) {
    return {
      valid: false,
      errors: validate.errors.map(
        (err) => `${err.instancePath} ${err.message || 'validation error'}`
      ),
    };
  }

  return { valid: true };
}

/**
 * Validate a grounding result
 */
export function validateGroundingResult(data: unknown): ValidationResult {
  const ajv = getAjv();
  const validate = ajv.getSchema('grounding-result');

  if (!validate) {
    return { valid: false, errors: ['Schema not found: grounding-result'] };
  }

  const valid = validate(data);

  if (!valid && validate.errors) {
    return {
      valid: false,
      errors: validate.errors.map(
        (err) => `${err.instancePath} ${err.message || 'validation error'}`
      ),
    };
  }

  return { valid: true };
}

/**
 * Assert valid canonical event (throws on failure)
 */
export function assertValidCanonicalEvent(data: unknown): asserts data is object {
  const result = validateCanonicalEvent(data);
  if (!result.valid) {
    throw new Error(
      `Invalid CanonicalEvent: ${result.errors?.join(', ') || 'Unknown error'}`
    );
  }
}

/**
 * Assert valid execution intent (throws on failure)
 */
export function assertValidExecutionIntent(data: unknown): asserts data is object {
  const result = validateExecutionIntent(data);
  if (!result.valid) {
    throw new Error(
      `Invalid ExecutionIntent: ${result.errors?.join(', ') || 'Unknown error'}`
    );
  }
}

/**
 * Assert valid grounding result (throws on failure)
 */
export function assertValidGroundingResult(data: unknown): asserts data is object {
  const result = validateGroundingResult(data);
  if (!result.valid) {
    throw new Error(
      `Invalid GroundingResult: ${result.errors?.join(', ') || 'Unknown error'}`
    );
  }
}
