import { IInventoryProvider } from '../../../src/domain/repositories/IInventoryProvider';
import { RobotSource } from '../../../src/domain/entities/Robot';
import { InMemoryLogger } from '../../../src/infrastructure/logging/InMemoryLogger';
import { AllocationReservationRepository } from '../../../src/infrastructure/repositories/AllocationReservationRepository';

describe('AllocationReservationRepository', () => {
  it('rejects allocations that exceed current availability', async () => {
    const provider: IInventoryProvider = {
      getInventory: jest.fn(),
      getAvailableInventory: jest.fn().mockResolvedValue([
        { type: 'Bravo', source: RobotSource.ACTIVE, available: 2 },
      ]),
    };
    const logger = new InMemoryLogger();
    const repository = new AllocationReservationRepository(provider, logger);

    await expect(
      repository.allocate([{ type: 'Bravo', source: RobotSource.ACTIVE, count: 3 }]),
    ).rejects.toThrow('Requested 3 Bravo (ACTIVE) robots but only 2 available.');
    expect(logger.entries.at(-1)).toMatchObject({
      level: 'error',
      message: 'Robot allocation transaction failed',
    });
  });

  it('resolves without error when every selection is within availability', async () => {
    const provider: IInventoryProvider = {
      getInventory: jest.fn(),
      getAvailableInventory: jest.fn().mockResolvedValue([
        { type: 'Bravo', source: RobotSource.ACTIVE, available: 2 },
      ]),
    };
    const logger = new InMemoryLogger();
    const repository = new AllocationReservationRepository(provider, logger);

    await expect(
      repository.allocate([{ type: 'Bravo', source: RobotSource.ACTIVE, count: 2 }]),
    ).resolves.toBeUndefined();
    expect(logger.entries).toHaveLength(0);
  });

  it('treats a type/source with no inventory row at all as zero available', async () => {
    const provider: IInventoryProvider = {
      getInventory: jest.fn(),
      getAvailableInventory: jest.fn().mockResolvedValue([]),
    };
    const logger = new InMemoryLogger();
    const repository = new AllocationReservationRepository(provider, logger);

    await expect(
      repository.allocate([{ type: 'Charlie', source: RobotSource.STANDBY, count: 1 }]),
    ).rejects.toThrow('Requested 1 Charlie (STANDBY) robots but only 0 available.');
  });
});
