import { AllocationResult } from '../../../src/domain/entities/AllocationResult';
import { Robot } from '../../../src/domain/entities/Robot';
import { RobotType } from '../../../src/domain/entities/RobotType';
import { AssignmentFormatter } from '../../../src/cli/formatters/AssignmentFormatter';

describe('AssignmentFormatter', () => {
  const bravo = new RobotType('Bravo', 3, 2);
  const delta = new RobotType('Delta', 8, 4);

  it('formats robot usage alphabetically and omits zero excess hours', () => {
    const result = new AllocationResult('client-1', 14, [
      new Robot(delta),
      new Robot(bravo),
      new Robot(bravo),
    ]);

    const output = AssignmentFormatter.format(result, 'L1 - Category Distribution');

    expect(output).toContain('=== Allocation Result ===');
    expect(output).toContain('L1 - Category Distribution');
    expect(output).toContain('Bravo (2), Delta (1)');
    expect(output).not.toContain('Excess hours');
  });

  it('includes excess hours when the assignment exceeds the request', () => {
    const result = new AllocationResult('client-1', 10, [new Robot(delta), new Robot(bravo)]);

    expect(AssignmentFormatter.format(result, 'Test strategy')).toContain('Excess hours');
  });
});
