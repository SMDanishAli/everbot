import { UtilizationCalculator } from '../../src/services/UtilizationCalculator';
import { AllocationResult } from '../../src/domain/entities/AllocationResult';
import { Robot } from '../../src/domain/entities/Robot';
import { RobotType } from '../../src/domain/entities/RobotType';

describe('UtilizationCalculator', () => {
  it('returns zero totals for no allocations', () => {
    expect(UtilizationCalculator.summarize([])).toEqual({
      totalRobotsUsed: 0,
      totalCost: 0,
      totalHoursProvided: 0,
      totalExcessHours: 0,
      byType: {},
    });
  });

  it('aggregates totals and per-type usage across allocations', () => {
    const bravo = new RobotType('Bravo', 3, 2);
    const delta = new RobotType('Delta', 8, 4);

    const summary = UtilizationCalculator.summarize([
      new AllocationResult('client-1', 3, [new Robot(bravo)]),
      new AllocationResult('client-2', 10, [new Robot(bravo), new Robot(delta)]),
    ]);

    expect(summary).toEqual({
      totalRobotsUsed: 3,
      totalCost: 8,
      totalHoursProvided: 14,
      totalExcessHours: 1,
      byType: {
        Bravo: { count: 2, hoursProvided: 6 },
        Delta: { count: 1, hoursProvided: 8 },
      },
    });
  });
});
