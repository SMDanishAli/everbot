import { ClientHoursParser } from '../../src/parsers/ClientHoursParser';
import { InvalidInputError } from '../../src/domain/errors';

describe('ClientHoursParser', () => {
  it('parses a single client value', () => {
    expect(ClientHoursParser.parse('12')).toEqual([
      expect.objectContaining({ hoursRequested: 12, clientId: 'client-1' }),
    ]);
  });

  it.each(['12,4,8', '12 4 8', ' 12,  4  8 '])(
    'parses separated values from %s',
    (raw) => {
      expect(ClientHoursParser.parse(raw).map((request) => request.hoursRequested)).toEqual([
        12,
        4,
        8,
      ]);
    },
  );

  it('assigns generated client IDs in input order', () => {
    expect(ClientHoursParser.parse('5, 7').map((request) => request.clientId)).toEqual([
      'client-1',
      'client-2',
    ]);
  });

  it.each(['', '   ', ',', ' ,  '])('rejects empty input: %j', (raw) => {
    expect(() => ClientHoursParser.parse(raw)).toThrow(InvalidInputError);
    expect(() => ClientHoursParser.parse(raw)).toThrow(
      'At least one client work-hours value is required.',
    );
  });

  it.each(['abc', '1.5', '-2', '0', 'Infinity'])('rejects invalid value: %s', (raw) => {
    expect(() => ClientHoursParser.parse(raw)).toThrow(InvalidInputError);
    expect(() => ClientHoursParser.parse(raw)).toThrow(
      'Client 1 work hours must be a positive integer.',
    );
  });

  it('identifies the position of an invalid value', () => {
    expect(() => ClientHoursParser.parse('12,invalid,8')).toThrow(
      'Client 2 work hours must be a positive integer.',
    );
  });
});
