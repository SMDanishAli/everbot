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
});
