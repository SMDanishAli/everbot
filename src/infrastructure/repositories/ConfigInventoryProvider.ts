import { AppDatabase } from '../db/Database';
import { IInventoryProvider, RobotInventoryCount } from '../../domain/repositories/IInventoryProvider';
import { RobotSource } from '../../domain/entities/Robot';
import { InitialInventoryEntry } from '../config/ConfigLoader';

export class ConfigInventoryProvider implements IInventoryProvider {
  private readonly configuredInventory: RobotInventoryCount[];

  constructor(
    private readonly db: AppDatabase,
    initialInventory: InitialInventoryEntry[] = [],
  ) {
    this.configuredInventory = initialInventory.map(({ type, source, count }) => ({
      type,
      source: RobotSource[source],
      available: count,
    }));
  }

  async getInventory(): Promise<RobotInventoryCount[]> {
    return this.configuredInventory.map((row) => ({ ...row }));
  }

  async getAvailableInventory(): Promise<RobotInventoryCount[]> {
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

    return this.configuredInventory.map((row) => ({
      ...row,
      available: Math.max(0, row.available - (allocated.get(`${row.type}:${row.source}`) ?? 0)),
    }));
  }
}
