import { readdirSync, readFileSync } from 'fs';
import { join, relative } from 'path';
import { ConfigLoader } from '../infrastructure/config/ConfigLoader';
import { RobotTypeRegistry } from '../infrastructure/config/RobotTypeRegistry';
import { PinoLogger } from '../infrastructure/logging/PinoLogger';
import { AppDatabase } from '../infrastructure/db/Database';
import { MigrationRunner } from '../infrastructure/db/MigrationRunner';
import { SqliteRobotRepository } from '../infrastructure/repositories/SqliteRobotRepository';
import { SqliteAllocationHistoryRepository } from '../infrastructure/repositories/SqliteAllocationHistoryRepository';
import { InventoryService } from '../services/InventoryService';
import { AllocationService } from '../services/AllocationService';
import { CategoryDistributionStrategy } from '../strategies/CategoryDistributionStrategy';
import { CostOptimizedStrategy } from '../strategies/CostOptimizedStrategy';
import { StandbyActivationStrategy } from '../strategies/StandbyActivationStrategy';
import { CliController } from './CliController';
import { InventoryFormatter } from './formatters/InventoryFormatter';
import { LogsFormatter, LogRecord } from './formatters/LogsFormatter';
import { selectPrompt } from './prompts';
import { RobotSource } from '../domain/entities/Robot';

export async function showSummary(): Promise<void> {
  const config = ConfigLoader.load('./config.yaml');
  const logger = new PinoLogger(config.logging);
  const db = new AppDatabase(config.database);

  try {
    new MigrationRunner(db, logger).run();

    const inventory = await new SqliteRobotRepository(db, logger, config.inventory).getAvailableInventory();
    const totals = new Map(
      config.inventory.map(({ type, source, count }) => [`${type}:${source}`, count]),
    );
    if (inventory.length === 0) {
      console.info('No inventory found. Add inventory entries to config.yaml.');
      return;
    }

    const robotSpecs = new Map(config.robots.map((robot) => [robot.name, robot]));
    console.log(
      InventoryFormatter.format(
        inventory.map((row) => ({
          ...row,
          total: totals.get(`${row.type}:${row.source}`) ?? row.available,
          chargingCost:
            ((totals.get(`${row.type}:${row.source}`) ?? row.available) - row.available) *
            (robotSpecs.get(row.type)?.chargingCost ?? 0),
          utilization: (() => {
            const total = totals.get(`${row.type}:${row.source}`) ?? row.available;
            return total === 0 ? 0 : ((total - row.available) / total) * 100;
          })(),
        })),
        'Current Resources',
      ),
    );

    let totalRobots = 0;
    let availableRobots = 0;
    let totalChargingCost = 0;

    for (const row of inventory) {
      const total = totals.get(`${row.type}:${row.source}`) ?? row.available;
      const robot = robotSpecs.get(row.type);
      totalRobots += total;
      availableRobots += row.available;
      totalChargingCost += (total - row.available) * (robot?.chargingCost ?? 0);
    }

    const utilization =
      totalRobots === 0 ? 0 : ((totalRobots - availableRobots) / totalRobots) * 100;
    console.log(`\nTotal charging cost: $${totalChargingCost}`);
    console.log(`Average robot utilisation: ${utilization.toFixed(1)}%`);
  } finally {
    db.close();
  }
}

export async function resetInventory(hard = false): Promise<void> {
  const config = ConfigLoader.load('./config.yaml');
  const logger = new PinoLogger(config.logging);
  const db = new AppDatabase(config.database);

  try {
    new MigrationRunner(db, logger).run();

    if (hard) {
      const tables = db.connection
        .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'")
        .all() as Array<{ name: string }>;
      const dropTables = db.connection.transaction(() => {
        for (const { name } of tables) {
          const identifier = `"${name.replaceAll('"', '""')}"`;
          db.connection.exec(`DROP TABLE ${identifier}`);
        }
      });

      dropTables();
      console.log('Hard reset completed. All SQL tables have been dropped.');
    } else {
      const historyRepository = new SqliteAllocationHistoryRepository(
        db,
        new RobotTypeRegistry(config.robots),
      );
      await historyRepository.clear();
      console.log('Reset completed. Allocation history has been cleared.');
    }
  } finally {
    db.close();
  }
}

export function showLogs(): void {
  const config = ConfigLoader.load('./config.yaml');
  const logFiles = readdirSync(config.logging.directory)
    .filter((file) => file === config.logging.fileName || file.startsWith(`${config.logging.fileName}.`))
    .sort()
    .reverse();
  const records: LogRecord[] = [];

  for (const file of logFiles) {
    const lines = readFileSync(join(config.logging.directory, file), 'utf8')
      .split('\n')
      .filter((line) => line.trim());

    for (const line of lines) {
      const record = JSON.parse(line) as LogRecord;
      records.push(record);
    }
  }

  records.sort((left, right) => String(left.time).localeCompare(String(right.time)));
  const relativeLogFiles = logFiles.map((file) =>
    relative(process.cwd(), join(config.logging.directory, file)),
  );
  const fileLinks = relativeLogFiles.map((file) => `  ./${file}`);

  if (records.length > 0) {
    console.log(LogsFormatter.format(records));
  } else {
    console.log(`No logs found in ${join(config.logging.directory, config.logging.fileName)}.`);
  }

  if (fileLinks.length > 0) {
    console.log('\nLog files:');
    console.log(fileLinks.join('\n'));
  }
}

/**
 * Invoked by `everbot run` (see cli/bin.ts).
 */
export async function runSession(): Promise<void> {
  const config = ConfigLoader.load('./config.yaml');

  const logger = new PinoLogger(config.logging);
  const robotTypes = new RobotTypeRegistry(config.robots);

  const db = new AppDatabase(config.database);
  new MigrationRunner(db, logger).run();

  const robotRepository = new SqliteRobotRepository(db, logger, config.inventory);
  const inventory = await robotRepository.getAvailableInventory();
  const availableRobots = inventory.reduce((total, entry) => total + entry.available, 0);
  if (availableRobots === 0) {
    console.warn(
      'Warning: inventory is empty. Add inventory entries to config.yaml before starting a session.',
    );
    db.close();
    return;
  }

  const historyRepository = new SqliteAllocationHistoryRepository(db, robotTypes);
  const inventoryService = new InventoryService(robotRepository, robotTypes);
  const strategyChoice = await selectPrompt('Choose an allocation strategy:', [
    { label: 'L1 - Category Distribution', value: 'L1' },
    { label: 'L2 - Cost Optimised', value: 'L2' },
    { label: 'L3 - Cost Optimised + Standby Activation', value: 'L3' },
  ]);

  let strategy: CategoryDistributionStrategy | CostOptimizedStrategy | StandbyActivationStrategy;
  switch (strategyChoice.toUpperCase()) {
    case 'L1':
      strategy = new CategoryDistributionStrategy();
      break;
    case 'L2':
      strategy = new CostOptimizedStrategy();
      break;
    case 'L3': {
      const robots = await inventoryService.getAvailableRobots();
      strategy = new StandbyActivationStrategy(
        new CostOptimizedStrategy(),
        robots.filter((robot) => robot.source === RobotSource.STANDBY),
      );
      break;
    }
    default:
      console.error('Invalid strategy selection. Choose L1, L2, or L3.');
      db.close();
      return;
  }

  const allocationService = new AllocationService(
    inventoryService,
    robotRepository,
    historyRepository,
    logger,
  );

  const cli = new CliController(allocationService, logger);

  await cli.run(strategy);

  db.close();
}