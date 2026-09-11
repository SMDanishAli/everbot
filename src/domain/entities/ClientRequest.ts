/**
 * A single client's work request, measured in total hours needed.
 * Spec constraint: client work hours must be a positive integer.
 */
export class ClientRequest {
  constructor(
    public readonly hoursRequested: number,
    public readonly clientId: string = 'default',
  ) {
    if (!Number.isInteger(hoursRequested) || hoursRequested <= 0) {
      throw new Error('Client work hours must be a positive integer.');
    }
  }
}
