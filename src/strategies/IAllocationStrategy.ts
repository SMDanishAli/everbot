import { Robot } from '../domain/entities/Robot';
import { ClientRequest } from '../domain/entities/ClientRequest';
import { AllocationResult } from '../domain/entities/AllocationResult';

/**
 * Strategy pattern contract shared by every allocation level (1-4).
 * Implementations are pure: given an available robot pool and a request,
 * return a result or throw a DomainError. No I/O, no logging, no CLI concerns.
 */
export interface IAllocationStrategy {
  readonly name: string;

  allocate(availableRobots: Robot[], request: ClientRequest): AllocationResult;
}
