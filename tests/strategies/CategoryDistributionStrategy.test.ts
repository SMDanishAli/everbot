import { CategoryDistributionStrategy } from '../../src/strategies/CategoryDistributionStrategy';
import { Robot } from '../../src/domain/entities/Robot';
import { RobotType } from '../../src/domain/entities/RobotType';
import { ClientRequest } from '../../src/domain/entities/ClientRequest';
import { ZeroRobotsError, InsufficientCapacityError } from '../../src/domain/errors';

describe('CategoryDistributionStrategy', () => {
  const bravo = new RobotType('Bravo', 3, 2);
  const charlie = new RobotType('Charlie', 5, 3);
  const delta = new RobotType('Delta', 8, 4);

  const strategy = new CategoryDistributionStrategy();

  function pool(counts: { bravo?: number; charlie?: number; delta?: number }): Robot[] {
    const robots: Robot[] = [];
    for (let i = 0; i < (counts.bravo ?? 0); i++) robots.push(new Robot(bravo));
    for (let i = 0; i < (counts.charlie ?? 0); i++) robots.push(new Robot(charlie));
    for (let i = 0; i < (counts.delta ?? 0); i++) robots.push(new Robot(delta));
    return robots;
  }

  it('spec example: 16h requested with Bravo:2, Charlie:3, Delta:2 available -> one of each, exact match', () => {
    const result = strategy.allocate(
      pool({ bravo: 2, charlie: 3, delta: 2 }),
      new ClientRequest(16),
    );

    expect(result.countByType('Bravo')).toBe(1);
    expect(result.countByType('Charlie')).toBe(1);
    expect(result.countByType('Delta')).toBe(1);
    expect(result.totalHoursProvided).toBe(16);
    expect(result.excessHours).toBe(0);
  });

  it('spec example: 17h requested -> extra Bravo minimises excess', () => {
    const result = strategy.allocate(
      pool({ bravo: 2, charlie: 3, delta: 2 }),
      new ClientRequest(17),
    );

    // base (Bravo1+Charlie1+Delta1=16h) + one extra Bravo (3h) = 19h, excess 2.
    // Charlie(+5=21,excess4) and Delta(+8=24,excess7) would both overshoot more.
    expect(result.countByType('Bravo')).toBe(2);
    expect(result.countByType('Charlie')).toBe(1);
    expect(result.countByType('Delta')).toBe(1);
    expect(result.totalHoursProvided).toBe(19);
    expect(result.excessHours).toBe(2);
  });

  it('spec example: 21h requested -> extra Charlie gives an exact match', () => {
    const result = strategy.allocate(
      pool({ bravo: 2, charlie: 3, delta: 2 }),
      new ClientRequest(21),
    );

    expect(result.countByType('Bravo')).toBe(1);
    expect(result.countByType('Charlie')).toBe(2);
    expect(result.countByType('Delta')).toBe(1);
    expect(result.totalHoursProvided).toBe(21);
    expect(result.excessHours).toBe(0);
  });

  it('spec example: 24h requested -> extra Delta gives an exact match', () => {
    const result = strategy.allocate(
      pool({ bravo: 2, charlie: 3, delta: 2 }),
      new ClientRequest(24),
    );

    expect(result.countByType('Bravo')).toBe(1);
    expect(result.countByType('Charlie')).toBe(1);
    expect(result.countByType('Delta')).toBe(2);
    expect(result.totalHoursProvided).toBe(24);
    expect(result.excessHours).toBe(0);
  });

  it('respects availability constraints — throws rather than double-counting when capacity is insufficient', () => {
    // Only 1 of each exists; total capacity is 16h, can't reach 40h.
    expect(() =>
      strategy.allocate(pool({ bravo: 1, charlie: 1, delta: 1 }), new ClientRequest(40)),
    ).toThrow(InsufficientCapacityError);
  });

  it('skips categories with zero availability rather than failing', () => {
    const result = strategy.allocate(pool({ bravo: 2, delta: 1 }), new ClientRequest(5));

    expect(result.countByType('Charlie')).toBe(0);
    expect(result.totalHoursProvided).toBeGreaterThanOrEqual(5);
  });

  it('throws ZeroRobotsError when no robots are available', () => {
    expect(() => strategy.allocate([], new ClientRequest(10))).toThrow(ZeroRobotsError);
  });

  it('throws InsufficientCapacityError when total capacity is below the request', () => {
    expect(() => strategy.allocate(pool({ bravo: 1 }), new ClientRequest(10))).toThrow(
      InsufficientCapacityError,
    );
  });
});
