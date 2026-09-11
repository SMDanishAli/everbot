import { RobotSource } from '../../src/domain/entities/Robot';

const mockConfig = {
  robots: [{ name: 'Bravo', hours: 3, chargingCost: 2 }],
  inventory: [{ type: 'Bravo', source: 'ACTIVE' as const, count: 2 }],
  logging: {
    level: 'info',
    directory: './logs',
    fileName: 'app.log',
    maxSizeMb: 5,
    maxFiles: 3,
  },
  database: { path: './data/test.sqlite', busyTimeoutMs: 5000, walMode: true },
};

const mockLoad = jest.fn(() => mockConfig);
const mockClose = jest.fn();
const mockMigrationRun = jest.fn();
const mockGetInventory = jest.fn();
const mockGetAvailableInventory = jest.fn();
const mockFindAll = jest.fn();
const mockGetAvailableRobots = jest.fn();
const mockClear = jest.fn();
const mockCliRun = jest.fn();
const mockSelectPrompt = jest.fn();
const mockInventoryFormat = jest.fn(() => 'formatted inventory');
const mockLogsFormat = jest.fn(() => 'formatted logs');
const mockPinoLogger = jest.fn();
const mockReaddirSync = jest.fn();
const mockReadFileSync = jest.fn();
const mockConnection = {
  prepare: jest.fn(),
  transaction: jest.fn(),
  exec: jest.fn(),
};

jest.mock('../../src/infrastructure/config/ConfigLoader', () => ({
  ConfigLoader: { load: mockLoad },
}));

jest.mock('../../src/infrastructure/logging/PinoLogger', () => ({
  PinoLogger: class {
    constructor(...args: unknown[]) {
      mockPinoLogger(...args);
    }
  },
}));

jest.mock('../../src/infrastructure/db/Database', () => ({
  AppDatabase: class {
    connection = mockConnection;
    close = mockClose;
  },
}));

jest.mock('../../src/infrastructure/db/MigrationRunner', () => ({
  MigrationRunner: class {
    run = mockMigrationRun;
  },
}));

jest.mock('../../src/infrastructure/repositories/SqliteRobotRepository', () => ({
  SqliteRobotRepository: class {
    getInventory = mockGetInventory;
    getAvailableInventory = mockGetAvailableInventory;
    getAvailableRobots = mockGetAvailableRobots;
  },
}));

jest.mock('../../src/infrastructure/repositories/SqliteAllocationHistoryRepository', () => ({
  SqliteAllocationHistoryRepository: class {
    clear = mockClear;
    findAll = mockFindAll;
  },
}));

jest.mock('../../src/services/InventoryService', () => ({
  InventoryService: class {
    getAvailableRobots = mockGetAvailableRobots;
  },
}));

jest.mock('../../src/services/AllocationService', () => ({
  AllocationService: class {},
}));

jest.mock('../../src/cli/CliController', () => ({
  CliController: class {
    run = mockCliRun;
  },
}));

jest.mock('../../src/strategies/CategoryDistributionStrategy', () => ({
  CategoryDistributionStrategy: class {
    name = 'L1';
  },
}));

jest.mock('../../src/strategies/CostOptimizedStrategy', () => ({
  CostOptimizedStrategy: class {
    name = 'L2';
  },
}));

jest.mock('../../src/strategies/StandbyActivationStrategy', () => ({
  StandbyActivationStrategy: class {
    name = 'L3';
    constructor(public readonly base: unknown, public readonly standby: unknown[]) {}
  },
}));

jest.mock('../../src/cli/prompts', () => ({
  selectPrompt: mockSelectPrompt,
}));

jest.mock('../../src/cli/formatters/InventoryFormatter', () => ({
  InventoryFormatter: { format: mockInventoryFormat },
}));

jest.mock('../../src/cli/formatters/LogsFormatter', () => ({
  LogsFormatter: { format: mockLogsFormat },
}));

const mockAllocationFormat = jest.fn(() => 'formatted allocations');

jest.mock('../../src/cli/formatters/AllocationFormatter', () => ({
  AllocationFormatter: { format: mockAllocationFormat },
}));

jest.mock('fs', () => ({
  readdirSync: mockReaddirSync,
  readFileSync: mockReadFileSync,
}));

import {
  resetInventory,
  showAllocations,
  runSession,
  showLogs,
  showSummary,
} from '../../src/cli/commandHandlers';

describe('runSession CLI workflows', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'log').mockImplementation(() => undefined);
    jest.spyOn(console, 'info').mockImplementation(() => undefined);
    jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    mockGetInventory.mockResolvedValue([{ type: 'Bravo', source: RobotSource.ACTIVE, available: 2 }]);
    mockGetAvailableInventory.mockResolvedValue([
      { type: 'Bravo', source: RobotSource.ACTIVE, available: 1 },
    ]);
    mockFindAll.mockResolvedValue([]);
    mockGetAvailableRobots.mockResolvedValue([]);
    mockSelectPrompt.mockResolvedValue('L1');
    mockConnection.prepare.mockReturnValue({ all: jest.fn(() => []) });
    mockConnection.transaction.mockImplementation((callback: () => void) => callback);
    mockReaddirSync.mockReturnValue([]);
    mockReadFileSync.mockReturnValue('');
  });

  it('formats allocation history and closes the database', async () => {
    const records = [{ id: 1, allocationId: 1 }];
    mockFindAll.mockResolvedValue(records);

    await showAllocations();

    expect(mockFindAll).toHaveBeenCalled();
    expect(mockAllocationFormat).toHaveBeenCalledWith(records);
    expect(console.log).toHaveBeenCalledWith('formatted allocations');
    expect(mockClose).toHaveBeenCalled();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('reports an empty summary without formatting', async () => {
    mockGetAvailableInventory.mockResolvedValue([]);

    await showSummary();

    expect(console.error).toHaveBeenCalledWith(
      'No inventory found. Add inventory entries to config.yaml.',
    );
    expect(mockInventoryFormat).not.toHaveBeenCalled();
    expect(mockClose).toHaveBeenCalled();
  });

  it('formats summary usage and aggregate charging cost', async () => {
    mockGetAvailableInventory.mockResolvedValue([
      { type: 'Bravo', source: RobotSource.ACTIVE, available: 1 },
      { type: 'Unknown', source: RobotSource.STANDBY, available: 0 },
    ]);

    await showSummary();

    expect(mockInventoryFormat).toHaveBeenCalledWith(
      [
        expect.objectContaining({
          type: 'Bravo',
          total: 2,
          chargingCost: 2,
          utilization: 50,
        }),
        expect.objectContaining({
          type: 'Unknown',
          total: 0,
          chargingCost: 0,
          utilization: 0,
        }),
      ],
      'Current Resources',
    );
    expect(console.log).toHaveBeenCalledWith('formatted inventory');
    expect(console.log).toHaveBeenCalledWith('\nTotal charging cost: $2');
    expect(console.log).toHaveBeenCalledWith('Average robot utilisation: 50.0%');
  });

  it('reports zero average utilisation when all configured totals are zero', async () => {
    mockGetAvailableInventory.mockResolvedValue([
      { type: 'Unknown', source: RobotSource.STANDBY, available: 0 },
    ]);

    await showSummary();

    expect(console.log).toHaveBeenCalledWith('Average robot utilisation: 0.0%');
  });

  it('clears allocation history on a soft reset', async () => {
    await resetInventory();

    expect(mockClear).toHaveBeenCalled();
    expect(console.log).toHaveBeenCalledWith(
      'Reset completed. Allocation history has been cleared.',
    );
    expect(mockClose).toHaveBeenCalled();
  });

  it('drops all user tables on a hard reset', async () => {
    mockConnection.prepare.mockReturnValue({
      all: jest.fn(() => [{ name: 'allocation_history' }, { name: 'quoted"table' }]),
    });

    await resetInventory(true);

    expect(mockConnection.exec).toHaveBeenCalledWith('DROP TABLE "allocation_history"');
    expect(mockConnection.exec).toHaveBeenCalledWith('DROP TABLE "quoted""table"');
    expect(console.log).toHaveBeenCalledWith(
      'Hard reset completed. All SQL tables have been dropped.',
    );
  });

  it('formats records and relative log file links', () => {
    mockReaddirSync.mockReturnValue(['app.log.1', 'app.log', 'ignored.txt']);
    mockReadFileSync
      .mockReturnValueOnce('{"time":"2026-01-02T00:00:00.000Z","level":30,"msg":"later"}\n')
      .mockReturnValueOnce('{"time":"2026-01-01T00:00:00.000Z","level":30,"msg":"first"}\n');

    showLogs();

    expect(mockLogsFormat).toHaveBeenCalledWith([
      { time: '2026-01-01T00:00:00.000Z', level: 30, msg: 'first' },
      { time: '2026-01-02T00:00:00.000Z', level: 30, msg: 'later' },
    ]);
    expect(console.log).toHaveBeenCalledWith('formatted logs');
    expect(console.log).toHaveBeenCalledWith(expect.stringContaining('./logs/app.log'));
  });

  it('reports when no log files or records exist', () => {
    showLogs();

    expect(console.log).toHaveBeenCalledWith('No logs found in logs/app.log.');
    expect(mockLogsFormat).not.toHaveBeenCalled();
  });

  it('warns and closes when no robots are available', async () => {
    mockGetAvailableInventory.mockResolvedValue([]);

    await runSession();

    expect(console.error).toHaveBeenCalledWith(
      'Inventory is empty. Add inventory entries to config.yaml before starting a session.',
    );
    expect(mockSelectPrompt).not.toHaveBeenCalled();
    expect(mockClose).toHaveBeenCalled();
  });

  it.each([
    ['l1', 'L1'],
    ['L2', 'L2'],
  ])('runs the selected %s strategy', async (choice, expectedName) => {
    mockSelectPrompt.mockResolvedValue(choice);

    await runSession();

    expect(mockCliRun).toHaveBeenCalledWith(
      expect.objectContaining({ name: expectedName }),
      expect.anything(),
    );
    expect(mockClose).toHaveBeenCalled();
  });

  it('passes the standby strategy for multi-client allocations', async () => {
    mockSelectPrompt.mockResolvedValue('L1');

    await runSession();

    expect(mockCliRun).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'L1' }),
      expect.objectContaining({ name: 'L3' }),
    );
  });

  it('builds the L3 strategy with standby robots only', async () => {
    const activeRobot = { source: RobotSource.ACTIVE };
    const standbyRobot = { source: RobotSource.STANDBY };
    mockGetAvailableRobots.mockResolvedValue([activeRobot, standbyRobot]);
    mockSelectPrompt.mockResolvedValue('l3');

    await runSession();

    expect(mockCliRun).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'L3',
        standby: [standbyRobot],
      }),
      expect.anything(),
    );
  });

  it('reports an invalid strategy selection', async () => {
    mockSelectPrompt.mockResolvedValue('invalid');

    await runSession();

    expect(console.error).toHaveBeenCalledWith(
      'Invalid strategy selection. Choose L1, L2, or L3.',
    );
    expect(mockCliRun).not.toHaveBeenCalled();
    expect(mockClose).toHaveBeenCalled();
  });
});
