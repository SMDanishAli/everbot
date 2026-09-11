import { ErrorFormatter } from '../../../src/cli/formatters/ErrorFormatter';
import { InvalidInputError } from '../../../src/domain/errors';

describe('ErrorFormatter', () => {
  it('formats domain errors with their message', () => {
    expect(ErrorFormatter.format(new InvalidInputError('Invalid hours'))).toBe(
      'Error: Invalid hours',
    );
  });

  it('uses a generic message for unexpected errors', () => {
    expect(ErrorFormatter.format(new Error('unexpected'))).toBe(
      'An unexpected error occurred. Check the logs for details.',
    );
  });
});
