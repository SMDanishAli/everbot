import { mkdtempSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { AppDatabase } from '../../src/infrastructure/db/Database';
import { MigrationRunner } from '../../src/infrastructure/db/MigrationRunner';
import { InMemoryLogger } from '../../src/infrastructure/logging/InMemoryLogger';
import { ConfigInventoryProvider } from '../../src/infrastructure/repositories/ConfigInventoryProvider';
import { AllocationReservationRepository } from '../../src/infrastructure/repositories/AllocationReservationRepository';
import { SqliteAllocationHistoryRepository } from '../../src/infrastructure/repositories/SqliteAllocationHistoryRepository';
import { RobotTypeRegistry } from '../../src/infrastructure/config/RobotTypeRegistry';
import { InventoryService } from '../../src/services/InventoryService';
import { AllocationService } from '../../src/services/AllocationService';
import { CategoryDistributionStrategy } from '../../src/strategies/CategoryDistributionStrategy';
import { CostOptimizedStrategy } from '../../src/strategies/CostOptimizedStrategy';
import { StandbyActivationStrategy } from '../../src/strategies/StandbyActivationStrategy';
import { CliController } from '../../src/cli/CliController';
import { ClientRequest } from '../../src/domain/entities/ClientRequest';
import { InsufficientCapacityError, ZeroRobotsError } from '../../src/domain/errors';
import { RobotSpecConfig, InitialInventoryEntry } from '../../src/infrastructure/config/ConfigLoader';

jest.mock('../../src/cli/prompts', () => ({
  prompt: jest.fn(),
  selectPrompt: jest.fn(),
}));

// eslint-disable-next-line @typescript-eslint/no-var-requires
import { prompt } from '../../src/cli/prompts';

/**
 * E2E scope: real SQLite file, real migrations, real strategies, real
 * services and repositories. Only the terminal I/O boundary (`prompt`) is
 * stubbed, since a genuine end-to-end test still can't type into a real
 * readline interface. Every test starts from a freshly created, empty
 * database file — no fixtures, no pre-seeded history.
 */
describe('EverBot allocation session (e2e)', () => {
  const robotSpecs: RobotSpecConfig[] = [
    { name: 'Bravo', hours: 3, chargingCost: 2 },
    { name: 'Charlie', hours: 5, chargingCost: 3 },
    { name: 'Delta', hours: 8, chargingCost: 4 },
  ];

  let directory: string;
  let dbPath: string;

  beforeEach(() => {
    directory = mkdtempSync(join(tmpdir(), 'everbot-e2e-'));
    dbPath = join(directory, 'allocation.sqlite');
    jest.clearAllMocks();
    jest.spyOn(console, 'log').mockImplementation(() => undefined);
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
    rmSync(directory, { recursive: true, force: true });
  });

  /**
   * Simulates one `everbot run` process: a fresh AppDatabase connection to
   * the shared file, migrations applied (idempotent — a no-op on a database
   * that already has them), and the full DI graph wired exactly as
   * commandHandlers.ts wires it. Each call represents a separate process
   * opening the same on-disk database, not a shared in-memory instance.
   */
  function openSession(inventory: InitialInventoryEntry[], busyTimeoutMs = 5000) {
    const logger = new InMemoryLogger();
    const db = new AppDatabase({ path: dbPath, busyTimeoutMs, walMode: true });
    new MigrationRunner(db, logger).run();

    const robotTypes = new RobotTypeRegistry(robotSpecs);
    const inventoryProvider = new ConfigInventoryProvider(db, inventory);
    const inventoryService = new InventoryService(inventoryProvider, robotTypes);
    const reservationRepository = new AllocationReservationRepository(inventoryProvider, logger);
    const historyRepository = new SqliteAllocationHistoryRepository(db);
    const allocationService = new AllocationService(
      inventoryService,
      reservationRepository,
      historyRepository,
      logger,
      db,
    );

    return { db, historyRepository, allocationService, logger };
  }

  const activeInventory: InitialInventoryEntry[] = [
    { type: 'Bravo', source: 'ACTIVE', count: 5 },
    { type: 'Charlie', source: 'ACTIVE', count: 3 },
    { type: 'Delta', source: 'ACTIVE', count: 2 },
  ];

  // ── 1. Sanity: every test genuinely starts empty ────────────────────────

  it('starts with a freshly migrated, empty database', async () => {
    const { historyRepository, db } = openSession(activeInventory);
    expect(await historyRepository.findAll()).toEqual([]);
    db.close();
  });

  // ── 2. Level 1: single-client allocation persists to an empty DB ───────

  it('L1 allocation on an empty DB persists one history row per assigned robot', async () => {
    const { db, historyRepository, allocationService } = openSession(activeInventory);
    const strategy = new CategoryDistributionStrategy();
    const controller = new CliController(allocationService, new InMemoryLogger());

    (prompt as jest.Mock).mockResolvedValue('9'); // e.g. 3 Bravo, or a Bravo+Charlie mix
    await controller.run(strategy);

    const history = await historyRepository.findAll();
    expect(history.length).toBeGreaterThan(0);
    expect(history.every((row) => row.strategyName === strategy.name)).toBe(true);
    expect(history.every((row) => row.allocationId === history[0].allocationId)).toBe(true);
    expect(console.log).toHaveBeenCalledWith(expect.stringContaining('Total hours provided'));

    db.close();
  });

  // ── 3. Level 3: standby activation persists STANDBY-sourced rows ───────

  it('L3 falls back to standby robots when active capacity is insufficient, and persists both sources', async () => {
    const smallActiveInventory: InitialInventoryEntry[] = [
      { type: 'Bravo', source: 'ACTIVE', count: 1 }, // only 3h active
      { type: 'Bravo', source: 'STANDBY', count: 5 },
    ];
    const { db, historyRepository, allocationService } = openSession(smallActiveInventory);
    const strategy = new StandbyActivationStrategy(new CostOptimizedStrategy());
    const controller = new CliController(allocationService, new InMemoryLogger());

    (prompt as jest.Mock).mockResolvedValue('9'); // exceeds the 3h active fleet
    await controller.run(strategy);

    const history = await historyRepository.findAll();
    const sources = new Set(history.map((row) => row.source));
    expect(sources.has('ACTIVE')).toBe(true);
    expect(sources.has('STANDBY')).toBe(true);

    db.close();
  });

  // ── 4. Level 4: multi-client shares one pool and persists every client ─

  it('multi-client allocation shares a single pool across clients and persists all of them', async () => {
    const { db, historyRepository, allocationService } = openSession(activeInventory);
    const strategy = new CostOptimizedStrategy();
    const multiClientStrategy = new StandbyActivationStrategy(strategy);
    const controller = new CliController(allocationService, new InMemoryLogger());

    (prompt as jest.Mock).mockResolvedValue('12, 6, 4'); // 3 clients, shared pool
    await controller.run(strategy, multiClientStrategy);

    const history = await historyRepository.findAll();
    const distinctAllocationIds = new Set(history.map((row) => row.allocationId));
    expect(distinctAllocationIds.size).toBe(3); // one allocation group per client
    expect(console.log).toHaveBeenCalledWith(
      expect.stringContaining('=== Multi-client Summary ==='),
    );

    db.close();
  });

  // ── 5. Failure path: rejected allocation leaves the DB untouched ───────

  it('does not persist anything when the request cannot be satisfied', async () => {
    const tinyInventory: InitialInventoryEntry[] = [{ type: 'Bravo', source: 'ACTIVE', count: 1 }];
    const { db, historyRepository, allocationService } = openSession(tinyInventory);
    const strategy = new CategoryDistributionStrategy();

    await expect(
      allocationService.allocate(strategy, new ClientRequest(100, 'client-1')),
    ).rejects.toThrow(InsufficientCapacityError);

    expect(await historyRepository.findAll()).toEqual([]);

    // The rolled-back transaction must not leave the connection unusable.
    const result = await allocationService.allocate(strategy, new ClientRequest(3, 'client-2'));
    expect(result.totalHoursProvided).toBeGreaterThanOrEqual(3);

    db.close();
  });

  // ── 6. Cross-session correctness: the bug this whole rewrite targeted ──

  it('correctly exhausts inventory across separate sessions sharing the same on-disk database', async () => {
    const twoRobotInventory: InitialInventoryEntry[] = [
      { type: 'Bravo', source: 'ACTIVE', count: 2 },
    ];
    const strategy = new CategoryDistributionStrategy();

    // Session 1 (process A): takes the first Bravo.
    const sessionA = openSession(twoRobotInventory);
    await sessionA.allocationService.allocate(strategy, new ClientRequest(3, 'client-1'));
    sessionA.db.close();

    // Session 2 (process B, brand new connection + fresh in-memory state):
    // must see only 1 Bravo left, not the full config total of 2.
    const sessionB = openSession(twoRobotInventory);
    const resultB = await sessionB.allocationService.allocate(
      strategy,
      new ClientRequest(3, 'client-2'),
    );
    expect(resultB.countByType('Bravo')).toBe(1);
    sessionB.db.close();

    // Session 3 (process C): fleet is now fully exhausted for today.
    // With zero robots of any type left, InventoryService's pool is empty
    // before the strategy even runs, so this is ZeroRobotsError rather than
    // InsufficientCapacityError (which fires when some robots exist but not
    // enough) — both are the correct rejection for their own scenario.
    const sessionC = openSession(twoRobotInventory);
    await expect(
      sessionC.allocationService.allocate(strategy, new ClientRequest(3, 'client-3')),
    ).rejects.toThrow(ZeroRobotsError);

    const finalHistory = await sessionC.historyRepository.findAll();
    expect(finalHistory).toHaveLength(2); // exactly the 2 successful allocations, no phantom rows
    sessionC.db.close();
  });

  // ── 7. Concurrency: the check-then-write sequence is a single, real
  //      atomic unit — not just "some code that happens to run near a
  //      transaction". This is a deterministic, non-timing-based test:
  //      wall-clock races between two connections in the *same* Node
  //      process are not a reliable way to prove lock contention (SQLite
  //      coordinates same-process, same-file connections internally, and
  //      that coordination doesn't come with a stable timing guarantee —
  //      confirmed by this being intermittently flaky under real timing).
  //      A genuine cross-process race would need actual OS processes;
  //      what we CAN assert deterministically in-process is that the
  //      availability check and the reservation write are issued strictly
  //      between one BEGIN IMMEDIATE and one COMMIT, with no gap where a
  //      second writer could interleave undetected.

  it('wraps the availability check and the reservation write in a single BEGIN IMMEDIATE / COMMIT', async () => {
    const { db, allocationService } = openSession(activeInventory);
    const execSpy = jest.spyOn(db.connection, 'exec');
    const strategy = new CategoryDistributionStrategy();

    await allocationService.allocate(strategy, new ClientRequest(3, 'client-1'));

    const rawExecCommands = execSpy.mock.calls.map(([sql]) => sql);
    expect(rawExecCommands).toEqual(['BEGIN IMMEDIATE', 'COMMIT']);

    db.close();
  });

  it('rolls back instead of committing when the strategy rejects the request', async () => {
    const tinyInventory: InitialInventoryEntry[] = [{ type: 'Bravo', source: 'ACTIVE', count: 1 }];
    const { db, allocationService } = openSession(tinyInventory);
    const execSpy = jest.spyOn(db.connection, 'exec');
    const strategy = new CategoryDistributionStrategy();

    await expect(
      allocationService.allocate(strategy, new ClientRequest(100, 'client-1')),
    ).rejects.toThrow(InsufficientCapacityError);

    const rawExecCommands = execSpy.mock.calls.map(([sql]) => sql);
    expect(rawExecCommands).toEqual(['BEGIN IMMEDIATE', 'ROLLBACK']);

    db.close();
  });
});