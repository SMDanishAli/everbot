import { InputValidator } from '../../src/parsers/InputValidator';
import { InvalidInputError } from '../../src/domain/errors';

describe('InputValidator', () => {
  it('accepts positive integers', () => {
    expect(() => InputValidator.assertPositiveInteger(1, 'Hours')).not.toThrow();
    expect(() => InputValidator.assertPositiveInteger(100, 'Hours')).not.toThrow();
  });

  it.each([0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY])(
    'rejects non-positive integer %s',
    (value) => {
      expect(() => InputValidator.assertPositiveInteger(value, 'Hours')).toThrow(
        new InvalidInputError('Hours must be a positive integer.'),
      );
    },
  );

  it('accepts zero and positive integers as non-negative values', () => {
    expect(() => InputValidator.assertNonNegativeInteger(0, 'Count')).not.toThrow();
    expect(() => InputValidator.assertNonNegativeInteger(3, 'Count')).not.toThrow();
  });

  it.each([-1, 1.5, Number.NaN, Number.POSITIVE_INFINITY])(
    'rejects negative or non-integer value %s',
    (value) => {
      expect(() => InputValidator.assertNonNegativeInteger(value, 'Count')).toThrow(
        new InvalidInputError('Count must be a non-negative integer.'),
      );
    },
  );
});
