/**
 * Logging abstraction. Strategies, services, and CLI depend on this
 * interface only — never on pino directly — so implementations can be
 * swapped (or faked in tests) without touching consumer code.
 */
export interface ILogger {
  info(message: string, meta?: Record<string, unknown>): void;
  warn(message: string, meta?: Record<string, unknown>): void;
  error(message: string, meta?: Record<string, unknown>): void;
}
