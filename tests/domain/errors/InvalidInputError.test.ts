import { InvalidInputError } from '../../../src/domain/errors/InvalidInputError';

describe('InvalidInputError', () => {
  it('uses the default message and error code', () => {
    const error = new InvalidInputError();

    expect(error.message).toBe('Work hours must be a positive integer.');
    expect(error.code).toBe('INVALID_INPUT');
  });

  it('accepts a custom message', () => {
    expect(new InvalidInputError('Invalid count').message).toBe('Invalid count');
  });
});
