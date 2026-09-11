import { ClientRequest } from '../domain/entities/ClientRequest';
import { InvalidInputError } from '../domain/errors';

/**
 * Parses raw client-hours input (single value, or comma/space-separated list
 * for multi-client mode) into ClientRequest entities.
 *
 * TODO (TDD): implement to satisfy tests/parsers/ClientHoursParser.test.ts,
 * covering: single value, comma-separated, space-separated, mixed whitespace,
 * empty input, non-numeric tokens, negative/zero values.
 */
export class ClientHoursParser {
  static parse(_raw: string): ClientRequest[] {
    throw new InvalidInputError('Not implemented — write a failing test first.');
  }
}
