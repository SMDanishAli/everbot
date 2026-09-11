import { CostCalculator } from '../../src/services/CostCalculator';
import { AllocationResult } from '../../src/domain/entities/AllocationResult';
import { Robot } from '../../src/domain/entities/Robot';
import { RobotType } from '../../src/domain/entities/RobotType';

describe('CostCalculator', () => {
  const bravo = new RobotType('Bravo', 3, 2);
  const delta = new RobotType('Delta', 8, 4);
  const result = new AllocationResult('client-1', 11, [new Robot(bravo), new Robot(delta)]);

  it('returns an allocation total cost', () => {
    expect(CostCalculator.totalCost(result)).toBe(6);
  });

  it('returns the absolute cost difference', () => {
    const cheaper = new AllocationResult('client-2', 3, [new Robot(bravo)]);

    expect(CostCalculator.costDifference(result, cheaper)).toBe(4);
    expect(CostCalculator.costDifference(cheaper, result)).toBe(4);
  });
});
