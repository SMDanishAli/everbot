import { AllocationResult } from '../entities/AllocationResult';

export interface IAllocationHistoryRepository {
  save(result: AllocationResult, strategyName: string): Promise<void>;
  clear(): Promise<void>;

  /** Returns all persisted allocation-history rows for reporting. */
  findAll(): Promise<AllocationHistoryRecord[]>;

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