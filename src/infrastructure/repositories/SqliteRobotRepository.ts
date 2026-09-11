import { AppDatabase } from '../db/Database';
import { IRobotRepository, RobotInventoryCount } from '../../domain/repositories/IRobotRepository';
import { RobotSource } from '../../domain/entities/Robot';
import { InsufficientCapacityError } from '../../domain/errors';
import { ILogger } from '../logging/ILogger';
import { InitialInventoryEntry } from '../config/ConfigLoader';

/**
 * Keeps the current session's inventory in memory. The configured counts are
 * loaded at process startup, so every new process starts with a fresh day.
 */
export class SqliteRobotRepository implements IRobotRepository {
  private inventory: RobotInventoryCount[];
  private historyApplied = false;

  constructor(
    private readonly db: AppDatabase,
    private readonly logger: ILogger,
    initialInventory: InitialInventoryEntry[] = [],
  ) {
    this.inventory = initialInventory.map(({ type, source, count }) => ({
      type,
      source: RobotSource[source],
      available: count,
    }));
  }

  async getInventory(): Promise<RobotInventoryCount[]> {
    return this.inventory.map((row) => ({ ...row }));
  }

  async getAvailableInventory(): Promise<RobotInventoryCount[]> {
    if (this.historyApplied) {
      return this.inventory.map((row) => ({ ...row }));
    }

    const usage = this.db.connection
      .prepare(
        `SELECT type, source, COUNT(*) AS allocated
         FROM allocation_history
         WHERE date(created_at, 'localtime') = date('now', 'localtime')
         GROUP BY type, source`,
      )
      .all() as Array<{ type: string; source: RobotSource; allocated: number }>;

      
    const allocated = new Map(
      usage.map((row) => [`${row.type}:${row.source}`, row.allocated]),
    );

    this.inventory = this.inventory.map((row) => ({
      ...row,
      available: Math.max(0, row.available - (allocated.get(`${row.type}:${row.source}`) ?? 0)),
    }));
    this.historyApplied = true;
    return this.inventory.map((row) => ({ ...row }));
  }

  async setInventory(counts: RobotInventoryCount[]): Promise<void> {
    this.inventory = counts.map((row) => ({ ...row }));
    this.historyApplied = true;
  }

  async allocate(
    selections: Array<{ type: string; source: RobotSource; count: number }>,
  ): Promise<void> {
    try {
      for (const { type, source, count } of selections) {
        const row = this.inventory.find((item) => item.type === type && item.source === source);
        const available = row?.available ?? 0;

        if (available < count) {
          throw new InsufficientCapacityError(
            `Requested ${count} ${type} (${source}) robots but only ${available} available.`,
          );
        }
      }

      for (const { type, source, count } of selections) {
        const row = this.inventory.find((item) => item.type === type && item.source === source);
        if (row) row.available -= count;
      }
    } catch (err) {
      this.logger.error('Robot allocation transaction failed', { err, selections });
      throw err;
    }
  }
}
