import { DomainError } from '../../domain/errors';

export class ErrorFormatter {
  static format(err: unknown): string {
    if (err instanceof DomainError) {
      return `Error: ${err.message}`;
    }
    return 'An unexpected error occurred. Check the logs for details.';
  }
}
