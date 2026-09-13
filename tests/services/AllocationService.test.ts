import { AllocationService } from '../../src/services/AllocationService';
import { AllocationResult } from '../../src/domain/entities/AllocationResult';
import { ClientRequest } from '../../src/domain/entities/ClientRequest';
import { Robot } from '../../src/domain/entities/Robot';
import { RobotType } from '../../src/domain/entities/RobotType';
import { ZeroRobotsError, InsufficientCapacityError } from '../../src/domain/errors';
import { ILogger } from '../../src/infrastructure/logging/ILogger';
import { IAllocationReservationRepository } from '../../src/domain/repositories/IAllocationReservationRepository';
import { IAllocationHistoryRepository } from '../../src/domain/repositories/IAllocationHistoryRepository';
import { InventoryService } from '../../src/services/InventoryService';
import { IAllocationStrategy } from '../../src/strategies/IAllocationStrategy';

describe('AllocationService', () => {
  const bravo = new RobotType('Bravo', 3, 2);
  const robot = new Robot(bravo);
  const request = new ClientRequest(3, 'client-1');
  const strategy: IAllocationStrategy = {
    name: 'Test strategy',
    allocate: jest.fn(),
  };
  const inventoryService = {
    getAvailableRobots: jest.fn(),
  } as unknown as jest.Mocked<InventoryService>;
  const reservationRepository: jest.Mocked<IAllocationReservationRepository> = {
    allocate: jest.fn(),
  };
  const historyRepository: jest.Mocked<IAllocationHistoryRepository> = {
    clear: jest.fn(),
    save: jest.fn(),
    findAll: jest.fn(),
  };
  const logger: jest.Mocked<ILogger> = {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    inventoryService.getAvailableRobots.mockResolvedValue([robot]);
    reservationRepository.allocate.mockResolvedValue();
    historyRepository.save.mockResolvedValue();
    strategy.allocate = jest.fn().mockReturnValue(new AllocationResult('client-1', 3, [robot]));
  });

  function service(): AllocationService {
    return new AllocationService(inventoryService, reservationRepository, historyRepository, logger);
  }

  it('allocates, persists, and returns a single result', async () => {
    const result = await service().allocate(strategy, request);

    expect(result.assignedRobots).toEqual([robot]);
    expect(reservationRepository.allocate).toHaveBeenCalledWith([
      { type: 'Bravo', source: robot.source, count: 1 },
    ]);
    expect(historyRepository.save).toHaveBeenCalledWith(result, 'Test strategy');
  });

  it('logs domain errors as allocation rejections', async () => {
    const error = new ZeroRobotsError();
    inventoryService.getAvailableRobots.mockRejectedValue(error);

    await expect(service().allocate(strategy, request)).rejects.toBe(error);

    expect(logger.error).toHaveBeenCalledWith('Allocation rejected', {
      code: error.code,
      message: error.message,
    });
  });

  it('logs unexpected single-allocation errors as system failures', async () => {
    const error = new Error('database unavailable');
    reservationRepository.allocate.mockRejectedValue(error);

    await expect(service().allocate(strategy, request)).rejects.toBe(error);

    expect(logger.error).toHaveBeenCalledWith('Allocation failed (system error)', { err: error });
  });

  it('compares Level 1 and Level 2 while persisting only Level 2', async () => {
    const categoryStrategy: IAllocationStrategy = {
      name: 'L1',
      allocate: jest.fn().mockReturnValue(new AllocationResult('client-1', 3, [robot])),
    };
    const optimizedStrategy: IAllocationStrategy = {
      name: 'L2',
      allocate: jest.fn().mockReturnValue(new AllocationResult('client-1', 3, [robot])),
    };

    const result = await service().allocateWithComparison(optimizedStrategy, categoryStrategy, request);

    expect(result.comparison?.costDifference).toBe(0);
    expect(reservationRepository.allocate).toHaveBeenCalledTimes(1);
    expect(historyRepository.save).toHaveBeenCalledWith(result.result, 'L2');
  });

  it('still returns the primary result when the comparison strategies cannot cover the request (e.g. it needs standby)', async () => {
    // Regression test: Level 1/2 correctly refuse to draw on standby, so when
    // a request only Level 3's standby activation can fulfil, the L1/L2
    // comparison strategies legitimately throw InsufficientCapacityError.
    // That must not block the primary (e.g. Level 3) result from returning.
    const insufficientError = new InsufficientCapacityError();
    const categoryStrategy: IAllocationStrategy = {
      name: 'L1',
      allocate: jest.fn().mockImplementation(() => {
        throw insufficientError;
      }),
    };
    const optimizedStrategy: IAllocationStrategy = {
      name: 'L2',
      allocate: jest.fn().mockImplementation(() => {
        throw insufficientError;
      }),
    };
    const standbyStrategy: IAllocationStrategy = {
      name: 'L3',
      allocate: jest.fn().mockReturnValue(new AllocationResult('client-1', 3, [robot])),
    };

    const outcome = await service().allocateWithComparison(
      standbyStrategy,
      categoryStrategy,
      request,
      optimizedStrategy,
    );

    expect(outcome.result.assignedRobots).toEqual([robot]);
    expect(outcome.comparison).toBeUndefined();
    expect(reservationRepository.allocate).toHaveBeenCalledTimes(1);
    expect(historyRepository.save).toHaveBeenCalledWith(outcome.result, 'L3');
  });

  it('still rethrows unexpected (non-domain) errors raised by a comparison strategy', async () => {
    const systemError = new Error('comparison strategy crashed');
    const categoryStrategy: IAllocationStrategy = {
      name: 'L1',
      allocate: jest.fn().mockImplementation(() => {
        throw systemError;
      }),
    };
    const optimizedStrategy: IAllocationStrategy = {
      name: 'L2',
      allocate: jest.fn().mockReturnValue(new AllocationResult('client-1', 3, [robot])),
    };
    const standbyStrategy: IAllocationStrategy = {
      name: 'L3',
      allocate: jest.fn().mockReturnValue(new AllocationResult('client-1', 3, [robot])),
    };

    await expect(
      service().allocateWithComparison(standbyStrategy, categoryStrategy, request, optimizedStrategy),
    ).rejects.toBe(systemError);
  });

  it('allocates multiple clients from a shared pool and persists each result', async () => {
    const secondRequest = new ClientRequest(3, 'client-2');
    const secondRobot = new Robot(bravo);
    inventoryService.getAvailableRobots.mockResolvedValue([robot, secondRobot]);
    strategy.allocate = jest
      .fn()
      .mockReturnValueOnce(new AllocationResult('client-1', 3, [robot]))
      .mockReturnValueOnce(new AllocationResult('client-2', 3, [secondRobot]));

    const results = await service().allocateMany(strategy, [request, secondRequest]);

    expect(results).toHaveLength(2);
    expect(reservationRepository.allocate).toHaveBeenCalledWith([
      { type: 'Bravo', source: robot.source, count: 1 },
      { type: 'Bravo', source: secondRobot.source, count: 1 },
    ]);
    expect(historyRepository.save).toHaveBeenCalledTimes(2);
  });

  it('compares each multi-client allocation while persisting only the selected results', async () => {
    const secondRequest = new ClientRequest(3, 'client-2');
    const secondRobot = new Robot(bravo);
    const categoryStrategy: IAllocationStrategy = {
      name: 'L1',
      allocate: jest
        .fn()
        .mockReturnValueOnce(new AllocationResult('client-1', 3, [robot]))
        .mockReturnValueOnce(new AllocationResult('client-2', 3, [secondRobot])),
    };
    const optimizedStrategy: IAllocationStrategy = {
      name: 'L2',
      allocate: jest
        .fn()
        .mockReturnValueOnce(new AllocationResult('client-1', 3, [robot]))
        .mockReturnValueOnce(new AllocationResult('client-2', 3, [secondRobot])),
    };
    strategy.allocate = jest
      .fn()
      .mockReturnValueOnce(new AllocationResult('client-1', 3, [robot]))
      .mockReturnValueOnce(new AllocationResult('client-2', 3, [secondRobot]));
    inventoryService.getAvailableRobots.mockResolvedValue([robot, secondRobot]);

    const allocation = await service().allocateManyWithComparison(
      strategy,
      categoryStrategy,
      optimizedStrategy,
      [request, secondRequest],
    );

    expect(allocation.results).toHaveLength(2);
    expect(allocation.comparisons).toHaveLength(2);
    expect(reservationRepository.allocate).toHaveBeenCalledTimes(1);
    expect(historyRepository.save).toHaveBeenCalledTimes(2);
  });

  it('still returns primary multi-client results when the comparison strategies cannot cover the batch', async () => {
    const secondRequest = new ClientRequest(3, 'client-2');
    const secondRobot = new Robot(bravo);
    const insufficientError = new InsufficientCapacityError();
    const categoryStrategy: IAllocationStrategy = {
      name: 'L1',
      allocate: jest.fn().mockImplementation(() => {
        throw insufficientError;
      }),
    };
    const optimizedStrategy: IAllocationStrategy = {
      name: 'L2',
      allocate: jest.fn().mockImplementation(() => {
        throw insufficientError;
      }),
    };
    strategy.allocate = jest
      .fn()
      .mockReturnValueOnce(new AllocationResult('client-1', 3, [robot]))
      .mockReturnValueOnce(new AllocationResult('client-2', 3, [secondRobot]));
    inventoryService.getAvailableRobots.mockResolvedValue([robot, secondRobot]);

    const allocation = await service().allocateManyWithComparison(
      strategy,
      categoryStrategy,
      optimizedStrategy,
      [request, secondRequest],
    );

    expect(allocation.results).toHaveLength(2);
    expect(allocation.comparisons).toEqual([undefined, undefined]);
    expect(reservationRepository.allocate).toHaveBeenCalledTimes(1);
    expect(historyRepository.save).toHaveBeenCalledTimes(2);
  });

  it('logs multi-client failures and rethrows them', async () => {
    const error = new Error('allocation failed');
    inventoryService.getAvailableRobots.mockRejectedValue(error);

    await expect(service().allocateMany(strategy, [request])).rejects.toBe(error);

    expect(logger.error).toHaveBeenCalledWith('Multi-client allocation failed (system error)', {
      err: error,
    });
  });

  it('logs multi-client domain errors as allocation rejections', async () => {
    const error = new ZeroRobotsError();
    inventoryService.getAvailableRobots.mockRejectedValue(error);

    await expect(service().allocateMany(strategy, [request])).rejects.toBe(error);

    expect(logger.error).toHaveBeenCalledWith('Multi-client allocation rejected', {
      code: error.code,
      message: error.message,
    });
  });
});
