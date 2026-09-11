import { UtilizationSummary } from '../../services/UtilizationCalculator';

export class SummaryFormatter {
  static format(summary: UtilizationSummary): string {
    const lines = [
      '=== Allocation Summary ===',
      `Total robots used: ${summary.totalRobotsUsed}`,
      `Total cost: $${summary.totalCost}`,
      `Total hours provided: ${summary.totalHoursProvided}`,
      `Total excess hours: ${summary.totalExcessHours}`,
      '',
      'By type:',
    ];

    for (const [type, stats] of Object.entries(summary.byType)) {
      lines.push(`  ${type}: ${stats.count} robots, ${stats.hoursProvided}h provided`);
    }

    return lines.join('\n');
  }
}
