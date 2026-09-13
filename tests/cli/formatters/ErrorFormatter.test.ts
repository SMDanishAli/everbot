import { ErrorFormatter } from '../../../src/cli/formatters/ErrorFormatter';
import { InvalidInputError } from '../../../src/domain/errors';

describe('ErrorFormatter', () => {
  it('formats domain errors with their message', () => {
    expect(ErrorFormatter.format(new InvalidInputError('Invalid hours'))).toBe(
      'Error: Invalid hours',
    );
  });

  it('formats a plain Error with its message', () => {
    expect(ErrorFormatter.format(new Error('unexpected'))).toBe('Error: unexpected');
  });

  it('formats a boxed String with its value', () => {
    // eslint-disable-next-line no-new-wrappers
    expect(ErrorFormatter.format(new String('boxed failure'))).toBe('Error: boxed failure');
  });

  it('uses a generic message for a thrown value that is neither an Error, DomainError, nor String', () => {
    expect(ErrorFormatter.format({ some: 'object' })).toBe(
      'An unexpected error occurred. Check the logs for details.',
    );
    expect(ErrorFormatter.format('plain string literal')).toBe(
      'An unexpected error occurred. Check the logs for details.',
    );
    expect(ErrorFormatter.format(undefined)).toBe(
      'An unexpected error occurred. Check the logs for details.',
    );
  });
});
