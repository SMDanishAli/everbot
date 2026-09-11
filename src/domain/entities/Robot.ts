import { RobotType } from './RobotType';

export enum RobotSource {
  ACTIVE = 'ACTIVE',
  STANDBY = 'STANDBY',
}

/**
 * A single allocatable robot instance. Each robot can be used at most
 * once per allocation (spec: "Each robot can only be used once per allocation").
 */
export class Robot {
  constructor(
    public readonly type: RobotType,
    public readonly source: RobotSource = RobotSource.ACTIVE,
  ) {}

  get workingHours(): number {
    return this.type.hours;
  }

  get chargingCost(): number {
    return this.type.chargingCost;
  }
}
