import Database from 'better-sqlite3';
import { mkdirSync } from 'fs';
import { dirname } from 'path';
import { DatabaseConfig } from '../config/ConfigLoader';

/**
 * Thin wrapper around better-sqlite3. WAL mode (toggled via config.database.walMode)
 * lets readers proceed concurrently with a writer; busy_timeout makes a blocked
 * writer wait and retry instead of throwing SQLITE_BUSY immediately — recommended
 * to keep both enabled if multiple CLI instances may run at the same time.
 */
export class AppDatabase {
  readonly connection: Database.Database;

  constructor(config: DatabaseConfig) {
    mkdirSync(dirname(config.path), { recursive: true });

    this.connection = new Database(config.path);
    if (config.walMode) {
      this.connection.pragma('journal_mode = WAL');
    }
    this.connection.pragma(`busy_timeout = ${config.busyTimeoutMs}`);
    this.connection.pragma('foreign_keys = ON');
  }

  close(): void {
    this.connection.close();
  }
}