import { AppDatabase } from '../db/Database';
import { IAllocationHistoryRepository } from '../../domain/repositories/IAllocationHistoryRepository';
import { AllocationResult } from '../../domain/entities/AllocationResult';
import { Robot, RobotSource } from '../../domain/entities/Robot';
import { RobotType } from '../../domain/entities/RobotType';
import { RobotTypeRegistry } from '../config/RobotTypeRegistry';

interface AllocationHistoryRow {
  hours_requested: number;
  assigned_robots_json: string;
}

interface SerializedRobot {
  type: string;
  source: RobotSource;
}

export class SqliteAllocationHistoryRepository implements IAllocationHistoryRepository {
  constructor(
    private readonly db: AppDatabase,
    private readonly robotTypes: RobotTypeRegistry,
  ) {}

  async save(result: AllocationResult, strategyName: string): Promise<void> {
    const assignedRobotsJson = JSON.stringify(
      result.assignedRobots.map((robot) => ({ type: robot.type.name, source: robot.source })),
    );

    this.db.connection
      .prepare(
        `INSERT INTO allocation_history
          (hours_requested, strategy_name, assigned_robots_json, total_hours_provided, total_cost)
         VALUES (?, ?, ?, ?, ?)`,
      )
      .run(
        result.hoursRequested,
        strategyName,
        assignedRobotsJson,
        result.totalHoursProvided,
        result.totalCost,
      );
  }

  async findSince(isoTimestamp: string): Promise<AllocationResult[]> {
    // Uses idx_allocation_history_created_at — matches the actual query pattern
    // (recent/current-date lookups), unlike a client_id index which no query needs.
    const rows = this.db.connection
      .prepare(
        'SELECT hours_requested, assigned_robots_json FROM allocation_history WHERE created_at >= ? ORDER BY created_at DESC',
      )
      .all(isoTimestamp) as AllocationHistoryRow[];

    return rows.map((row) => {
      const serializedRobots = JSON.parse(row.assigned_robots_json) as SerializedRobot[];
      const robots = serializedRobots.map(
        (sr) => new Robot(this.robotTypes.get(sr.type) as RobotType, sr.source),
      );
      // clientId isn't persisted (not needed — no query filters by it); placeholder on reconstruction.
      return new AllocationResult('unknown', row.hours_requested, robots);
    });
  }
}