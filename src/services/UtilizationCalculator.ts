import { AllocationResult } from '../domain/entities/AllocationResult';

export interface UtilizationSummary {
  totalRobotsUsed: number;
  totalCost: number;
  totalHoursProvided: number;
  totalExcessHours: number;
  byType: Record<string, { count: number; hoursProvided: number }>;
}

/** Aggregates one or more AllocationResults into summary statistics (bonus feature). */
export class UtilizationCalculator {
  static summarize(results: AllocationResult[]): UtilizationSummary {
    const summary: UtilizationSummary = {
      totalRobotsUsed: 0,
      totalCost: 0,
      totalHoursProvided: 0,
      totalExcessHours: 0,
      byType: {},
    };

    for (const result of results) {
      summary.totalRobotsUsed += result.assignedRobots.length;
      summary.totalCost += result.totalCost;
      summary.totalHoursProvided += result.totalHoursProvided;
      summary.totalExcessHours += result.excessHours;

      for (const robot of result.assignedRobots) {
        const entry = summary.byType[robot.type.name] ?? { count: 0, hoursProvided: 0 };
        entry.count += 1;
        entry.hoursProvided += robot.workingHours;
        summary.byType[robot.type.name] = entry;
      }
    }

    return summary;
  }
}
