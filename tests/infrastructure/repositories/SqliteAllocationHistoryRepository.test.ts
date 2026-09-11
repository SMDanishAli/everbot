import { mkdtempSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { AppDatabase } from '../../../src/infrastructure/db/Database';
import { MigrationRunner } from '../../../src/infrastructure/db/MigrationRunner';
import { InMemoryLogger } from '../../../src/infrastructure/logging/InMemoryLogger';
import { SqliteAllocationHistoryRepository } from '../../../src/infrastructure/repositories/SqliteAllocationHistoryRepository';
import { AllocationResult } from '../../../src/domain/entities/AllocationResult';
import { Robot, RobotSource } from '../../../src/domain/entities/Robot';
import { RobotType } from '../../../src/domain/entities/RobotType';

describe('SqliteAllocationHistoryRepository', () => {
  let directory: string;
  let database: AppDatabase;
  let repository: SqliteAllocationHistoryRepository;

  beforeEach(() => {
    directory = mkdtempSync(join(tmpdir(), 'everbot-history-'));
    database = new AppDatabase({
      path: join(directory, 'allocation.sqlite'),
      busyTimeoutMs: 5000,
      walMode: false,
    });
    const logger = new InMemoryLogger();
    new MigrationRunner(database, logger).run();
    repository = new SqliteAllocationHistoryRepository(
      database,
    );
  });

  afterEach(() => {
    database.close();
    rmSync(directory, { recursive: true, force: true });
  });

  it('saves one row per robot and reconstructs grouped allocations', async () => {
    const bravo = new RobotType('Bravo', 3, 2);
    const result = new AllocationResult('client-1', 5, [
      new Robot(bravo, RobotSource.ACTIVE),
      new Robot(bravo, RobotSource.STANDBY),
    ]);

    await repository.save(result, 'Test strategy');

    const rows = database.connection
      .prepare('SELECT allocation_id, type, source FROM allocation_history')
      .all();
    expect(rows).toEqual([
      { allocation_id: 1, type: 'Bravo', source: 'ACTIVE' },
      { allocation_id: 1, type: 'Bravo', source: 'STANDBY' },
    ]);

  });

  it('clears allocation history', async () => {
    await repository.clear();
    const rows = database.connection.prepare('SELECT * FROM allocation_history').all();

    expect(rows).toEqual([]);
  });

  it('returns all history rows in reporting order', async () => {
    await repository.save(
      new AllocationResult('client-1', 3, [new Robot(new RobotType('Bravo', 3, 2))]),
      'Test strategy',
    );

    await expect(repository.findAll()).resolves.toEqual([
      expect.objectContaining({
        id: 1,
        allocationId: 1,
        hoursRequested: 3,
        strategyName: 'Test strategy',
        type: 'Bravo',
        source: RobotSource.ACTIVE,
        totalHoursProvided: 3,
        totalCost: 2,
        createdAt: expect.any(String),
      }),
    ]);
  });
});
