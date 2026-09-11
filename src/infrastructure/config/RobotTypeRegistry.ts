import { RobotType } from '../../domain/entities/RobotType';
import { RobotSpecConfig } from './ConfigLoader';

/**
 * Builds and looks up RobotType value objects from config.yaml's robot specs.
 * This is the single place config data crosses into the domain layer;
 * everything downstream (strategies, services) works with plain RobotType
 * objects and has no knowledge of where they came from.
 */
export class RobotTypeRegistry {
  private readonly types: ReadonlyMap<string, RobotType>;

  constructor(specs: RobotSpecConfig[]) {
    this.types = new Map(
      specs.map((spec) => [
        spec.name,
        new RobotType(spec.name, spec.hours, spec.chargingCost),
      ]),
    );
  }

  all(): RobotType[] {
    return Array.from(this.types.values());
  }

  get(name: string): RobotType {
    const type = this.types.get(name);
    if (!type) {
      throw new Error(`Unknown robot type: "${name}". Check config.yaml.`);
    }
    return type;
  }
}
