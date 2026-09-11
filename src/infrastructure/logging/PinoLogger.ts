import pino, { Logger as PinoInstance } from 'pino';
import { mkdirSync } from 'fs';
import { join } from 'path';
import { ILogger } from './ILogger';
import { LoggingConfig } from '../config/ConfigLoader';

/**
 * Every log line carries an ISO timestamp automatically (pino.stdTimeFunctions.isoTime).
 * Writes to a rotating file (pino-roll, size + count bounded by config) and,
 * separately, a human-readable stream to the console.
 */
export class PinoLogger implements ILogger {
  private readonly logger: PinoInstance;

  constructor(config: LoggingConfig) {
    mkdirSync(config.directory, { recursive: true });
    (
      globalThis as typeof globalThis & {
        __bundlerPathsOverrides?: Record<string, string>;
      }
    ).__bundlerPathsOverrides = {
      'pino-worker': require.resolve('pino/lib/worker.js'),
      'pino-roll': require.resolve('pino-roll'),
      'pino-pretty': require.resolve('pino-pretty'),
    };

    this.logger = pino({
      level: config.level,
      timestamp: pino.stdTimeFunctions.isoTime,
      transport: {
        targets: [
          {
            target: 'pino-roll',
            options: {
              file: join(config.directory, config.fileName),
              size: `${config.maxSizeMb}m`,
              limit: { count: config.maxFiles },
            },
            level: config.level,
          },
          {
            target: 'pino-pretty',
            options: { colorize: true },
            level: config.level,
          },
        ],
      },
    });
  }

  info(message: string, meta: Record<string, unknown> = {}): void {
    this.logger.info(meta, message);
  }

  warn(message: string, meta: Record<string, unknown> = {}): void {
    this.logger.warn(meta, message);
  }

  error(message: string, meta: Record<string, unknown> = {}): void {
    this.logger.error(meta, message);
  }
}
