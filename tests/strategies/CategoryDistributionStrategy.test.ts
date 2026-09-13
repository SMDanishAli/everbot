import { CategoryDistributionStrategy } from '../../src/strategies/CategoryDistributionStrategy';
import { Robot, RobotSource } from '../../src/domain/entities/Robot';
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

  it('spec example: 17h requested -> extra Charlie minimises excess', () => {
    const result = strategy.allocate(
      pool({ bravo: 2, charlie: 3, delta: 2 }),
      new ClientRequest(17),
    );

    // One Delta plus two Charlies gives 18h, which has only 1h excess.
    expect(result.countByType('Bravo')).toBe(0);
    expect(result.countByType('Charlie')).toBe(2);
    expect(result.countByType('Delta')).toBe(1);
    expect(result.totalHoursProvided).toBe(18);
    expect(result.excessHours).toBe(1);
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

  it('prefers fewer robots when excess and category diversity are tied', () => {
    const echo = new RobotType('Echo', 6, 1);
    const result = strategy.allocate(
      [new Robot(bravo), new Robot(bravo), new Robot(echo)],
      new ClientRequest(6),
    );

    expect(result.countByType('Echo')).toBe(1);
    expect(result.countByType('Bravo')).toBe(0);
  });

  it('handles large same-type inventories by searching counts per type', () => {
    const result = strategy.allocate(
      pool({ bravo: 20, charlie: 20, delta: 20 }),
      new ClientRequest(100),
    );

    expect(result.totalHoursProvided).toBe(100);
    expect(result.assignedRobots.length).toBeLessThanOrEqual(20);
    expect(result.assignedRobots.length).toBeGreaterThan(0);
  });

  it('throws ZeroRobotsError when no robots are available', () => {
    expect(() => strategy.allocate([], new ClientRequest(10))).toThrow(ZeroRobotsError);
  });

  it('throws InsufficientCapacityError when total capacity is below the request', () => {
    expect(() => strategy.allocate(pool({ bravo: 1 }), new ClientRequest(10))).toThrow(
      InsufficientCapacityError,
    );
  });

  it('ignores standby robots — Level 1 has no standby-activation concept', () => {
    // 1 active of each type = 16h active capacity, plus a standby pool that
    // alone could cover the request. Level 1 must not touch the standby pool.
    const activeOnly = pool({ bravo: 1, charlie: 1, delta: 1 });
    const standbyOnly = [
      new Robot(bravo, RobotSource.STANDBY),
      new Robot(charlie, RobotSource.STANDBY),
      new Robot(delta, RobotSource.STANDBY),
    ];
    const mixedPool = [...activeOnly, ...standbyOnly];

    expect(() => strategy.allocate(mixedPool, new ClientRequest(21))).toThrow(
      InsufficientCapacityError,
    );

    const result = strategy.allocate(mixedPool, new ClientRequest(16));
    expect(result.assignedRobots.every((robot) => robot.source === RobotSource.ACTIVE)).toBe(true);
  });

  it('throws ZeroRobotsError when only standby robots are available', () => {
    const standbyOnly = [new Robot(bravo, RobotSource.STANDBY)];
    expect(() => strategy.allocate(standbyOnly, new ClientRequest(3))).toThrow(ZeroRobotsError);
  });
});
