import { AllocationService } from '../../src/services/AllocationService';
import { AllocationResult } from '../../src/domain/entities/AllocationResult';
import { ClientRequest } from '../../src/domain/entities/ClientRequest';
import { Robot } from '../../src/domain/entities/Robot';
import { RobotType } from '../../src/domain/entities/RobotType';
import { ZeroRobotsError } from '../../src/domain/errors';
import { ILogger } from '../../src/infrastructure/logging/ILogger';
import { IRobotRepository } from '../../src/domain/repositories/IRobotRepository';
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
  const robotRepository: jest.Mocked<IRobotRepository> = {
    getInventory: jest.fn(),
    getAvailableInventory: jest.fn(),
    setInventory: jest.fn(),
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
    robotRepository.allocate.mockResolvedValue();
    historyRepository.save.mockResolvedValue();
    strategy.allocate = jest.fn().mockReturnValue(new AllocationResult('client-1', 3, [robot]));
  });

  function service(): AllocationService {
    return new AllocationService(inventoryService, robotRepository, historyRepository, logger);
  }

  it('allocates, persists, and returns a single result', async () => {
    const result = await service().allocate(strategy, request);

    expect(result.assignedRobots).toEqual([robot]);
    expect(robotRepository.allocate).toHaveBeenCalledWith([
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
    robotRepository.allocate.mockRejectedValue(error);

    await expect(service().allocate(strategy, request)).rejects.toBe(error);

    expect(logger.error).toHaveBeenCalledWith('Allocation failed (system error)', { err: error });
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
    expect(robotRepository.allocate).toHaveBeenCalledWith([
      { type: 'Bravo', source: robot.source, count: 1 },
      { type: 'Bravo', source: secondRobot.source, count: 1 },
    ]);
    expect(historyRepository.save).toHaveBeenCalledTimes(2);
  });

  it('logs multi-client failures and rethrows them', async () => {
    const error = new Error('allocation failed');
    inventoryService.getAvailableRobots.mockRejectedValue(error);

    await expect(service().allocateMany(strategy, [request])).rejects.toBe(error);

    expect(logger.error).toHaveBeenCalledWith('Multi-client allocation failed', { err: error });
  });
});
