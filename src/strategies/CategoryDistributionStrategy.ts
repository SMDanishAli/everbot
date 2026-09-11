import { Robot } from '../domain/entities/Robot';
import { ClientRequest } from '../domain/entities/ClientRequest';
import { AllocationResult } from '../domain/entities/AllocationResult';
import { IAllocationStrategy } from './IAllocationStrategy';
import { ZeroRobotsError, InsufficientCapacityError } from '../domain/errors';

/**
 * Level 1: Category Distribution Strategy.
 *
 * Primary goal (mandatory, not optional): include one robot from every
 * category that has availability, regardless of whether that's the most
 * efficient choice — this is what makes Level 1 more expensive than Level 2
 * for the same request (see spec's Level 1 vs Level 2 comparison).
 *
 * Secondary goal: once the mandatory base is assigned, cover any remaining
 * shortfall by repeatedly adding whichever available robot minimises excess
 * hours — or, if no single robot can close the gap yet, the one that
 * reduces the shortfall the most, and repeat.
 */
export class CategoryDistributionStrategy implements IAllocationStrategy {
  readonly name = 'Category Distribution (Level 1)';

  allocate(availableRobots: Robot[], request: ClientRequest): AllocationResult {
    if (availableRobots.length === 0) {
      throw new ZeroRobotsError();
    }

    const pools = this.groupByType(availableRobots);
    const selected: Robot[] = [];

    // Mandatory base: one robot per available category.
    for (const pool of pools.values()) {
      const robot = pool.shift();
      if (robot) {
        selected.push(robot);
      }
    }

    let totalHours = this.sumHours(selected);

    while (totalHours < request.hoursRequested) {
      const shortfall = request.hoursRequested - totalHours;
      const nextType = this.pickBestCandidate(pools, shortfall);

      if (!nextType) {
        throw new InsufficientCapacityError();
      }

      const pool = pools.get(nextType) as Robot[];
      const robot = pool.shift() as Robot;
      selected.push(robot);
      totalHours += robot.workingHours;
    }

    return new AllocationResult(request.clientId, request.hoursRequested, selected);
  }

  private groupByType(robots: Robot[]): Map<string, Robot[]> {
    const pools = new Map<string, Robot[]>();
    for (const robot of robots) {
      const list = pools.get(robot.type.name) ?? [];
      list.push(robot);
      pools.set(robot.type.name, list);
    }
    return pools;
  }

  private sumHours(robots: Robot[]): number {
    return robots.reduce((sum, robot) => sum + robot.workingHours, 0);
  }

  /**
   * Among types with at least one robot remaining: prefer the smallest robot
   * that covers the shortfall in one step (minimises excess hours). If none
   * can close the gap alone, fall back to the largest available robot, which
   * reduces the shortfall the most per unit added.
   */
  private pickBestCandidate(pools: Map<string, Robot[]>, shortfall: number): string | null {
    const availableTypes = Array.from(pools.entries()).filter(([, robots]) => robots.length > 0);
    if (availableTypes.length === 0) {
      return null;
    }

    const covering = availableTypes.filter(([, robots]) => robots[0].workingHours >= shortfall);

    if (covering.length > 0) {
      covering.sort((a, b) => a[1][0].workingHours - b[1][0].workingHours);
      return covering[0][0];
    }

    const sortedByHoursDesc = [...availableTypes].sort(
      (a, b) => b[1][0].workingHours - a[1][0].workingHours,
    );
    return sortedByHoursDesc[0][0];
  }
}