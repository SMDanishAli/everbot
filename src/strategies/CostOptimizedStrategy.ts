import { Robot } from '../domain/entities/Robot';
import { ClientRequest } from '../domain/entities/ClientRequest';
import { AllocationResult } from '../domain/entities/AllocationResult';
import { IAllocationStrategy } from './IAllocationStrategy';
import { ZeroRobotsError, InsufficientCapacityError } from '../domain/errors';

/**
 * Level 2: Cost Optimized Strategy.
 *
 * Minimises total charging cost while still providing hours >= requested.
 * Ignores Level 1's "use multiple categories" rule entirely — cost is the
 * only primary objective. Excess hours only matter as a tie-breaker: among
 * solutions of equal minimum cost, the one that overshoots the least wins
 * (spec Example 2: Bravo x2 = 6h/$4 is chosen over Delta x1 = 8h/$4 — same
 * cost, less excess).
 *
 * Implemented as a 0/1 knapsack over individual robot instances (each robot
 * is a distinguishable item even though same-type robots are interchangeable):
 * minimise cost subject to total hours >= requested, solved with a standard
 * DP table, then reconstructed into the actual robot selection.
 *
 * Complexity: O(n * range) time and space, where n = available robot count
 * and range = hoursRequested + max single robot's hours. Fine at CLI/small
 * fleet scale; a very large fleet would warrant a per-type bounded-knapsack
 * variant instead of treating every robot as an individual item.
 */
export class CostOptimizedStrategy implements IAllocationStrategy {
  readonly name = 'Cost Optimized (Level 2)';

  allocate(availableRobots: Robot[], request: ClientRequest): AllocationResult {
    if (availableRobots.length === 0) {
      throw new ZeroRobotsError();
    }

    const totalAvailableHours = availableRobots.reduce((sum, r) => sum + r.workingHours, 0);
    if (totalAvailableHours < request.hoursRequested) {
      throw new InsufficientCapacityError();
    }

    const maxHours = availableRobots.reduce((max, r) => Math.max(max, r.workingHours), 0);
    const range = Math.min(request.hoursRequested + maxHours, totalAvailableHours);

    const selected = this.solveMinCostKnapsack(availableRobots, request.hoursRequested, range);

    return new AllocationResult(request.clientId, request.hoursRequested, selected);
  }

  /**
   * dp[i][h] = minimum cost to reach EXACTLY h hours using the first i robots
   * (Infinity if unreachable). Standard 0/1 knapsack.
   */
  private solveMinCostKnapsack(robots: Robot[], hoursRequested: number, range: number): Robot[] {
    const n = robots.length;
    const INF = Number.POSITIVE_INFINITY;

    const dp: number[][] = Array.from({ length: n + 1 }, () => new Array(range + 1).fill(INF));
    dp[0][0] = 0;

    for (let i = 1; i <= n; i++) {
      const robot = robots[i - 1];
      for (let h = 0; h <= range; h++) {
        dp[i][h] = dp[i - 1][h]; // option A: skip this robot

        if (h >= robot.workingHours) {
          const withRobot = dp[i - 1][h - robot.workingHours] + robot.chargingCost;
          if (withRobot < dp[i][h]) {
            dp[i][h] = withRobot; // option B: take this robot
          }
        }
      }
    }

    // Scan ascending so the first (smallest, i.e. least-excess) hour total
    // achieving the minimum cost wins ties — matches the spec's Example 2.
    let bestCost = INF;
    let bestHours = -1;
    for (let h = hoursRequested; h <= range; h++) {
      if (dp[n][h] < bestCost) {
        bestCost = dp[n][h];
        bestHours = h;
      }
    }

    if (bestHours === -1) {
      // Guarded by the totalAvailableHours check in allocate(); defensive fallback.
      throw new InsufficientCapacityError();
    }

    return this.reconstruct(robots, dp, bestHours);
  }

  private reconstruct(robots: Robot[], dp: number[][], targetHours: number): Robot[] {
    const selected: Robot[] = [];
    let h = targetHours;

    for (let i = robots.length; i > 0; i--) {
      if (dp[i][h] === dp[i - 1][h]) {
        continue; // robot i-1 wasn't used to reach this state
      }
      const robot = robots[i - 1];
      selected.push(robot);
      h -= robot.workingHours;
    }

    return selected;
  }
}