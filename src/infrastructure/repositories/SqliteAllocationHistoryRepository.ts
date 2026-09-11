import { AppDatabase } from '../db/Database';
import { IAllocationHistoryRepository } from '../../domain/repositories/IAllocationHistoryRepository';
import { AllocationResult } from '../../domain/entities/AllocationResult';
import { Robot, RobotSource } from '../../domain/entities/Robot';
import { RobotType } from '../../domain/entities/RobotType';
import { RobotTypeRegistry } from '../config/RobotTypeRegistry';

interface AllocationHistoryRow {
  allocation_id: number;
  hours_requested: number;
  type: string;
  source: RobotSource;
}

export class SqliteAllocationHistoryRepository implements IAllocationHistoryRepository {
  constructor(
    private readonly db: AppDatabase,
    private readonly robotTypes: RobotTypeRegistry,
  ) {}

  async clear(): Promise<void> {
    this.db.connection.prepare('DELETE FROM allocation_history').run();
  }

  async save(result: AllocationResult, strategyName: string): Promise<void> {
    const save = this.db.connection.transaction(() => {
      const insert = this.db.connection.prepare(`
        INSERT INTO allocation_history
          (allocation_id, hours_requested, strategy_name, type, source, total_hours_provided, total_cost)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `);
      let allocationId = -1;

      for (const robot of result.assignedRobots) {
        const row = insert.run(
          allocationId,
          result.hoursRequested,
          strategyName,
          robot.type.name,
          robot.source,
          result.totalHoursProvided,
          result.totalCost,
        );
        if (allocationId === -1) {
          allocationId = Number(row.lastInsertRowid);
          this.db.connection
            .prepare('UPDATE allocation_history SET allocation_id = ? WHERE id = ?')
            .run(allocationId, allocationId);
        }
      }
    });

    save();
  }

  async findSince(isoTimestamp: string): Promise<AllocationResult[]> {
    // Uses idx_allocation_history_created_at — matches the actual query pattern
    // (recent/current-date lookups), unlike a client_id index which no query needs.
    const rows = this.db.connection
      .prepare(
        `SELECT allocation_id, hours_requested, type, source
         FROM allocation_history
         WHERE created_at >= ?
         ORDER BY created_at DESC, id DESC`,
      )
      .all(isoTimestamp) as AllocationHistoryRow[];

    const allocations = new Map<number, AllocationHistoryRow[]>();
    for (const row of rows) {
      const entries = allocations.get(row.allocation_id) ?? [];
      entries.push(row);
      allocations.set(row.allocation_id, entries);
    }

    return Array.from(allocations.values()).map((entries) => {
      const first = entries[0];
      const robots = entries.map(
        (entry) => new Robot(this.robotTypes.get(entry.type) as RobotType, entry.source),
      );
      return new AllocationResult('unknown', first.hours_requested, robots);
    });
  }
}