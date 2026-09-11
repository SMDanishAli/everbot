import { SummaryFormatter } from '../../../src/cli/formatters/SummaryFormatter';

describe('SummaryFormatter', () => {
  it('formats aggregate totals and per-type statistics', () => {
    const output = SummaryFormatter.format({
      totalRobotsUsed: 3,
      totalCost: 9,
      totalHoursProvided: 16,
      totalExcessHours: 1,
      byType: {
        Bravo: { count: 2, hoursProvided: 6 },
        Delta: { count: 1, hoursProvided: 8 },
      },
    });

    expect(output).toContain('=== Allocation Summary ===');
    expect(output).toContain('Total robots used: 3');
    expect(output).toContain('Total cost: $9');
    expect(output).toContain('Total excess hours: 1');
    expect(output).toContain('  Bravo: 2 robots, 6h provided');
    expect(output).toContain('  Delta: 1 robots, 8h provided');
  });
});
