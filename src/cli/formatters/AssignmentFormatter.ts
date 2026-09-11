import { AllocationResult } from '../../domain/entities/AllocationResult';

export class AssignmentFormatter {
  static format(result: AllocationResult, strategyName: string): string {
    const lines = [`Strategy: ${strategyName}`, `Client: ${result.clientId}`, `Hours requested: ${result.hoursRequested}`, ''];

    const counts = new Map<string, number>();
    for (const robot of result.assignedRobots) {
      counts.set(robot.type.name, (counts.get(robot.type.name) ?? 0) + 1);
    }

    for (const [type, count] of counts.entries()) {
      lines.push(`  ${type}: ${count}`);
    }

    lines.push(
      '',
      `Total hours provided: ${result.totalHoursProvided}`,
      `Excess hours: ${result.excessHours}`,
      `Total cost: $${result.totalCost}`,
    );

    return lines.join('\n');
  }
}
