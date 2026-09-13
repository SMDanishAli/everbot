import { ClientRequest } from '../domain/entities/ClientRequest';
import { AllocationResult } from '../domain/entities/AllocationResult';
import { IAllocationStrategy } from '../strategies/IAllocationStrategy';
import { IAllocationReservationRepository } from '../domain/repositories/IAllocationReservationRepository';
import { IAllocationHistoryRepository } from '../domain/repositories/IAllocationHistoryRepository';
import { InventoryService } from './InventoryService';
import { DomainError } from '../domain/errors';
import { ILogger } from '../infrastructure/logging/ILogger';
import { MultiClientAllocator } from '../strategies/MultiClientAllocator';
import { AppDatabase } from '../infrastructure/db/Database';

export interface ComparisonReport {
  categoryDistribution: AllocationResult;
  costOptimized: AllocationResult;
  costDifference: number;
  cheaper: 'categoryDistribution' | 'costOptimized' | 'equal';
}

const compareAllocations = (
  categoryDistribution: AllocationResult,
  costOptimized: AllocationResult,
): ComparisonReport => {
  const costDifference = categoryDistribution.totalCost - costOptimized.totalCost;
  return {
    categoryDistribution,
    costOptimized,
    costDifference: Math.abs(costDifference),
    cheaper:
      costDifference === 0
        ? 'equal'
        : costDifference > 0
          ? 'costOptimized'
          : 'categoryDistribution',
  };
};

/**
 * Run the given strategy, persist the result + updated inventory, log the outcome.
 */
export class AllocationService {
  constructor(
    private readonly inventoryService: InventoryService,
    private readonly reservationRepository: IAllocationReservationRepository,
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
  ): Promise<{ result: AllocationResult; comparison?: ComparisonReport }> {
    try {
      return await this.withTransaction(async () => {
        const availableRobots = await this.inventoryService.getAvailableRobots();
        // Compute the primary (requested) strategy's result first: comparison
        // strategies are informational only and, since Level 1/2 never draw on
        // standby, they legitimately can't cover a request that only Level 3's
        // standby activation can fulfil. That must not block the real result.
        const result = strategy.allocate(availableRobots, request);
        const comparison = this.tryCompare(
          () => comparisonStrategy.allocate(availableRobots, request),
          () =>
            comparisonTargetStrategy === strategy
              ? result
              : comparisonTargetStrategy.allocate(availableRobots, request),
        );
        await this.persistAllocation(result, strategy.name);
        return { result, comparison };
      });
    } catch (err) {
      this.logAllocationError(err, 'Allocation');
      throw err;
    }
  }

  /**
   * Runs the two comparison-side allocations and pairs them up, but treats an
   * expected domain failure (e.g. InsufficientCapacityError when the request
   * exceeds active-only capacity) as "no comparison available" rather than
   * failing the whole operation — the primary result may still be valid even
   * when the Level 1/2 baselines alone can't cover the request.
   */
  private tryCompare(
    getCategoryDistribution: () => AllocationResult,
    getCostOptimized: () => AllocationResult,
  ): ComparisonReport | undefined {
    try {
      return compareAllocations(getCategoryDistribution(), getCostOptimized());
    } catch (err) {
      if (err instanceof DomainError) {
        return undefined;
      }
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
    comparisons: Array<ComparisonReport | undefined>;
  }> {
    try {
      return await this.withTransaction(async () => {
        const availableRobots = await this.inventoryService.getAvailableRobots();
        // Compute the primary (requested) strategy's results first: the
        // comparison strategies are informational only, and since Level 1/2
        // never draw on standby they legitimately can't cover a batch that
        // only Level 3's standby activation can fulfil. That must not block
        // the real results.
        const results = new MultiClientAllocator(strategy).allocateAll(availableRobots, requests);
        await this.persistMany(results, strategy.name);
        const comparisons = this.tryCompareMany(
          () => new MultiClientAllocator(comparisonStrategy).allocateAll(availableRobots, requests),
          () =>
            new MultiClientAllocator(comparisonTargetStrategy).allocateAll(availableRobots, requests),
          results,
        );
        return { results, comparisons };
      });
    } catch (err) {
      this.logAllocationError(err, 'Multi-client allocation');
      throw err;
    }
  }

  /**
   * Batch counterpart to tryCompare: if either comparison-strategy batch
   * can't be computed (e.g. a client's request exceeds active-only capacity),
   * every entry falls back to "no comparison available" rather than failing
   * the whole multi-client allocation.
   */
  private tryCompareMany(
    getCategoryDistributionResults: () => AllocationResult[],
    getCostOptimizedResults: () => AllocationResult[],
    results: AllocationResult[],
  ): Array<ComparisonReport | undefined> {
    try {
      const level1ByClient = new Map(
        getCategoryDistributionResults().map((result) => [result.clientId, result]),
      );
      const level2ByClient = new Map(
        getCostOptimizedResults().map((result) => [result.clientId, result]),
      );
      return results.map((result) => {
        const level1 = level1ByClient.get(result.clientId);
        const level2 = level2ByClient.get(result.clientId);
        return level1 && level2 ? compareAllocations(level1, level2) : undefined;
      });
    } catch (err) {
      if (err instanceof DomainError) {
        return results.map(() => undefined);
      }
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
    await this.reservationRepository.allocate(
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

    await this.reservationRepository.allocate(selections);
    for (const result of results) {
      await this.historyRepository.save(result, strategyName);
    }
    return results;
  }

  private withTransaction<T>(callback: () => Promise<T>): Promise<T> {
    return this.db ? this.db.immediateTransaction(callback) : callback();
  }
}
