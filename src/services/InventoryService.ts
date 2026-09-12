import { Robot, RobotSource } from '../domain/entities/Robot';
import { IInventoryProvider } from '../domain/repositories/IInventoryProvider';
import { RobotTypeRegistry } from '../infrastructure/config/RobotTypeRegistry';
import { ZeroRobotsError } from '../domain/errors';

/**
 * Translates persisted inventory counts into a flat list of Robot instances
 * strategies can select from. Strategies never talk to the repository
 * directly — this is the only place inventory counts become Robot objects.
 */
export class InventoryService {
  constructor(
    private readonly repository: IInventoryProvider,
    private readonly robotTypes: RobotTypeRegistry,
  ) {}

  async getAvailableRobots(source?: RobotSource): Promise<Robot[]> {
    const counts = await this.repository.getAvailableInventory();
    const filtered = source ? counts.filter((c) => c.source === source) : counts;

    const robots: Robot[] = [];
    for (const count of filtered) {
      const type = this.robotTypes.get(count.type);
      for (let i = 0; i < count.available; i++) {
        robots.push(new Robot(type, count.source));
      }
    }
    if (robots.length === 0) {
      throw new ZeroRobotsError();
    }

    return robots;
  }
}
