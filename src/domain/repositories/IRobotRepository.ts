import { RobotSource } from '../entities/Robot';

export interface RobotInventoryCount {
  type: string;
  source: RobotSource;
  available: number;
}

/**
 * Persistence boundary for robot inventory. Implementations must guarantee
 * that `allocate` is atomic (safe under concurrent CLI instances).
 */
export interface IRobotRepository {
  getInventory(): Promise<RobotInventoryCount[]>;
  getAvailableInventory(): Promise<RobotInventoryCount[]>;

  /**
   * Checks current availability and decrements the process-local view.
   * AllocationService supplies the database transaction that makes this check
   * and the corresponding history write atomic across processes.
   */
  allocate(selections: Array<{ type: string; source: RobotSource; count: number }>): Promise<void>;
}
