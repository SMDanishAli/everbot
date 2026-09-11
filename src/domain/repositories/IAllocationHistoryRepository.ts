import { AllocationResult } from '../entities/AllocationResult';

export interface IAllocationHistoryRepository {
  save(result: AllocationResult, strategyName: string): Promise<void>;
  clear(): Promise<void>;

  /** Returns all persisted allocation-history rows for reporting. */
  findAll(): Promise<AllocationHistoryRecord[]>;

  /** Returns allocation history rows created on or after the given ISO date/time. */
  findSince(isoTimestamp: string): Promise<AllocationResult[]>;
}

export interface AllocationHistoryRecord {
  id: number;
  allocationId: number;
  hoursRequested: number;
  strategyName: string;
  type: string;
  source: string;
  totalHoursProvided: number;
  totalCost: number;
  createdAt: string;
}