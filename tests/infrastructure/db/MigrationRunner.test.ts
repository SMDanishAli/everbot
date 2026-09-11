import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { AppDatabase } from '../../../src/infrastructure/db/Database';
import { MigrationRunner } from '../../../src/infrastructure/db/MigrationRunner';
import { InMemoryLogger } from '../../../src/infrastructure/logging/InMemoryLogger';

describe('MigrationRunner', () => {
  let directory: string;
  let database: AppDatabase;

  beforeEach(() => {
    directory = mkdtempSync(join(tmpdir(), 'everbot-migrations-'));
    database = new AppDatabase({
      path: join(directory, 'allocation.sqlite'),
      busyTimeoutMs: 5000,
      walMode: false,
    });
  });

  afterEach(() => {
    database.close();
    rmSync(directory, { recursive: true, force: true });
  });

  it('applies migrations and skips already-applied files on subsequent runs', () => {
    const migrations = join(directory, 'migrations');
    const logger = new InMemoryLogger();
    const runner = new MigrationRunner(database, logger, migrations);
    mkdirSync(migrations);
    writeFileSync(join(migrations, '002_second.sql'), 'CREATE TABLE second (value TEXT);');
    writeFileSync(join(migrations, '001_first.sql'), 'CREATE TABLE first (value TEXT);');
    writeFileSync(join(migrations, 'notes.txt'), 'ignored');

    runner.run();
    runner.run();

    expect(database.connection.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all())
      .toEqual(expect.arrayContaining([{ name: 'first' }, { name: 'second' }]));
    expect(logger.entries.filter((entry) => entry.message === 'Migration applied')).toHaveLength(2);
  });
});
