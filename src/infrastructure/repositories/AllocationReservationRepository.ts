import { IAllocationReservationRepository } from '../../domain/repositories/IAllocationReservationRepository';
import { RobotSource } from '../../domain/entities/Robot';
import { InsufficientCapacityError } from '../../domain/errors';
import { ILogger } from '../logging/ILogger';
import { IInventoryProvider } from '../../domain/repositories/IInventoryProvider';

export class AllocationReservationRepository implements IAllocationReservationRepository {
  constructor(
    private readonly inventoryProvider: IInventoryProvider,
    private readonly logger: ILogger,
  ) {}

  async allocate(
    selections: Array<{ type: string; source: RobotSource; count: number }>,
  ): Promise<void> {
    try {
      const availableInventory = await this.inventoryProvider.getAvailableInventory();
      for (const { type, source, count } of selections) {
        const row = availableInventory.find((item) => item.type === type && item.source === source);
        const available = row?.available ?? 0;
        if (available < count) {
          throw new InsufficientCapacityError(
            `Requested ${count} ${type} (${source}) robots but only ${available} available.`,
          );
        }
      }
    } catch (err) {
      this.logger.error('Robot allocation transaction failed', { err, selections });
      throw err;
    }
  }
}
