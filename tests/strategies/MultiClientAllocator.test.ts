import { MultiClientAllocator } from '../../src/strategies/MultiClientAllocator';
import { CategoryDistributionStrategy } from '../../src/strategies/CategoryDistributionStrategy';
import { IAllocationStrategy } from '../../src/strategies/IAllocationStrategy';
import { Robot } from '../../src/domain/entities/Robot';
import { RobotType } from '../../src/domain/entities/RobotType';
import { ClientRequest } from '../../src/domain/entities/ClientRequest';
import { AllocationResult } from '../../src/domain/entities/AllocationResult';
import { ZeroRobotsError } from '../../src/domain/errors';

/**
 * A minimal fake strategy that just takes robots off the front of the pool
 * to cover the requested hours. Used to test MultiClientAllocator's own
 * orchestration logic (priority order, pool depletion, fail-fast) in
 * isolation from any real allocation algorithm's math.
 */
class FakeSequentialStrategy implements IAllocationStrategy {
  readonly name = 'Fake Sequential';
  readonly callOrder: number[] = [];

  allocate(availableRobots: Robot[], request: ClientRequest): AllocationResult {
    this.callOrder.push(request.hoursRequested);

    if (availableRobots.length === 0) {
      throw new ZeroRobotsError();
    }

    const taken: Robot[] = [];
    let hours = 0;
    for (const robot of availableRobots) {
      if (hours >= request.hoursRequested) break;
      taken.push(robot);
      hours += robot.workingHours;
    }

    return new AllocationResult(request.clientId, request.hoursRequested, taken);
  }
}

describe('MultiClientAllocator', () => {
  const bravo = new RobotType('Bravo', 3, 2);
  const charlie = new RobotType('Charlie', 5, 3);
  const delta = new RobotType('Delta', 8, 4);

  function pool(counts: { bravo?: number; charlie?: number; delta?: number }): Robot[] {
    const robots: Robot[] = [];
    for (let i = 0; i < (counts.bravo ?? 0); i++) robots.push(new Robot(bravo));
    for (let i = 0; i < (counts.charlie ?? 0); i++) robots.push(new Robot(charlie));
    for (let i = 0; i < (counts.delta ?? 0); i++) robots.push(new Robot(delta));
    return robots;
  }

  it('prioritises clients by highest hours requested first', () => {
    const fake = new FakeSequentialStrategy();
    const allocator = new MultiClientAllocator(fake);
    const requests = [12, 16, 17, 10, 21].map((h) => new ClientRequest(h));

    allocator.allocateAll(pool({ bravo: 20, charlie: 20, delta: 20 }), requests);

    expect(fake.callOrder).toEqual([21, 17, 16, 12, 10]);
  });

  it('does not double-book the same robot instance across clients', () => {
    const fake = new FakeSequentialStrategy();
    const allocator = new MultiClientAllocator(fake);
    const requests = [3, 3].map((h) => new ClientRequest(h));

    // Only enough Bravo robots to cover one 3h request at a time.
    const results = allocator.allocateAll(pool({ bravo: 2 }), requests);

    const firstRobots = new Set(results[0].assignedRobots);
    const secondRobots = new Set(results[1].assignedRobots);
    const overlap = [...firstRobots].filter((r) => secondRobots.has(r));

    expect(overlap).toHaveLength(0);
    expect(results).toHaveLength(2);
  });

  it('never mutates the caller-provided robots array', () => {
    const fake = new FakeSequentialStrategy();
    const allocator = new MultiClientAllocator(fake);
    const original = pool({ bravo: 3 });
    const originalLength = original.length;

    allocator.allocateAll(original, [new ClientRequest(3)]);

    expect(original).toHaveLength(originalLength);
  });

  it('fails fast: propagates an error for an unfulfillable client without silently skipping it', () => {
    const fake = new FakeSequentialStrategy();
    const allocator = new MultiClientAllocator(fake);
    // Two 3h requests but only one Bravo available — the second (lower priority) fails.
    const requests = [3, 3].map((h) => new ClientRequest(h));

    expect(() => allocator.allocateAll(pool({ bravo: 1 }), requests)).toThrow(ZeroRobotsError);
  });

  it('integration: works with the real CategoryDistributionStrategy across multiple clients', () => {
    const allocator = new MultiClientAllocator(new CategoryDistributionStrategy());
    const requests = [new ClientRequest(16), new ClientRequest(8)];

    const results = allocator.allocateAll(
      pool({ bravo: 3, charlie: 3, delta: 3 }),
      requests,
    );

    // 16h client processed first (higher priority) and gets exactly its own robots.
    expect(results[0].hoursRequested).toBe(16);
    expect(results[1].hoursRequested).toBe(8);

    const allAssigned = [...results[0].assignedRobots, ...results[1].assignedRobots];
    expect(new Set(allAssigned).size).toBe(allAssigned.length); // no shared instances
  });
});
