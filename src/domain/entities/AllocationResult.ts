import { Robot } from './Robot';

export class AllocationResult {
  constructor(
    public readonly clientId: string,
    public readonly hoursRequested: number,
    public readonly assignedRobots: Robot[],
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
