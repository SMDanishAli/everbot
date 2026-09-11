/**
 * Immutable value object describing a robot category's attributes.
 * Values now come from config.yaml (via RobotTypeRegistry) instead of being
 * hardcoded — adding/changing a robot type requires no code change (OCP).
 */
export class RobotType {
  constructor(
    public readonly name: string,
    public readonly hours: number,
    public readonly chargingCost: number,
  ) {}

  equals(other: RobotType): boolean {
    return this.name === other.name;
  }
}
