import { AllocationResult } from '../../../src/domain/entities/AllocationResult';
import { Robot } from '../../../src/domain/entities/Robot';
import { RobotType } from '../../../src/domain/entities/RobotType';
import { MultiClientSummaryFormatter } from '../../../src/cli/formatters/MultiClientSummaryFormatter';

describe('MultiClientSummaryFormatter', () => {
  it('formats multi-client totals and per-type utilisation', () => {
    const bravo = new RobotType('Bravo', 3, 2);
    const delta = new RobotType('Delta', 8, 4);
    const output = MultiClientSummaryFormatter.format(
      [
        new AllocationResult('client-1', 3, [new Robot(bravo)]),
        new AllocationResult('client-2', 8, [new Robot(delta)]),
      ],
      { Bravo: 6, Delta: 16 },
    );

    expect(output).toContain('Total robots used: 2');
    expect(output).toContain('Total cost: $6');
    expect(output).toContain('Average utilisation: 50.0%');
    expect(output).toContain('Bravo: 50.0%');
    expect(output).toContain('Delta: 50.0%');
  });

  it('reports 0% utilisation for a type with zero configured capacity', () => {
    const bravo = new RobotType('Bravo', 3, 2);
    const output = MultiClientSummaryFormatter.format(
      [new AllocationResult('client-1', 3, [new Robot(bravo)])],
      { Bravo: 0 },
    );

    expect(output).toContain('Bravo: 0.0%');
  });

  it('reports 0% utilisation for a configured type that was never actually used', () => {
    const bravo = new RobotType('Bravo', 3, 2);
    const output = MultiClientSummaryFormatter.format(
      [new AllocationResult('client-1', 3, [new Robot(bravo)])],
      { Bravo: 6, Delta: 16 },
    );

    expect(output).toContain('Delta: 0.0%');
  });

  it('lists a used robot type at 100% when it has no configured capacity entry', () => {
    const bravo = new RobotType('Bravo', 3, 2);
    const output = MultiClientSummaryFormatter.format(
      [new AllocationResult('client-1', 3, [new Robot(bravo)])],
      {},
    );

    expect(output).toContain('Bravo: 100.0%');
  });
});
