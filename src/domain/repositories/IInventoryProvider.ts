import { RobotSource } from '../entities/Robot';

export interface RobotInventoryCount {
  type: string;
  source: RobotSource;
  available: number;
}

export interface IInventoryProvider {
  getInventory(): Promise<RobotInventoryCount[]>;
  getAvailableInventory(): Promise<RobotInventoryCount[]>;
}
