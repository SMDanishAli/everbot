import { AllocationResult } from '../../../src/domain/entities/AllocationResult';
import { Robot } from '../../../src/domain/entities/Robot';
import { RobotType } from '../../../src/domain/entities/RobotType';

describe('AllocationResult', () => {
  const bravo = new RobotType('Bravo', 3, 2);
  const charlie = new RobotType('Charlie', 5, 3);
  const delta = new RobotType('Delta', 8, 4);

  it('sums total hours provided across assigned robots', () => {
    const result = new AllocationResult('client-1', 16, [
      new Robot(bravo),
      new Robot(charlie),
      new Robot(delta),
    ]);

    expect(result.totalHoursProvided).toBe(16);
  });

  it('sums total cost across assigned robots', () => {
    const result = new AllocationResult('client-1', 16, [
      new Robot(bravo),
      new Robot(charlie),
      new Robot(delta),
    ]);

    expect(result.totalCost).toBe(9);
  });

  it('computes excess hours as provided minus requested', () => {
    const result = new AllocationResult('client-1', 10, [new Robot(delta), new Robot(bravo)]);

    // delta (8h) + bravo (3h) = 11h provided against 10h requested
    expect(result.excessHours).toBe(1);
  });

  it('counts robots by type name', () => {
    const result = new AllocationResult('client-1', 6, [new Robot(bravo), new Robot(bravo)]);

    expect(result.countByType('Bravo')).toBe(2);
    expect(result.countByType('Delta')).toBe(0);
  });
});
