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
import { AppDatabase } from '../infrastructure/db/Database';

/**
 * Run the given strategy, persist the result + updated inventory, log the outcome.
 */
export class AllocationService {
  constructor(
    private readonly inventoryService: InventoryService,
    private readonly robotRepository: IRobotRepository,
    private readonly historyRepository: IAllocationHistoryRepository,
    private readonly logger: ILogger,
    private readonly db?: AppDatabase,
  ) {}

  async allocate(strategy: IAllocationStrategy, request: ClientRequest): Promise<AllocationResult> {
    try {
      return await this.withTransaction(async () => {
        const availableRobots = await this.inventoryService.getAvailableRobots();
        const result = strategy.allocate(availableRobots, request);
        await this.persistAllocation(result, strategy.name);
        return result;
      });
    } catch (err) {
      this.logAllocationError(err, 'Allocation');
      throw err;
    }
  }

  async allocateWithComparison(
    strategy: IAllocationStrategy,
    comparisonStrategy: IAllocationStrategy,
    request: ClientRequest,
    comparisonTargetStrategy: IAllocationStrategy = strategy,
  ): Promise<{ result: AllocationResult; comparison: ComparisonReport }> {
    try {
      return await this.withTransaction(async () => {
        const availableRobots = await this.inventoryService.getAvailableRobots();
        const comparisonResult = comparisonStrategy.allocate(availableRobots, request);
        const result = strategy.allocate(availableRobots, request);
        const comparisonTarget = comparisonTargetStrategy === strategy
          ? result
          : comparisonTargetStrategy.allocate(availableRobots, request);
        await this.persistAllocation(result, strategy.name);
        return {
          result,
          comparison: AllocationComparator.compare(comparisonResult, comparisonTarget),
        };
      });
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
      return await this.withTransaction(async () => {
        const availableRobots = await this.inventoryService.getAvailableRobots();
        return this.persistMany(
          new MultiClientAllocator(strategy).allocateAll(availableRobots, requests),
          strategy.name,
        );
      });
    } catch (err) {
      this.logAllocationError(err, 'Multi-client allocation');
      throw err;
    }
  }

  async allocateManyWithComparison(
    strategy: IAllocationStrategy,
    comparisonStrategy: IAllocationStrategy,
    comparisonTargetStrategy: IAllocationStrategy,
    requests: ClientRequest[],
  ): Promise<{
    results: AllocationResult[];
    comparisons: ComparisonReport[];
  }> {
    try {
      return await this.withTransaction(async () => {
        const availableRobots = await this.inventoryService.getAvailableRobots();
        const results = new MultiClientAllocator(strategy).allocateAll(availableRobots, requests);
        const level1Results = new MultiClientAllocator(comparisonStrategy).allocateAll(
          availableRobots,
          requests,
        );
        const level2Results = new MultiClientAllocator(comparisonTargetStrategy).allocateAll(
          availableRobots,
          requests,
        );
        await this.persistMany(results, strategy.name);
        const level1ByClient = new Map(level1Results.map((result) => [result.clientId, result]));
        const level2ByClient = new Map(level2Results.map((result) => [result.clientId, result]));
        return {
          results,
          comparisons: results.map((result) => {
            const level1 = level1ByClient.get(result.clientId);
            const level2 = level2ByClient.get(result.clientId);
            if (!level1 || !level2) {
              throw new Error(`Missing comparison result for ${result.clientId}.`);
            }
            return AllocationComparator.compare(level1, level2);
          }),
        };
      });
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

  private async persistMany(
    results: AllocationResult[],
    strategyName: string,
  ): Promise<AllocationResult[]> {
    const selections = results.flatMap((result) =>
      result.assignedRobots.map((robot) => ({
        type: robot.type.name,
        source: robot.source,
        count: 1,
      })),
    );

    await this.robotRepository.allocate(selections);
    for (const result of results) {
      await this.historyRepository.save(result, strategyName);
    }
    return results;
  }

  private withTransaction<T>(callback: () => Promise<T>): Promise<T> {
    return this.db ? this.db.immediateTransaction(callback) : callback();
  }
}
