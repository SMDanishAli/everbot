import { AllocationResult } from '../domain/entities/AllocationResult';

/** Small, single-responsibility calculators keep strategies focused on selection logic only. */
export class CostCalculator {
  static totalCost(result: AllocationResult): number {
    return result.totalCost;
  }

  static costDifference(a: AllocationResult, b: AllocationResult): number {
    return Math.abs(this.totalCost(a) - this.totalCost(b));
  }
}
