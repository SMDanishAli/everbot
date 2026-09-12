import { ClientRequest } from '../domain/entities/ClientRequest';
import { AllocationResult } from '../domain/entities/AllocationResult';
import { IAllocationStrategy } from '../strategies/IAllocationStrategy';
import { IRobotRepository } from '../domain/repositories/IRobotRepository';
import { IAllocationHistoryRepository } from '../domain/repositories/IAllocationHistoryRepository';
import { InventoryService } from './InventoryService';
import { DomainError } from '../domain/errors';
import { ILogger } from '../infrastructure/logging/ILogger';
import { MultiClientAllocator } from '../strategies/MultiClientAllocator';
import { AllocationComparator, ComparisonReport } from './AllocationComparator';

/**
 * Run the given strategy, persist the result + updated inventory, log the outcome.
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

      await this.persistAllocation(result, strategy.name);

      return result;
    } catch (err) {
      this.logAllocationError(err, 'Allocation');
      throw err;
    }
  }

  async allocateWithComparison(
    strategy: IAllocationStrategy,
    comparisonStrategy: IAllocationStrategy,
    request: ClientRequest,
  ): Promise<{ result: AllocationResult; comparison: ComparisonReport }> {
    try {
      const availableRobots = await this.inventoryService.getAvailableRobots();
      const comparisonResult = comparisonStrategy.allocate(availableRobots, request);
      const result = strategy.allocate(availableRobots, request);

      await this.persistAllocation(result, strategy.name);

      return {
        result,
        comparison: AllocationComparator.compare(comparisonResult, result),
      };
    } catch (err) {
      this.logAllocationError(err, 'Allocation');
      throw err;
    }
  }

  async allocateMany(
    strategy: IAllocationStrategy,
    requests: ClientRequest[],
  ): Promise<AllocationResult[]> {
    try {
      const availableRobots = await this.inventoryService.getAvailableRobots();
      const results = new MultiClientAllocator(strategy).allocateAll(availableRobots, requests);
      const selections = results.flatMap((result) =>
        result.assignedRobots.map((robot) => ({
          type: robot.type.name,
          source: robot.source,
          count: 1,
        })),
      );

      await this.robotRepository.allocate(selections);
      for (const result of results) {
        await this.historyRepository.save(result, strategy.name);
      }

      return results;
    } catch (err) {
      this.logAllocationError(err, 'Multi-client allocation');
      throw err;
    }
  }

  private logAllocationError(err: unknown, context: string): void {
    if (err instanceof DomainError) {
      this.logger.error(`${context} rejected`, {
        code: err.code,
        message: err.message,
      });
    } else {
      this.logger.error(`${context} failed (system error)`, { err });
    }
  }

  private async persistAllocation(result: AllocationResult, strategyName: string): Promise<void> {
    await this.robotRepository.allocate(
      result.assignedRobots.map((robot) => ({
        type: robot.type.name,
        source: robot.source,
        count: 1,
      })),
    );
    await this.historyRepository.save(result, strategyName);
  }
}
