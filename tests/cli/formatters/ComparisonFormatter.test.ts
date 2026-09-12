import { AllocationResult } from '../../../src/domain/entities/AllocationResult';
import { ComparisonFormatter } from '../../../src/cli/formatters/ComparisonFormatter';
import { ComparisonReport } from '../../../src/services/AllocationComparator';

describe('ComparisonFormatter', () => {
  const result = new AllocationResult('client-1', 3, []);

  it.each([
    [
      'costOptimized',
      'Level 1 strategy resulted in $2 additional cost due to mandatory usage of multiple robot categories.',
    ],
    [
      'categoryDistribution',
      'Level 2 strategy resulted in $2 additional cost due to cost optimisation trade-offs.',
    ],
    ['equal', 'Level 1 and Level 2 strategies resulted in the same cost.'],
  ] as const)('formats the %s insight', (cheaper, insight) => {
    const report: ComparisonReport = {
      categoryDistribution: result,
      costOptimized: result,
      costDifference: 2,
      cheaper,
    };

    const formatted = ComparisonFormatter.format(report);

    expect(formatted).toContain('Level 1 Cost: $0');
    expect(formatted).toContain('Level 2 Cost: $0');
    expect(formatted).toContain('Difference: $2');
    expect(formatted).toContain(`Insight: ${insight}`);
  });
});
