import { AllocationResult } from '../domain/entities/AllocationResult';

export interface ComparisonReport {
  categoryDistribution: AllocationResult;
  costOptimized: AllocationResult;
  costDifference: number;
  cheaper: 'categoryDistribution' | 'costOptimized' | 'equal';
}

/** Compares Level 1 vs Level 2 outcomes for the same request (spec's comparison requirement). */
export class AllocationComparator {
  static compare(
    categoryDistribution: AllocationResult,
    costOptimized: AllocationResult,
  ): ComparisonReport {
    const costDifference = categoryDistribution.totalCost - costOptimized.totalCost;

    return {
      categoryDistribution,
      costOptimized,
      costDifference: Math.abs(costDifference),
      cheaper: costDifference === 0 ? 'equal' : costDifference > 0 ? 'costOptimized' : 'categoryDistribution',
    };
  }
}
