const mockInfo = jest.fn();
const mockWarn = jest.fn();
const mockError = jest.fn();
const mockPino = jest.fn((_options?: unknown) => ({
  info: mockInfo,
  warn: mockWarn,
  error: mockError,
}));

jest.mock('pino', () => {
  const pino = (options: unknown) => mockPino(options);
  pino.stdTimeFunctions = { isoTime: 'isoTime' };
  return { __esModule: true, default: pino };
});

import { existsSync, mkdtempSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { PinoLogger } from '../../../src/infrastructure/logging/PinoLogger';

describe('PinoLogger', () => {
  let directory: string;

  beforeEach(() => {
    directory = mkdtempSync(join(tmpdir(), 'everbot-logs-'));
    jest.clearAllMocks();
  });

  afterEach(() => {
    rmSync(directory, { recursive: true, force: true });
  });

  it('creates the log directory and configures pino transports', () => {
    const logger = new PinoLogger({
      level: 'debug',
      directory: join(directory, 'nested'),
      fileName: 'app.log',
      maxSizeMb: 5,
      maxFiles: 3,
    });

    expect(existsSync(join(directory, 'nested'))).toBe(true);
    expect(mockPino).toHaveBeenCalledWith(
      expect.objectContaining({
        level: 'debug',
        timestamp: 'isoTime',
        transport: expect.objectContaining({
          targets: expect.arrayContaining([
            expect.objectContaining({ target: 'pino-roll' }),
            expect.objectContaining({ target: 'pino-pretty' }),
          ]),
        }),
      }),
    );

    logger.info('started', { id: 1 });
    logger.warn('warning');
    logger.error('failed', { code: 'ERR' });
    logger.info('default metadata');
    logger.error('default metadata');
    expect(mockInfo).toHaveBeenCalledWith({ id: 1 }, 'started');
    expect(mockWarn).toHaveBeenCalledWith({}, 'warning');
    expect(mockError).toHaveBeenCalledWith({ code: 'ERR' }, 'failed');
  });
});
