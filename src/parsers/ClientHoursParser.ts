import { ClientRequest } from '../domain/entities/ClientRequest';
import { InvalidInputError } from '../domain/errors';

/**
 * Parses raw client-hours input (single value, or comma/space-separated list
 * for multi-client mode) into ClientRequest entities.
 *
 */
export class ClientHoursParser {
  static parse(raw: string): ClientRequest[] {
    const tokens = raw.trim().split(/[,\s]+/).filter(Boolean);
    if (tokens.length === 0) {
      throw new InvalidInputError('At least one client work-hours value is required.');
    }

    return tokens.map((token, index) => {
      const hours = Number(token);
      if (!Number.isInteger(hours) || hours <= 0) {
        throw new InvalidInputError(
          `Client ${index + 1} work hours must be a positive integer.`,
        );
      }

      return new ClientRequest(hours, `client-${index + 1}`);
    });
  }
}
