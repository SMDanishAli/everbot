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

  it('shows None when no robots are assigned', () => {
    const result = new AllocationResult('client-1', 1, []);

    expect(AssignmentFormatter.format(result, 'Test strategy')).toContain('None');
  });

  it('lists every standby alternative and its cost when present', () => {
    const result = new AllocationResult(
      'client-1',
      21,
      [new Robot(bravo)],
      [
        { type: 'Bravo', count: 2, cost: 4 },
        { type: 'Charlie', count: 1, cost: 3 },
        { type: 'Delta', count: 1, cost: 4 },
      ],
    );

    const output = AssignmentFormatter.format(result, 'Test strategy');

    expect(output).toContain(
      'Additional Standby Robots Required:\nBravo: 2 - cost $4\nor\nCharlie: 1 - cost $3\nor\nDelta: 1 - cost $4',
    );
  });

  it('omits the standby alternatives section when there are none', () => {
    const result = new AllocationResult('client-1', 10, [new Robot(delta), new Robot(bravo)]);

    expect(AssignmentFormatter.format(result, 'Test strategy')).not.toContain(
      'Additional Standby Robots Required',
    );
  });

  it('adds colors to highlighted values in a TTY', () => {
    Object.defineProperty(process.stdout, 'isTTY', { configurable: true, value: true });
    const result = new AllocationResult('client-1', 10, [new Robot(delta), new Robot(bravo)]);

    const output = AssignmentFormatter.format(result, 'Test strategy');

    expect(output).toContain('\x1b[34m');
    expect(output).toContain('\x1b[31m');
    expect(output).toContain('\x1b[32m');
    Object.defineProperty(process.stdout, 'isTTY', { configurable: true, value: false });
  });
});
