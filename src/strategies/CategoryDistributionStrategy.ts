import { Robot } from '../domain/entities/Robot';
import { ClientRequest } from '../domain/entities/ClientRequest';
import { AllocationResult } from '../domain/entities/AllocationResult';
import { IAllocationStrategy } from './IAllocationStrategy';
import { ZeroRobotsError, InsufficientCapacityError } from '../domain/errors';

/**
 * L1 - Category Distribution Strategy.
 *
 * Minimises excess hours and, when tied, prefers allocations using more
 * categories, then fewer robots.
 *
 * Implemented as a bounded-knapsack DP over (robot type x total hours)
 * polynomial complexity.
 */
export class CategoryDistributionStrategy implements IAllocationStrategy {
  readonly name = 'Category Distribution (Level 1)';

  allocate(availableRobots: Robot[], request: ClientRequest): AllocationResult {
    if (availableRobots.length === 0) {
      throw new ZeroRobotsError();
    }

    const selected = this.findBestSelection(availableRobots, request.hoursRequested);
    if (!selected) {
      throw new InsufficientCapacityError();
    }

    return new AllocationResult(request.clientId, request.hoursRequested, selected);
  }

  /**
   * dp[h] tracks, for each total-hours value h reachable using the groups
   * processed so far, the best (categories used, robots used) pair —
   * "best" meaning most categories, then fewest robots. Excess hours itself
   * doesn't need to live in the DP state: since excess = h - requestedHours,
   * picking the smallest reachable h >= requestedHours after the DP finishes
   * is equivalent to minimising excess directly.
   */
  private findBestSelection(robots: Robot[], requestedHours: number): Robot[] | null {
    const groups = Array.from(
      robots.reduce((byType, robot) => {
        const group = byType.get(robot.type.name) ?? [];
        group.push(robot);
        byType.set(robot.type.name, group);
        return byType;
      }, new Map<string, Robot[]>()),
    );

    const maxHours = groups.reduce(
      (sum, [, group]) => sum + group.length * group[0].workingHours,
      0,
    );

    if (maxHours < requestedHours) {
      return null;
    }

    const UNREACHABLE = -1;
    let dpCategories: number[] = new Array(maxHours + 1).fill(UNREACHABLE);
    let dpCount: number[] = new Array(maxHours + 1).fill(0);
    dpCategories[0] = 0; // 0 hours, 0 categories, 0 robots: the empty selection.

    // choices[groupIndex][h] = how many robots of that group were picked to
    // reach total h, so the winning selection can be reconstructed afterwards.
    const choices: number[][] = [];

    for (const [, group] of groups) {
      const hoursPerRobot = group[0].workingHours;
      const fleetSize = group.length;

      const nextCategories = new Array(maxHours + 1).fill(UNREACHABLE);
      const nextCount = new Array(maxHours + 1).fill(0);
      const choiceForGroup = new Array(maxHours + 1).fill(0);

      for (let h = 0; h <= maxHours; h++) {
        for (let k = 0; k <= fleetSize && k * hoursPerRobot <= h; k++) {
          const prevH = h - k * hoursPerRobot;
          if (dpCategories[prevH] === UNREACHABLE) continue;

          const categories = dpCategories[prevH] + (k > 0 ? 1 : 0);
          const count = dpCount[prevH] + k;

          const better =
            nextCategories[h] === UNREACHABLE ||
            categories > nextCategories[h] ||
            (categories === nextCategories[h] && count < nextCount[h]);

          if (better) {
            nextCategories[h] = categories;
            nextCount[h] = count;
            choiceForGroup[h] = k;
          }
        }
      }

      dpCategories = nextCategories;
      dpCount = nextCount;
      choices.push(choiceForGroup);
    }

    let bestH = -1;
    for (let h = requestedHours; h <= maxHours; h++) {
      if (dpCategories[h] !== UNREACHABLE) {
        bestH = h;
        break;
      }
    }
    if (bestH === -1) {
      return null;
    }

    // Backtrack through `choices` to recover how many robots of each type
    // were used to reach bestH, then materialise the actual Robot instances.
    const countsPerGroup = new Array(groups.length).fill(0);
    let h = bestH;
    for (let i = groups.length - 1; i >= 0; i--) {
      const hoursPerRobot = groups[i][1][0].workingHours;
      const k = choices[i][h];
      countsPerGroup[i] = k;
      h -= k * hoursPerRobot;
    }

    return groups.flatMap(([, group], i) => group.slice(0, countsPerGroup[i]));
  }
}