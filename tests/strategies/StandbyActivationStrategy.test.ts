import { StandbyActivationStrategy } from '../../src/strategies/StandbyActivationStrategy';
import { CategoryDistributionStrategy } from '../../src/strategies/CategoryDistributionStrategy';
import { Robot, RobotSource } from '../../src/domain/entities/Robot';
import { RobotType } from '../../src/domain/entities/RobotType';
import { ClientRequest } from '../../src/domain/entities/ClientRequest';
import { ZeroRobotsError, InsufficientCapacityError } from '../../src/domain/errors';

describe('StandbyActivationStrategy', () => {
  const bravo = new RobotType('Bravo', 3, 2);
  const charlie = new RobotType('Charlie', 5, 3);
  const delta = new RobotType('Delta', 8, 4);

  function activePool(): Robot[] {
    // Spec's worked example: exactly one of each active robot, total 16h capacity.
    return [
      new Robot(bravo, RobotSource.ACTIVE),
      new Robot(charlie, RobotSource.ACTIVE),
      new Robot(delta, RobotSource.ACTIVE),
    ];
  }

  function standbyPool(): Robot[] {
    // Spec's worked example standby stock: Bravo:2, Charlie:1, Delta:1.
    return [
      new Robot(bravo, RobotSource.STANDBY),
      new Robot(bravo, RobotSource.STANDBY),
      new Robot(charlie, RobotSource.STANDBY),
      new Robot(delta, RobotSource.STANDBY),
    ];
  }

  it('spec example: 21h requested, 16h active capacity -> activates Charlie:1 from standby (cheapest option)', () => {
    const strategy = new StandbyActivationStrategy(new CategoryDistributionStrategy());

    const result = strategy.allocate([...activePool(), ...standbyPool()], new ClientRequest(21));

    // Base active: Bravo1 + Charlie1 + Delta1 = 16h.
    // Shortfall = 5h. Standby options: Bravo x2 ($4), Delta x1 ($4), Charlie x1 ($3).
    // Charlie x1 is cheapest and exact -> total assigned Charlie count = active(1) + standby(1) = 2.
    expect(result.countByType('Bravo')).toBe(1);
    expect(result.countByType('Charlie')).toBe(2);
    expect(result.countByType('Delta')).toBe(1);
    expect(result.totalHoursProvided).toBe(21);
    expect(result.excessHours).toBe(0);

    const usedStandby = result.assignedRobots.filter((r) => r.source === RobotSource.STANDBY);
    expect(usedStandby).toHaveLength(1);
    expect(usedStandby[0].type.name).toBe('Charlie');
  });

  it('delegates entirely to the base strategy when active capacity is sufficient', () => {
    const baseStrategy = new CategoryDistributionStrategy();
    const strategy = new StandbyActivationStrategy(baseStrategy);

    const active = [...activePool(), ...standbyPool()]; // 16h active capacity
    const result = strategy.allocate(active, new ClientRequest(10));
    const directResult = baseStrategy.allocate(activePool(), new ClientRequest(10));

    expect(result.totalHoursProvided).toBe(directResult.totalHoursProvided);
    expect(result.assignedRobots.every((r) => r.source === RobotSource.ACTIVE)).toBe(true);
    // Standby pool must be untouched since it was never needed.
    expect(result.assignedRobots.every((r) => r.source === RobotSource.ACTIVE)).toBe(true);
  });

  it('does not mutate the supplied pool across repeated calls', () => {
    const available = [...activePool(), ...standbyPool()];
    const strategy = new StandbyActivationStrategy(new CategoryDistributionStrategy());

    const first = strategy.allocate(available, new ClientRequest(21));
    expect(first.countByType('Charlie')).toBe(2); // 1 active + 1 standby Charlie used
    expect(available).toHaveLength(7);
  });

  it('throws InsufficientCapacityError when active is insufficient and standby is empty', () => {
    const strategy = new StandbyActivationStrategy(new CategoryDistributionStrategy());

    expect(() => strategy.allocate(activePool(), new ClientRequest(21))).toThrow(
      InsufficientCapacityError,
    );
  });

  it('throws ZeroRobotsError when both active and standby pools are empty', () => {
    const strategy = new StandbyActivationStrategy(new CategoryDistributionStrategy());

    expect(() => strategy.allocate([], new ClientRequest(10))).toThrow(ZeroRobotsError);
  });
});
