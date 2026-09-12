import { ComparisonReport } from '../../services/AllocationComparator';

export class ComparisonFormatter {
  static format(report: ComparisonReport): string {
    const insight =
      report.cheaper === 'costOptimized'
        ? `Level 1 strategy resulted in $${report.costDifference} additional cost due to mandatory usage of multiple robot categories.`
        : report.cheaper === 'categoryDistribution'
          ? `Level 2 strategy resulted in $${report.costDifference} additional cost due to cost optimisation trade-offs.`
          : 'Level 1 and Level 2 strategies resulted in the same cost.';

    return [
      '=== Level 1 vs Level 2 ===',
      `Level 1 Cost: $${report.categoryDistribution.totalCost}`,
      `Level 2 Cost: $${report.costOptimized.totalCost}`,
      `Difference: $${report.costDifference}`,
      `Insight: ${insight}`,
    ].join('\n');
  }
}
