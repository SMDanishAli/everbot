import { AllocationResult } from '../entities/AllocationResult';

export interface IAllocationHistoryRepository {
  save(result: AllocationResult, strategyName: string): Promise<void>;

  /** Returns allocation history rows created on or after the given ISO date/time. */
  findSince(isoTimestamp: string): Promise<AllocationResult[]>;
}