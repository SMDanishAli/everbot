import { Robot } from '../domain/entities/Robot';
import { ClientRequest } from '../domain/entities/ClientRequest';
import { AllocationResult } from '../domain/entities/AllocationResult';
import { IAllocationStrategy } from './IAllocationStrategy';

/**
 * Level 4: Multi-Client Allocation (Facade/Orchestrator over IAllocationStrategy).
 *
 * Prioritises clients by highest hours requested first (spec: "Prioritise
 * allocation based on highest hours requested"), then allocates each request
 * in turn against a SHARED, depleting pool of robots — once a robot is
 * assigned to one client it's removed from the pool so it can't be
 * double-booked to a later client in the same run.
 *
 */
export class MultiClientAllocator {
  constructor(private readonly strategy: IAllocationStrategy) {}

  allocateAll(availableRobots: Robot[], requests: ClientRequest[]): AllocationResult[] {
    
    const pool = [...availableRobots];
    const prioritized = [...requests].sort((a, b) => b.hoursRequested - a.hoursRequested);

    const results: AllocationResult[] = [];

    for (const request of prioritized) {
      const result = this.strategy.allocate(pool, request);
      results.push(result);
      this.removeAssigned(pool, result.assignedRobots);
    }

    return results;
  }

  /** Removes the specific Robot instances just assigned from the shared pool, by reference. */
  private removeAssigned(pool: Robot[], assigned: Robot[]): void {
    const used = new Set(assigned);
    let writeIndex = 0;

    for (let readIndex = 0; readIndex < pool.length; readIndex++) {
      const robot = pool[readIndex];
      if (used.has(robot)) {
        used.delete(robot); // only remove one occurrence per assigned reference
        continue;
      }
      pool[writeIndex] = robot;
      writeIndex++;
    }

    pool.length = writeIndex;
  }
}