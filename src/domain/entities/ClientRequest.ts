import { InvalidInputError } from '../errors';

/**
 * A single client's work request, measured in total hours needed.
 * Spec constraint: client work hours must be a positive integer.
 */
export class ClientRequest {
  constructor(
    public readonly hoursRequested: number,
    public readonly clientId: string = 'default',
  ) {
    if (hoursRequested === 0) {
      throw new InvalidInputError('Work hours must be greater than 0.');
    }

    if (!Number.isInteger(hoursRequested) || hoursRequested <= 0) {
      throw new InvalidInputError('Client work hours must be greater than 0');
    }
  }
}
