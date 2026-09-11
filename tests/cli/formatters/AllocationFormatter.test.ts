import { AllocationFormatter } from '../../../src/cli/formatters/AllocationFormatter';
import { AllocationHistoryRecord } from '../../../src/domain/repositories/IAllocationHistoryRepository';

describe('AllocationFormatter', () => {
  const record: AllocationHistoryRecord = {
    id: 1,
    allocationId: 1,
    hoursRequested: 5,
    strategyName: 'Cost Optimized (Level 2)',
    type: 'Bravo',
    source: 'ACTIVE',
    totalHoursProvided: 6,
    totalCost: 2,
    createdAt: '2026-09-11T12:00:00.000Z',
  };

  it('formats allocation history rows as a table', () => {
    const output = AllocationFormatter.format([record]);

    expect(output).toContain('=== Allocation History ===');
    expect(output).toContain('Allocation ID');
    expect(output).toContain('Cost Optimized (Level 2)');
    expect(output).toContain('$2');
    expect(output).toContain('2026-09-11T12:00:00.000Z');
  });

  it('formats an empty history table', () => {
    expect(AllocationFormatter.format([])).toContain('=== Allocation History ===');
  });
});
