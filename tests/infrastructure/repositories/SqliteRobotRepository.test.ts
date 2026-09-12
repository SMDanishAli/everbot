import { mkdtempSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { AppDatabase } from '../../../src/infrastructure/db/Database';
import { MigrationRunner } from '../../../src/infrastructure/db/MigrationRunner';
import { InMemoryLogger } from '../../../src/infrastructure/logging/InMemoryLogger';
import { SqliteRobotRepository } from '../../../src/infrastructure/repositories/SqliteRobotRepository';
import { RobotSource } from '../../../src/domain/entities/Robot';

describe('SqliteRobotRepository', () => {
  let directory: string;
  let database: AppDatabase;
  let logger: InMemoryLogger;

  beforeEach(() => {
    directory = mkdtempSync(join(tmpdir(), 'everbot-robots-'));
    database = new AppDatabase({
      path: join(directory, 'allocation.sqlite'),
      busyTimeoutMs: 5000,
      walMode: false,
    });
    logger = new InMemoryLogger();
    new MigrationRunner(database, logger).run();
  });

  afterEach(() => {
    database.close();
    rmSync(directory, { recursive: true, force: true });
  });

  function createRepository(): SqliteRobotRepository {
    return new SqliteRobotRepository(database, logger, [
      { type: 'Bravo', source: 'ACTIVE', count: 2 },
      { type: 'Bravo', source: 'STANDBY', count: 1 },
    ]);
  }

  it('loads inventory in memory and returns defensive copies', async () => {
    const repository = createRepository();
    const inventory = await repository.getInventory();
    inventory[0].available = 0;

    expect((await repository.getInventory())[0].available).toBe(2);
    expect((await repository.getAvailableInventory())[0].available).toBe(2);
  });

  it('starts with an empty inventory when no configuration is provided', async () => {
    const repository = new SqliteRobotRepository(database, logger);

    expect(await repository.getInventory()).toEqual([]);
  });

  it('re-reads today’s allocation history for each availability query', async () => {
    database.connection
      .prepare(
        `INSERT INTO allocation_history
          (allocation_id, hours_requested, strategy_name, type, source, total_hours_provided, total_cost)
         VALUES (1, 3, 'test', 'Bravo', 'ACTIVE', 3, 2)`,
      )
      .run();
    const repository = createRepository();

    expect(await repository.getAvailableInventory()).toEqual([
      { type: 'Bravo', source: RobotSource.ACTIVE, available: 1 },
      { type: 'Bravo', source: RobotSource.STANDBY, available: 1 },
    ]);

    database.connection.prepare('DELETE FROM allocation_history').run();
    expect(await repository.getAvailableInventory()).toEqual([
      { type: 'Bravo', source: RobotSource.ACTIVE, available: 2 },
      { type: 'Bravo', source: RobotSource.STANDBY, available: 1 },
    ]);
  });

  it('allocates available robots atomically', async () => {
    const repository = createRepository();

    await repository.allocate([{ type: 'Bravo', source: RobotSource.ACTIVE, count: 1 }]);

    expect((await repository.getInventory())[0].available).toBe(1);
  });

  it('allows zero-count selections for unknown inventory rows', async () => {
    const repository = createRepository();

    await expect(
      repository.allocate([{ type: 'Unknown', source: RobotSource.ACTIVE, count: 0 }]),
    ).resolves.toBeUndefined();
  });

  it('rejects allocations that exceed availability and logs the failure', async () => {
    const repository = createRepository();

    await expect(
      repository.allocate([{ type: 'Bravo', source: RobotSource.ACTIVE, count: 3 }]),
    ).rejects.toThrow('Requested 3 Bravo (ACTIVE) robots but only 2 available.');
    expect(logger.entries.at(-1)).toMatchObject({
      level: 'error',
      message: 'Robot allocation transaction failed',
    });
  });
});
