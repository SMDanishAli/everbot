import { AllocationResult } from '../../domain/entities/AllocationResult';

export class MultiClientSummaryFormatter {
  static format(results: AllocationResult[]): string {
    const totalRobots = results.reduce(
      (total, result) => total + result.assignedRobots.length,
      0,
    );
    const totalCost = results.reduce((total, result) => total + result.totalCost, 0);
    const totalProvided = results.reduce((total, result) => total + result.totalHoursProvided, 0);
    const averageUtilization =
      results.length === 0
        ? 0
        : results.reduce(
            (total, result) =>
              total +
              (result.totalHoursProvided === 0
                ? 0
                : (result.hoursRequested / result.totalHoursProvided) * 100),
            0,
          ) / results.length;

    const byType = new Map<string, number>();
    for (const result of results) {
      for (const robot of result.assignedRobots) {
        byType.set(
          robot.type.name,
          (byType.get(robot.type.name) ?? 0) + robot.workingHours,
        );
      }
    }

    const lines = [
      '=== Multi-client Summary ===',
      `Total robots used: ${totalRobots}`,
      `Total cost: $${totalCost}`,
      `Average utilisation: ${averageUtilization.toFixed(1)}%`,
      'Per-type utilisation:',
    ];

    for (const [type, hoursProvided] of [...byType.entries()].sort(([left], [right]) =>
      left.localeCompare(right),
    )) {
      const utilization = totalProvided === 0 ? 0 : (hoursProvided / totalProvided) * 100;
      lines.push(`  ${type}: ${utilization.toFixed(1)}%`);
    }

    return lines.join('\n');
  }
}
