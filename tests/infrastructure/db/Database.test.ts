import { existsSync, mkdtempSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { AppDatabase } from '../../../src/infrastructure/db/Database';

describe('AppDatabase', () => {
  let directory: string;

  beforeEach(() => {
    directory = mkdtempSync(join(tmpdir(), 'everbot-db-'));
  });

  afterEach(() => {
    rmSync(directory, { recursive: true, force: true });
  });

  it('creates the database directory, configures pragmas, and closes', () => {
    const path = join(directory, 'nested', 'allocation.sqlite');
    const database = new AppDatabase({
      path,
      busyTimeoutMs: 5000,
      walMode: true,
    });

    expect(existsSync(path)).toBe(true);
    expect(database.connection.pragma('foreign_keys', { simple: true })).toBe(1);
    expect(database.connection.pragma('busy_timeout', { simple: true })).toBe(5000);

    database.close();
    expect(() => database.connection.prepare('SELECT 1').get()).toThrow();
  });

  it('does not enable WAL when disabled', () => {
    const database = new AppDatabase({
      path: join(directory, 'allocation.sqlite'),
      busyTimeoutMs: 1000,
      walMode: false,
    });

    expect(database.connection.pragma('journal_mode', { simple: true })).toBe('delete');
    database.close();
  });
});
