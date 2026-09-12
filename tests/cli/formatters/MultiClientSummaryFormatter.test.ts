import { AllocationResult } from '../../../src/domain/entities/AllocationResult';
import { Robot } from '../../../src/domain/entities/Robot';
import { RobotType } from '../../../src/domain/entities/RobotType';
import { MultiClientSummaryFormatter } from '../../../src/cli/formatters/MultiClientSummaryFormatter';

describe('MultiClientSummaryFormatter', () => {
  it('formats multi-client totals and per-type utilisation', () => {
    const bravo = new RobotType('Bravo', 3, 2);
    const delta = new RobotType('Delta', 8, 4);
    const output = MultiClientSummaryFormatter.format([
      new AllocationResult('client-1', 3, [new Robot(bravo)]),
      new AllocationResult('client-2', 8, [new Robot(delta)]),
    ]);

    expect(output).toContain('Total robots used: 2');
    expect(output).toContain('Total cost: $6');
    expect(output).toContain('Average utilisation: 100.0%');
    expect(output).toContain('Bravo: 27.3%');
    expect(output).toContain('Delta: 72.7%');
  });
});
