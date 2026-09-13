import { Robot, RobotSource } from '../domain/entities/Robot';
import { ClientRequest } from '../domain/entities/ClientRequest';
import { AllocationResult, StandbyOption } from '../domain/entities/AllocationResult';
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
 * Reuses CostOptimizedStrategy's allocateFromPool against the standby pool
 * for exactly the shortfall amount, so the same min-cost knapsack logic
 * isn't duplicated (allocate() itself would reject a STANDBY-only pool,
 * since Level 2 on its own never draws from standby).
 *
 * The strategy is stateless: the caller owns pool depletion and passes the
 * currently available active and standby robots on every allocation.
 */
export class StandbyActivationStrategy implements IAllocationStrategy {
  readonly name: string;

  private readonly standbyOptimizer = new CostOptimizedStrategy();

  constructor(private readonly baseStrategy: IAllocationStrategy) {
    this.name = `${baseStrategy.name} + Standby Activation (Level 3)`;
  }

  allocate(availableRobots: Robot[], request: ClientRequest): AllocationResult {
    const activeRobots = availableRobots.filter((robot) => robot.source === RobotSource.ACTIVE);
    const standbyRobots = availableRobots.filter(
      (robot) => robot.source === RobotSource.STANDBY,
    );

    if (activeRobots.length === 0 && standbyRobots.length === 0) {
      throw new ZeroRobotsError();
    }

    const totalActiveHours = activeRobots.reduce((sum, r) => sum + r.workingHours, 0);

    if (totalActiveHours >= request.hoursRequested) {
      // Active fleet alone can cover it — standby isn't needed at all.
      return this.baseStrategy.allocate(activeRobots, request);
    }

    const shortfall = request.hoursRequested - totalActiveHours;

    if (standbyRobots.length === 0) {
      throw new InsufficientCapacityError();
    }

    const standbySelection = this.standbyOptimizer.allocateFromPool(
      standbyRobots,
      new ClientRequest(shortfall, request.clientId),
    );

    const assignedRobots = [...activeRobots, ...standbySelection.assignedRobots];
    const standbyAlternatives = this.findStandbyAlternatives(standbyRobots, shortfall);

    return new AllocationResult(
      request.clientId,
      request.hoursRequested,
      assignedRobots,
      standbyAlternatives,
    );
  }

  /**
   * Every standalone (single robot-type) way to cover the shortfall from the
   * standby pool, with its cost — spec: "Additional Standby Robots Required"
   * should list each option (e.g. Bravo:2 or Delta:1 or Charlie:1), not just
   * the cost-optimised one already reflected in the main allocation.
   */
  private findStandbyAlternatives(standbyRobots: Robot[], shortfall: number): StandbyOption[] {
    const groups = new Map<string, Robot[]>();
    for (const robot of standbyRobots) {
      const group = groups.get(robot.type.name) ?? [];
      group.push(robot);
      groups.set(robot.type.name, group);
    }

    const options: StandbyOption[] = [];
    for (const [type, group] of groups) {
      const count = Math.ceil(shortfall / group[0].workingHours);
      if (count <= group.length) {
        options.push({ type, count, cost: count * group[0].chargingCost });
      }
    }

    return options.sort((left, right) => left.type.localeCompare(right.type));
  }
}