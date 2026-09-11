import { InvalidInputError } from '../domain/errors';

/**
 * Pure validation functions, no I/O. Each throws InvalidInputError with a
 * spec-aligned message so the CLI layer can just catch-and-print.
 */
export class InputValidator {
  static assertPositiveInteger(value: number, label: string): void {
    if (!Number.isInteger(value) || value <= 0) {
      throw new InvalidInputError(`${label} must be a positive integer.`);
    }
  }

  static assertNonNegativeInteger(value: number, label: string): void {
    if (!Number.isInteger(value) || value < 0) {
      throw new InvalidInputError(`${label} must be a non-negative integer.`);
    }
  }
}
