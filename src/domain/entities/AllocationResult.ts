import { Robot } from './Robot';

/**
 * A distinct way to cover a standby shortfall from one or more robot
 * categories, and its total cost. May span multiple categories when no
 * single one has enough units to cover the shortfall alone.
 */
export interface StandbyOption {
  breakdown: Array<{ type: string; count: number }>;
  cost: number;
}

export class AllocationResult {
  constructor(
    public readonly clientId: string,
    public readonly hoursRequested: number,
    public readonly assignedRobots: Robot[],
    public readonly standbyAlternatives: StandbyOption[] = [],
  ) {}

  get totalHoursProvided(): number {
    return this.assignedRobots.reduce((sum, robot) => sum + robot.workingHours, 0);
  }

  get totalCost(): number {
    return this.assignedRobots.reduce((sum, robot) => sum + robot.chargingCost, 0);
  }

  get excessHours(): number {
    return this.totalHoursProvided - this.hoursRequested;
  }

  countByType(typeName: string): number {
    return this.assignedRobots.filter((robot) => robot.type.name === typeName).length;
  }
}
