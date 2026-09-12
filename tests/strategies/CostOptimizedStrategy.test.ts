import { CostOptimizedStrategy } from '../../src/strategies/CostOptimizedStrategy';
import { Robot } from '../../src/domain/entities/Robot';
import { RobotType } from '../../src/domain/entities/RobotType';
import { ClientRequest } from '../../src/domain/entities/ClientRequest';
import { ZeroRobotsError, InsufficientCapacityError } from '../../src/domain/errors';

describe('CostOptimizedStrategy', () => {
  const bravo = new RobotType('Bravo', 3, 2);
  const charlie = new RobotType('Charlie', 5, 3);
  const delta = new RobotType('Delta', 8, 4);

  const strategy = new CostOptimizedStrategy();

  function pool(counts: { bravo?: number; charlie?: number; delta?: number }): Robot[] {
    const robots: Robot[] = [];
    for (let i = 0; i < (counts.bravo ?? 0); i++) robots.push(new Robot(bravo));
    for (let i = 0; i < (counts.charlie ?? 0); i++) robots.push(new Robot(charlie));
    for (let i = 0; i < (counts.delta ?? 0); i++) robots.push(new Robot(delta));
    return robots;
  }

  it('spec example 1: 20h requested with Bravo:2, Charlie:3, Delta:2 -> Charlie:1 + Delta:2, $11', () => {
    const result = strategy.allocate(
      pool({ bravo: 2, charlie: 3, delta: 2 }),
      new ClientRequest(20),
    );

    expect(result.countByType('Charlie')).toBe(1);
    expect(result.countByType('Delta')).toBe(2);
    expect(result.countByType('Bravo')).toBe(0);
    expect(result.totalHoursProvided).toBe(21);
    expect(result.totalCost).toBe(11);
  });

  it('spec example 2: 6h requested with Bravo:2, Charlie:2, Delta:3 -> Bravo:2, $4 (tie-break on excess)', () => {
    const result = strategy.allocate(
      pool({ bravo: 2, charlie: 2, delta: 3 }),
      new ClientRequest(6),
    );

    // Delta:1 also costs $4 (8h), but Bravo:2 ties on cost with less excess (0 vs 2) and wins.
    expect(result.countByType('Bravo')).toBe(2);
    expect(result.countByType('Charlie')).toBe(0);
    expect(result.countByType('Delta')).toBe(0);
    expect(result.totalHoursProvided).toBe(6);
    expect(result.totalCost).toBe(4);
    expect(result.excessHours).toBe(0);
  });

  it('never assigns more robots of a type than are available', () => {
    const result = strategy.allocate(pool({ bravo: 1, charlie: 1, delta: 1 }), new ClientRequest(3));

    expect(result.countByType('Bravo')).toBeLessThanOrEqual(1);
    expect(result.countByType('Charlie')).toBeLessThanOrEqual(1);
    expect(result.countByType('Delta')).toBeLessThanOrEqual(1);
    expect(result.totalHoursProvided).toBeGreaterThanOrEqual(3);
  });

  it('throws ZeroRobotsError when no robots are available', () => {
    expect(() => strategy.allocate([], new ClientRequest(10))).toThrow(ZeroRobotsError);
  });

  it('throws InsufficientCapacityError when total capacity is below the request', () => {
    expect(() => strategy.allocate(pool({ bravo: 1 }), new ClientRequest(10))).toThrow(
      InsufficientCapacityError,
    );
  });

  it('uses the defensive insufficient-capacity fallback when no DP state is reachable', () => {
    const solve = (
      strategy as unknown as {
        solveMinCostBoundedKnapsack(
          groups: Array<{ key: string; robots: Robot[] }>,
          hoursRequested: number,
          range: number,
        ): Robot[];
      }
    ).solveMinCostBoundedKnapsack.bind(strategy);

    expect(() => solve([], 1, 1)).toThrow(InsufficientCapacityError);
  });

  it('never assigns more robots of a (type, source) group than that group has', () => {
    // Regression check for the bounded-knapsack rewrite: a group's inner
    // count loop must be capped at the group's own fleet size, not at range.
    const result = strategy.allocate(pool({ bravo: 3 }), new ClientRequest(7));

    expect(result.countByType('Bravo')).toBeLessThanOrEqual(3);
    expect(result.totalHoursProvided).toBeGreaterThanOrEqual(7);
  });
});