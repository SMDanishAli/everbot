/**
 * Base class for all expected, logical (business-rule) errors.
 * These are distinct from unexpected system/infrastructure errors and are
 * logged at 'warn' level rather than 'error' (see infrastructure/logger.ts).
 */
export abstract class DomainError extends Error {
  abstract readonly code: string;

  constructor(message: string) {
    super(message);
    this.name = this.constructor.name;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}
