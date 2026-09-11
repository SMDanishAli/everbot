import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import { AppDatabase } from './Database';
import { ILogger } from '../logging/ILogger';

/**
 * Runs every .sql file in migrations/ in filename order, once. Tracks what's
 * been applied in a small bookkeeping table so re-running the CLI doesn't
 * re-apply migrations.
 */
export class MigrationRunner {
  constructor(
    private readonly db: AppDatabase,
    private readonly logger: ILogger,
    private readonly migrationsDir: string = join(__dirname, 'migrations'),
  ) {}

  run(): void {
    this.db.connection.exec(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        name TEXT PRIMARY KEY,
        applied_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
      );
    `);

    const applied = new Set(
      this.db.connection
        .prepare('SELECT name FROM schema_migrations')
        .all()
        .map((row) => (row as { name: string }).name),
    );

    const files = readdirSync(this.migrationsDir)
      .filter((file) => file.endsWith('.sql'))
      .sort();

    for (const file of files) {
      if (applied.has(file)) continue;

      const sql = readFileSync(join(this.migrationsDir, file), 'utf-8');
      const applyMigration = this.db.connection.transaction(() => {
        this.db.connection.exec(sql);
        this.db.connection.prepare('INSERT INTO schema_migrations (name) VALUES (?)').run(file);
      });

      applyMigration();
      this.logger.info('Migration applied', { file });
    }
  }
}
