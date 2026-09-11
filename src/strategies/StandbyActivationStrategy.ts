import { Robot } from '../domain/entities/Robot';
import { ClientRequest } from '../domain/entities/ClientRequest';
import { AllocationResult } from '../domain/entities/AllocationResult';
import { IAllocationStrategy } from './IAllocationStrategy';
import { CostOptimizedStrategy } from './CostOptimizedStrategy';
import { ZeroRobotsError, InsufficientCapacityError } from '../domain/errors';

/**
 * Level 3: Standby Activation Strategy (Decorator pattern).
 *
 * Wraps a base strategy (Level 1 or 2) that governs allocation from the
 * ACTIVE fleet. Standby only gets activated when active capacity, taken as
 * a whole, is insufficient to cover the request — per spec: "Activate when
 * client hours exceed active capacity." That threshold is capacity-only,
 * not a preference: if the full active fleet combined still falls short,
 * every active robot is necessarily part of the answer (none can be left
 * idle), so there's nothing left for `baseStrategy` to optimise once we're
 * in shortfall territory — only the standby top-up remains to be decided.
 *
 * The standby top-up is always cost-optimised, regardless of which base
 * strategy is wrapped (spec: "Choose the cost-optimised standby option" —
 * this is a fixed Level 3 rule, not delegated to the base strategy choice).
 * Reuses CostOptimizedStrategy against the standby pool for exactly the
 * shortfall amount, so the same min-cost knapsack logic isn't duplicated.
 */
export class StandbyActivationStrategy implements IAllocationStrategy {
  readonly name: string;

  private readonly standbyOptimizer = new CostOptimizedStrategy();

  constructor(
    private readonly baseStrategy: IAllocationStrategy,
    private readonly standbyRobots: Robot[],
  ) {
    this.name = `${baseStrategy.name} + Standby Activation (Level 3)`;
  }

  allocate(availableRobots: Robot[], request: ClientRequest): AllocationResult {
    if (availableRobots.length === 0 && this.standbyRobots.length === 0) {
      throw new ZeroRobotsError();
    }

    const totalActiveHours = availableRobots.reduce((sum, r) => sum + r.workingHours, 0);

    if (totalActiveHours >= request.hoursRequested) {
      // Active fleet alone can cover it — standby isn't needed at all.
      return this.baseStrategy.allocate(availableRobots, request);
    }

    const shortfall = request.hoursRequested - totalActiveHours;

    if (this.standbyRobots.length === 0) {
      throw new InsufficientCapacityError();
    }

    const standbySelection = this.standbyOptimizer.allocate(
      this.standbyRobots,
      new ClientRequest(shortfall, request.clientId),
    );

    // Mutate the held standby pool in place so a later call (e.g. the next
    // client in MultiClientAllocator) sees a correctly depleted pool. The
    // `readonly` modifier only prevents reassigning this.standbyRobots
    // itself — mutating its contents is fine and is exactly what's needed
    // for this strategy instance to remain correct across repeated calls.
    const usedStandby = new Set(standbySelection.assignedRobots);
    const remainingStandby = this.standbyRobots.filter((r) => !usedStandby.has(r));
    this.standbyRobots.length = 0;
    this.standbyRobots.push(...remainingStandby);

    const assignedRobots = [...availableRobots, ...standbySelection.assignedRobots];

    return new AllocationResult(request.clientId, request.hoursRequested, assignedRobots);
  }
}