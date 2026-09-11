import { AppDatabase } from '../db/Database';
import { IRobotRepository, RobotInventoryCount } from '../../domain/repositories/IRobotRepository';
import { RobotSource } from '../../domain/entities/Robot';
import { InsufficientCapacityError } from '../../domain/errors';
import { ILogger } from '../logging/ILogger';
import { InitialInventoryEntry } from '../config/ConfigLoader';

export class SqliteRobotRepository implements IRobotRepository {
  constructor(
    private readonly db: AppDatabase,
    private readonly logger: ILogger,
  ) { }

  async getInventory(): Promise<RobotInventoryCount[]> {
    const rows = this.db.connection
      .prepare('SELECT type, source, available FROM robot_inventory')
      .all() as RobotInventoryCount[];
    return rows;
  }

  async initInventory(inventory: InitialInventoryEntry[]) {
    await this.setInventory(
      inventory.map(({ type, source, count }) => ({
        type,
        source: RobotSource[source],
        available: count,
      })),
    );
  }

  async setInventory(counts: RobotInventoryCount[]): Promise<void> {
    const upsert = this.db.connection.prepare(`
      INSERT INTO robot_inventory (type, source, available)
      VALUES (@type, @source, @available)
      ON CONFLICT(type, source) DO UPDATE SET available = excluded.available
    `);

    const setAll = this.db.connection.transaction((rows: RobotInventoryCount[]) => {
      for (const row of rows) upsert.run(row);
    });

    setAll(counts);
  }

  async clearInventory(): Promise<void> {
    this.db.connection.prepare('DELETE FROM robot_inventory').run();
  }

  async allocate(
    selections: Array<{ type: string; source: RobotSource; count: number }>,
  ): Promise<void> {
    const getAvailable = this.db.connection.prepare(
      'SELECT available FROM robot_inventory WHERE type = ? AND source = ?',
    );
    const decrement = this.db.connection.prepare(
      'UPDATE robot_inventory SET available = available - ? WHERE type = ? AND source = ?',
    );

    // Wrapped in a single transaction: the read-check-write is atomic, so two
    // concurrent CLI instances can't both pass the check and over-allocate.
    const applyAllocation = this.db.connection.transaction(() => {
      for (const { type, source, count } of selections) {
        const row = getAvailable.get(type, source) as { available: number } | undefined;
        const available = row?.available ?? 0;

        if (available < count) {
          throw new InsufficientCapacityError(
            `Requested ${count} ${type} (${source}) robots but only ${available} available.`,
          );
        }
      }

      for (const { type, source, count } of selections) {
        decrement.run(count, type, source);
      }
    });

    try {
      applyAllocation();
    } catch (err) {
      this.logger.error('Robot allocation transaction failed', { err, selections });
      throw err;
    }
  }
}
