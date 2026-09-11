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

    const search = (index: number, selection: Robot[], totalHours: number): void => {
      if (index === robots.length) {
        consider(selection, totalHours);
        return;
      }

      search(index + 1, selection, totalHours);
      search(index + 1, [...selection, robots[index]], totalHours + robots[index].workingHours);
    };

    search(0, [], 0);
    return best;
  }
}
