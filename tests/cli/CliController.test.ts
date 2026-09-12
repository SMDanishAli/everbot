import { AllocationResult } from '../../src/domain/entities/AllocationResult';
import { Robot } from '../../src/domain/entities/Robot';
import { RobotType } from '../../src/domain/entities/RobotType';
import { ZeroRobotsError } from '../../src/domain/errors';
import { ILogger } from '../../src/infrastructure/logging/ILogger';
import { AllocationService } from '../../src/services/AllocationService';
import { IAllocationStrategy } from '../../src/strategies/IAllocationStrategy';
import { CliController } from '../../src/cli/CliController';

jest.mock('../../src/cli/prompts', () => ({
  prompt: jest.fn(),
}));

import { prompt } from '../../src/cli/prompts';

describe('CliController', () => {
  const bravo = new RobotType('Bravo', 3, 2);
  const strategy: IAllocationStrategy = {
    name: 'Test strategy',
    allocate: jest.fn(),
  };
  const logger: jest.Mocked<ILogger> = {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  };

  let service: jest.Mocked<
    Pick<AllocationService, 'allocate' | 'allocateMany' | 'allocateWithComparison'>
  >;
  let controller: CliController;

  beforeEach(() => {
    jest.clearAllMocks();
    service = {
      allocate: jest.fn(),
      allocateMany: jest.fn(),
      allocateWithComparison: jest.fn(),
    };
    controller = new CliController(service as unknown as AllocationService, logger);
    jest.spyOn(console, 'log').mockImplementation(() => undefined);
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('allocates one client and prints the formatted result', async () => {
    const result = new AllocationResult('client-1', 3, [new Robot(bravo)]);
    service.allocate.mockResolvedValue(result);
    (prompt as jest.Mock).mockResolvedValue('3');

    await controller.run(strategy);

    expect(service.allocate).toHaveBeenCalledWith(
      strategy,
      expect.objectContaining({ clientId: 'client-1', hoursRequested: 3 }),
    );
    expect(service.allocateMany).not.toHaveBeenCalled();
    expect(console.log).toHaveBeenCalledWith(expect.stringContaining('Total cost'));
  });

  it('allocates comma-separated clients as a shared multi-client request', async () => {
    const results = [
      new AllocationResult('client-1', 12, [new Robot(bravo)]),
      new AllocationResult('client-2', 4, [new Robot(bravo)]),
    ];
    service.allocateMany.mockResolvedValue(results);
    (prompt as jest.Mock).mockResolvedValue('12, 4');

    const multiClientStrategy: IAllocationStrategy = {
      name: 'Multi-client strategy',
      allocate: jest.fn(),
    };

    await controller.run(strategy, multiClientStrategy);

    expect(service.allocateMany).toHaveBeenCalledWith(multiClientStrategy, [
      expect.objectContaining({ clientId: 'client-1', hoursRequested: 12 }),
      expect.objectContaining({ clientId: 'client-2', hoursRequested: 4 }),
    ]);
    expect(service.allocate).not.toHaveBeenCalled();
    expect(console.log).toHaveBeenCalledWith(expect.stringContaining('Hours requested'));
  });

  it('compares Level 1 and Level 2 for a single Level 2 request', async () => {
    const result = new AllocationResult('client-1', 3, [new Robot(bravo)]);
    const comparisonStrategy: IAllocationStrategy = {
      name: 'L1',
      allocate: jest.fn(),
    };
    service.allocateWithComparison.mockResolvedValue({
      result,
      comparison: {
        categoryDistribution: result,
        costOptimized: result,
        costDifference: 0,
        cheaper: 'equal',
      },
    });
    (prompt as jest.Mock).mockResolvedValue('3');

    await controller.run(strategy, strategy, comparisonStrategy);

    expect(service.allocateWithComparison).toHaveBeenCalledWith(
      strategy,
      comparisonStrategy,
      expect.objectContaining({ hoursRequested: 3 }),
    );
    expect(service.allocate).not.toHaveBeenCalled();
    expect(console.log).toHaveBeenCalledWith(expect.stringContaining('Level 1 Cost: $2'));
  });

  it('reports invalid zero-hour input without calling the allocation service', async () => {
    (prompt as jest.Mock).mockResolvedValue('0');

    await controller.run(strategy);

    expect(service.allocate).not.toHaveBeenCalled();
    expect(service.allocateMany).not.toHaveBeenCalled();
    expect(logger.warn).toHaveBeenCalledWith(
      'Invalid CLI input',
      expect.objectContaining({ rawHours: '0' }),
    );
    expect(console.error).toHaveBeenCalledWith('Error: Work hours must be greater than 0.');
  });

  it('displays domain allocation errors returned by the service', async () => {
    const error = new ZeroRobotsError('No robots are available.');
    service.allocate.mockRejectedValue(error);
    (prompt as jest.Mock).mockResolvedValue('3');

    await controller.run(strategy);

    expect(console.error).toHaveBeenCalledWith('Error: No robots are available.');
  });
});
