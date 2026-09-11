import { ClientRequest } from '../domain/entities/ClientRequest';
import { AllocationResult } from '../domain/entities/AllocationResult';
import { IAllocationStrategy } from '../strategies/IAllocationStrategy';
import { IRobotRepository } from '../domain/repositories/IRobotRepository';
import { IAllocationHistoryRepository } from '../domain/repositories/IAllocationHistoryRepository';
import { InventoryService } from './InventoryService';
import { DomainError } from '../domain/errors';
import { ILogger } from '../infrastructure/logging/ILogger';

/**
 * Orchestrates a single allocation end-to-end: load inventory, run the given
 * strategy, persist the result + updated inventory, log the outcome.
 * Logs at the boundary where the error is caught — logical errors at 'warn',
 * everything else at 'error' — so failures are recorded exactly once.
 */
export class AllocationService {
  constructor(
    private readonly inventoryService: InventoryService,
    private readonly robotRepository: IRobotRepository,
    private readonly historyRepository: IAllocationHistoryRepository,
    private readonly logger: ILogger,
  ) {}

  async allocate(strategy: IAllocationStrategy, request: ClientRequest): Promise<AllocationResult> {
    try {
      const availableRobots = await this.inventoryService.getAvailableRobots();
      const result = strategy.allocate(availableRobots, request);

      await this.robotRepository.allocate(
        result.assignedRobots.map((robot) => ({
          type: robot.type.name,
          source: robot.source,
          count: 1,
        })),
      );
      await this.historyRepository.save(result, strategy.name);

      return result;
    } catch (err) {
      if (err instanceof DomainError) {
        this.logger.error('Allocation rejected', {
          code: err.code,
          message: err.message,
          clientId: request.clientId,
        });
      } else {
        this.logger.error('Allocation failed (system error)', {
          err,
          clientId: request.clientId,
        });
      }
      throw err;
    }
  }
}
