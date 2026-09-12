import { AppDatabase } from '../db/Database';
import {
  AllocationHistoryRecord,
  IAllocationHistoryRepository,
} from '../../domain/repositories/IAllocationHistoryRepository';
import { AllocationResult } from '../../domain/entities/AllocationResult';

export class SqliteAllocationHistoryRepository implements IAllocationHistoryRepository {
  constructor(private readonly db: AppDatabase) {}

  async clear(): Promise<void> {
    this.db.connection.prepare('DELETE FROM allocation_history').run();
  }

  async findAll(): Promise<AllocationHistoryRecord[]> {
    const rows = this.db.connection
      .prepare(
        `SELECT
           id,
           allocation_id,
           hours_requested,
           strategy_name,
           type,
           source,
           total_hours_provided,
           total_cost,
           created_at
         FROM allocation_history
         ORDER BY created_at DESC, id DESC`,
      )
      .all() as Array<{
      id: number;
      allocation_id: number;
      hours_requested: number;
      strategy_name: string;
      type: string;
      source: string;
      total_hours_provided: number;
      total_cost: number;
      created_at: string;
    }>;

    return rows.map((row) => ({
      id: row.id,
      allocationId: row.allocation_id,
      hoursRequested: row.hours_requested,
      strategyName: row.strategy_name,
      type: row.type,
      source: row.source,
      totalHoursProvided: row.total_hours_provided,
      totalCost: row.total_cost,
      createdAt: row.created_at,
    }));
  }

  async save(result: AllocationResult, strategyName: string): Promise<void> {
    const save = () => {
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
    };

    if (this.db.connection.inTransaction) {
      save();
    } else {
      this.db.connection.transaction(save)();
    }
  }

}