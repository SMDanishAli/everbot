import { mkdtempSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { AppDatabase } from '../../../src/infrastructure/db/Database';
import { MigrationRunner } from '../../../src/infrastructure/db/MigrationRunner';
import { InMemoryLogger } from '../../../src/infrastructure/logging/InMemoryLogger';
import { ConfigInventoryProvider } from '../../../src/infrastructure/repositories/ConfigInventoryProvider';
import { RobotSource } from '../../../src/domain/entities/Robot';

describe('ConfigInventoryProvider', () => {
  let directory: string;
  let database: AppDatabase;

  beforeEach(() => {
    directory = mkdtempSync(join(tmpdir(), 'everbot-inventory-'));
    database = new AppDatabase({
      path: join(directory, 'allocation.sqlite'),
      busyTimeoutMs: 5000,
      walMode: false,
    });
    new MigrationRunner(database, new InMemoryLogger()).run();
  });

  afterEach(() => {
    database.close();
    rmSync(directory, { recursive: true, force: true });
  });

  const createProvider = () =>
    new ConfigInventoryProvider(database, [
      { type: 'Bravo', source: 'ACTIVE', count: 2 },
      { type: 'Bravo', source: 'STANDBY', count: 1 },
    ]);

  it('loads configured inventory and returns defensive copies', async () => {
    const provider = createProvider();
    const inventory = await provider.getInventory();
    inventory[0].available = 0;

    expect((await provider.getInventory())[0].available).toBe(2);
  });

  it('re-reads today’s allocation history for each availability query', async () => {
    database.connection
      .prepare(
        `INSERT INTO allocation_history
          (allocation_id, hours_requested, strategy_name, type, source, total_hours_provided, total_cost)
         VALUES (1, 3, 'test', 'Bravo', 'ACTIVE', 3, 2)`,
      )
      .run();
    const provider = createProvider();

    expect(await provider.getAvailableInventory()).toEqual([
      { type: 'Bravo', source: RobotSource.ACTIVE, available: 1 },
      { type: 'Bravo', source: RobotSource.STANDBY, available: 1 },
    ]);

    database.connection.prepare('DELETE FROM allocation_history').run();
    expect(await provider.getAvailableInventory()).toEqual([
      { type: 'Bravo', source: RobotSource.ACTIVE, available: 2 },
      { type: 'Bravo', source: RobotSource.STANDBY, available: 1 },
    ]);
  });

  it('defaults to an empty inventory when none is provided', async () => {
    const provider = new ConfigInventoryProvider(database);

    expect(await provider.getInventory()).toEqual([]);
    expect(await provider.getAvailableInventory()).toEqual([]);
  });
});
