import { InventoryService } from '../../src/services/InventoryService';
import { RobotSource } from '../../src/domain/entities/Robot';
import { RobotTypeRegistry } from '../../src/infrastructure/config/RobotTypeRegistry';
import { ZeroRobotsError } from '../../src/domain/errors';
import { IInventoryProvider } from '../../src/domain/repositories/IInventoryProvider';

describe('InventoryService', () => {
  const repository: jest.Mocked<IInventoryProvider> = {
    getInventory: jest.fn(),
    getAvailableInventory: jest.fn(),
  };
  const registry = new RobotTypeRegistry([
    { name: 'Bravo', hours: 3, chargingCost: 2 },
    { name: 'Delta', hours: 8, chargingCost: 4 },
  ]);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('expands available counts into robot instances', async () => {
    repository.getAvailableInventory.mockResolvedValue([
      { type: 'Bravo', source: RobotSource.ACTIVE, available: 2 },
      { type: 'Delta', source: RobotSource.STANDBY, available: 1 },
    ]);
    const service = new InventoryService(repository, registry);

    const robots = await service.getAvailableRobots();

    expect(robots).toHaveLength(3);
    expect(robots.map((robot) => `${robot.type.name}:${robot.source}`)).toEqual([
      'Bravo:ACTIVE',
      'Bravo:ACTIVE',
      'Delta:STANDBY',
    ]);
  });

  it('filters by source before expanding inventory', async () => {
    repository.getAvailableInventory.mockResolvedValue([
      { type: 'Bravo', source: RobotSource.ACTIVE, available: 2 },
      { type: 'Delta', source: RobotSource.STANDBY, available: 1 },
    ]);
    const service = new InventoryService(repository, registry);

    const robots = await service.getAvailableRobots(RobotSource.STANDBY);

    expect(robots).toHaveLength(1);
    expect(robots[0].type.name).toBe('Delta');
  });

  it('throws when the filtered inventory is empty', async () => {
    repository.getAvailableInventory.mockResolvedValue([
      { type: 'Bravo', source: RobotSource.ACTIVE, available: 0 },
    ]);
    const service = new InventoryService(repository, registry);

    await expect(service.getAvailableRobots()).rejects.toBeInstanceOf(ZeroRobotsError);
  });
});
