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
   * Every distinct way to cover the shortfall from the standby pool, with
   * its cost — spec: "Additional Standby Robots Required" should list each
   * option (e.g. Bravo:2 or Delta:1 or Charlie:1), not just the
   * cost-optimised one already reflected in the main allocation. When the
   * shortfall is large enough that no single category alone suffices (e.g.
   * an 18h shortfall against a max-16h Delta stock), single-category options
   * alone would leave the list empty despite standby genuinely combining
   * categories — so every non-empty subset of categories is tried, each
   * solved as its own cost-optimised sub-problem via allocateFromPool, and
   * results that reduce to the same breakdown (e.g. a 3-category subset that
   * doesn't actually need the 3rd category) are deduplicated.
   *
   * Category counts here are small (a handful of robot types in practice),
   * so the 2^n - 1 subset enumeration is cheap; it would not scale to many
   * distinct categories.
   */
  private findStandbyAlternatives(standbyRobots: Robot[], shortfall: number): StandbyOption[] {
    const groups = new Map<string, Robot[]>();
    for (const robot of standbyRobots) {
      const group = groups.get(robot.type.name) ?? [];
      group.push(robot);
      groups.set(robot.type.name, group);
    }
    const types = [...groups.keys()];

    const options: StandbyOption[] = [];
    const seen = new Set<string>();

    for (let mask = 1; mask < 1 << types.length; mask++) {
      const subsetRobots = types
        .filter((_, index) => (mask & (1 << index)) !== 0)
        .flatMap((type) => groups.get(type)!);

      let selection;
      try {
        selection = this.standbyOptimizer.allocateFromPool(
          subsetRobots,
          new ClientRequest(shortfall, 'standby-alternative'),
        );
      } catch {
        continue; // This subset of categories can't cover the shortfall alone.
      }

      const breakdown = this.summarizeByType(selection.assignedRobots);
      const key = breakdown.map(({ type, count }) => `${type}:${count}`).join(',');
      if (seen.has(key)) continue;
      seen.add(key);

      options.push({ breakdown, cost: selection.totalCost });
    }

    return options.sort(
      (left, right) =>
        left.cost - right.cost ||
        left.breakdown.map((b) => b.type).join(',').localeCompare(right.breakdown.map((b) => b.type).join(',')),
    );
  }

  private summarizeByType(robots: Robot[]): Array<{ type: string; count: number }> {
    const counts = new Map<string, number>();
    for (const robot of robots) {
      counts.set(robot.type.name, (counts.get(robot.type.name) ?? 0) + 1);
    }
    return [...counts.entries()]
      .map(([type, count]) => ({ type, count }))
      .sort((left, right) => left.type.localeCompare(right.type));
  }
}