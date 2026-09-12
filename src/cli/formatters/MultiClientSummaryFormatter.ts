import { AllocationResult } from '../../domain/entities/AllocationResult';

export class MultiClientSummaryFormatter {
  static format(results: AllocationResult[], capacityByType: Record<string, number>): string {
    const totalRobots = results.reduce(
      (total, result) => total + result.assignedRobots.length,
      0,
    );
    const totalCost = results.reduce((total, result) => total + result.totalCost, 0);
    const totalProvided = results.reduce((total, result) => total + result.totalHoursProvided, 0);
    const totalCapacity = Object.values(capacityByType).reduce((total, capacity) => total + capacity, 0);
    const averageUtilization = totalCapacity === 0 ? 0 : (totalProvided / totalCapacity) * 100;

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

    for (const type of Object.keys(capacityByType).sort((left, right) => left.localeCompare(right))) {
      const hoursProvided = byType.get(type) ?? 0;
      const capacity = capacityByType[type];
      const utilization = capacity === 0 ? 0 : (hoursProvided / capacity) * 100;
      lines.push(`  ${type}: ${utilization.toFixed(1)}%`);
    }

    for (const [type, hoursProvided] of [...byType.entries()].filter(([type]) => !(type in capacityByType)).sort(([left], [right]) =>
      left.localeCompare(right),
    )) {
      lines.push(`  ${type}: ${hoursProvided > 0 ? '100.0' : '0.0'}%`);
    }

    return lines.join('\n');
  }
}
