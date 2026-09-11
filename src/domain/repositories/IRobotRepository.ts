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
  setInventory(counts: RobotInventoryCount[]): Promise<void>;
  clearInventory(): Promise<void>;

  /**
   * Atomically checks availability and decrements it in one transaction.
   * Throws if any requested count exceeds what's available.
   */
  allocate(selections: Array<{ type: string; source: RobotSource; count: number }>): Promise<void>;
}
