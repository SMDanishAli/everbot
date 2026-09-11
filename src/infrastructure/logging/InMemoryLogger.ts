import { ILogger } from './ILogger';

interface LogEntry {
  level: 'info' | 'warn' | 'error';
  message: string;
  meta: Record<string, unknown>;
}

/** Test double for ILogger — captures entries in memory instead of writing to disk. */
export class InMemoryLogger implements ILogger {
  readonly entries: LogEntry[] = [];

  info(message: string, meta: Record<string, unknown> = {}): void {
    this.entries.push({ level: 'info', message, meta });
  }

  warn(message: string, meta: Record<string, unknown> = {}): void {
    this.entries.push({ level: 'warn', message, meta });
  }

  error(message: string, meta: Record<string, unknown> = {}): void {
    this.entries.push({ level: 'error', message, meta });
  }
}
