import { ClientRequest } from '../../../src/domain/entities/ClientRequest';
import { InvalidInputError } from '../../../src/domain/errors';

describe('ClientRequest', () => {
  it('stores hours and the default client ID', () => {
    expect(new ClientRequest(4)).toEqual(
      expect.objectContaining({ hoursRequested: 4, clientId: 'default' }),
    );
  });

  it('stores a supplied client ID', () => {
    expect(new ClientRequest(4, 'client-7').clientId).toBe('client-7');
  });

  it('uses InvalidInputError for zero hours', () => {
    expect(() => new ClientRequest(0)).toThrow(InvalidInputError);
  });

  it.each([[-1], [1.5], [Number.NaN], [Number.POSITIVE_INFINITY]])(
    'rejects invalid hours %p',
    (hours) => {
      expect(() => new ClientRequest(hours)).toThrow('Client work hours must be greater than 0');
    },
  );
});
