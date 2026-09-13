import { DomainError } from '../../domain/errors';

export class ErrorFormatter {
  static format(err: unknown): string {
    if (err instanceof DomainError) {
      return `Error: ${err.message}`;
    }
    else if (err instanceof Error) {
      return `Error: ${err.message}`;
    }
    else if (err instanceof String) {
      return `Error: ${err}`;
    }
    else {
      return 'An unexpected error occurred. Check the logs for details.';
    }

  }
}
