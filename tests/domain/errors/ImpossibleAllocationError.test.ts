import { ImpossibleAllocationError } from '../../../src/domain/errors/ImpossibleAllocationError';

describe('ImpossibleAllocationError', () => {
  it('uses the default message and error code', () => {
    const error = new ImpossibleAllocationError();

    expect(error.message).toContain('Unable to allocate');
    expect(error.code).toBe('IMPOSSIBLE_ALLOCATION');
  });

  it('accepts a custom message', () => {
    expect(new ImpossibleAllocationError('custom').message).toBe('custom');
  });
});
