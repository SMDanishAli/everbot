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
 * Implemented as a BOUNDED knapsack over per-(type, source) counts, not over
 * individual robot instances. Same-type robots are interchangeable, so the
 * DP only needs to decide "how many of this type", not "which specific one" —
 * that decision is applied afterwards by simply taking the first N instances
 * from that group.
 
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

    const groups = this.groupByTypeAndSource(availableRobots);
    const maxHours = groups.reduce(
      (max, group) => Math.max(max, group.robots[0].workingHours),
      0,
    );
    const range = Math.min(request.hoursRequested + maxHours, totalAvailableHours);

    const selected = this.solveMinCostBoundedKnapsack(groups, request.hoursRequested, range);

    return new AllocationResult(request.clientId, request.hoursRequested, selected);
  }

  private groupByTypeAndSource(robots: Robot[]): Array<{ key: string; robots: Robot[] }> {
    const byKey = robots.reduce((map, robot) => {
      const key = `${robot.type.name}:${robot.source}`;
      const group = map.get(key) ?? [];
      group.push(robot);
      map.set(key, group);
      return map;
    }, new Map<string, Robot[]>());

    return Array.from(byKey, ([key, groupRobots]) => ({ key, robots: groupRobots }));
  }

  /**
   * dpCost[h] = minimum cost to reach EXACTLY h hours using the groups
   * processed so far (Infinity if unreachable). Each group contributes a
   * bounded count 0..fleetSize, chosen all at once per h, rather than one
   * robot at a time — so distinct robot instances of the same type never
   * cause separate DP rows.
   */
  private solveMinCostBoundedKnapsack(
    groups: Array<{ key: string; robots: Robot[] }>,
    hoursRequested: number,
    range: number,
  ): Robot[] {
    const INF = Number.POSITIVE_INFINITY;

    let dpCost: number[] = new Array(range + 1).fill(INF);
    dpCost[0] = 0;

    // choices[groupIndex][h] = how many robots of that group were picked to
    // reach total h, used to reconstruct the selection afterwards.
    const choices: number[][] = [];

    for (const group of groups) {
      const hoursPerRobot = group.robots[0].workingHours;
      const costPerRobot = group.robots[0].chargingCost;
      const fleetSize = group.robots.length;

      const nextCost = new Array(range + 1).fill(INF);
      const choiceForGroup = new Array(range + 1).fill(0);

      for (let h = 0; h <= range; h++) {
        for (let k = 0; k <= fleetSize && k * hoursPerRobot <= h; k++) {
          const prevH = h - k * hoursPerRobot;
          if (dpCost[prevH] === INF) continue;

          const cost = dpCost[prevH] + k * costPerRobot;
          if (cost < nextCost[h]) {
            nextCost[h] = cost;
            choiceForGroup[h] = k;
          }
        }
      }

      dpCost = nextCost;
      choices.push(choiceForGroup);
    }

    // Scan ascending so the first (smallest, i.e. least-excess) hour total
    // achieving the minimum cost wins ties — matches the spec's Example 2.
    let bestCost = INF;
    let bestHours = -1;
    for (let h = hoursRequested; h <= range; h++) {
      if (dpCost[h] < bestCost) {
        bestCost = dpCost[h];
        bestHours = h;
      }
    }

    if (bestHours === -1) {
      // Guarded by the totalAvailableHours check in allocate(); defensive fallback.
      throw new InsufficientCapacityError();
    }

    return this.reconstruct(groups, choices, bestHours);
  }

  private reconstruct(
    groups: Array<{ key: string; robots: Robot[] }>,
    choices: number[][],
    targetHours: number,
  ): Robot[] {
    const selected: Robot[] = [];
    let h = targetHours;

    for (let i = groups.length - 1; i >= 0; i--) {
      const hoursPerRobot = groups[i].robots[0].workingHours;
      const k = choices[i][h];
      selected.push(...groups[i].robots.slice(0, k));
      h -= k * hoursPerRobot;
    }

    return selected;
  }
}