import { Robot } from '../domain/entities/Robot';
import { ClientRequest } from '../domain/entities/ClientRequest';
import { AllocationResult } from '../domain/entities/AllocationResult';
import { IAllocationStrategy } from './IAllocationStrategy';
import { ZeroRobotsError, InsufficientCapacityError } from '../domain/errors';

/**
 * L1 - Category Distribution Strategy.
 *
 * Minimises excess hours and, when tied, prefers allocations using more
 * categories. This keeps category diversity without forcing unnecessary robots
 * into small requests.
 * Enumerates bounded counts per robot type, rather than individual robot
 * subsets. With a fixed number of types this is polynomial in inventory size.
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

  private findBestSelection(robots: Robot[], requestedHours: number): Robot[] | null {
    let best: Robot[] | null = null;
    const groups = Array.from(
      robots.reduce((byType, robot) => {
        const group = byType.get(robot.type.name) ?? [];
        group.push(robot);
        byType.set(robot.type.name, group);
        return byType;
      }, new Map<string, Robot[]>()),
    );

    const consider = (selection: Robot[], totalHours: number): void => {
      if (totalHours < requestedHours) return;

      const bestTotal = best?.reduce((sum, robot) => sum + robot.workingHours, 0);
      const excess = totalHours - requestedHours;
      const bestExcess = bestTotal === undefined ? Infinity : bestTotal - requestedHours;
      const categories = new Set(selection.map((robot) => robot.type.name)).size;
      const bestCategories = best ? new Set(best.map((robot) => robot.type.name)).size : -1;

      if (
        excess < bestExcess ||
        (excess === bestExcess && categories > bestCategories) ||
        (excess === bestExcess &&
          categories === bestCategories &&
          selection.length < (best?.length ?? Infinity))
      ) {
        best = [...selection];
      }
    };

    let candidates: Array<{ selection: Robot[]; totalHours: number }> = [
      { selection: [], totalHours: 0 },
    ];
    for (const [, group] of groups) {
      const typeHours = group[0].workingHours;
      const nextCandidates: Array<{ selection: Robot[]; totalHours: number }> = [];
      for (const candidate of candidates) {
        for (let count = 0; count <= group.length; count++) {
          nextCandidates.push({
            selection: candidate.selection.concat(group.slice(0, count)),
            totalHours: candidate.totalHours + count * typeHours,
          });
        }
      }
      candidates = nextCandidates;
    }

    for (const candidate of candidates) {
      consider(candidate.selection, candidate.totalHours);
    }
    return best;
  }
}
