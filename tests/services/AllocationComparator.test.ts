import { AllocationComparator } from '../../src/services/AllocationComparator';
import { AllocationResult } from '../../src/domain/entities/AllocationResult';
import { Robot } from '../../src/domain/entities/Robot';
import { RobotType } from '../../src/domain/entities/RobotType';

describe('AllocationComparator', () => {
  const cheap = new RobotType('Bravo', 3, 2);
  const expensive = new RobotType('Delta', 8, 4);

  it.each([
    ['costOptimized', 4, 2, 'costOptimized'],
    ['categoryDistribution', 2, 4, 'categoryDistribution'],
    ['equal', 2, 2, 'equal'],
  ])('reports the %s allocation as cheaper', (_name, firstCost, secondCost, cheaper) => {
    const category = new AllocationResult('client-1', 3, [new Robot(firstCost === 2 ? cheap : expensive)]);
    const optimized = new AllocationResult('client-1', 3, [new Robot(secondCost === 2 ? cheap : expensive)]);

    const report = AllocationComparator.compare(category, optimized);

    expect(report.cheaper).toBe(cheaper);
    expect(report.costDifference).toBe(Math.abs(firstCost - secondCost));
    expect(report.categoryDistribution).toBe(category);
    expect(report.costOptimized).toBe(optimized);
  });
});
