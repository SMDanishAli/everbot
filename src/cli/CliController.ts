import { ClientRequest } from '../domain/entities/ClientRequest';
import { AllocationService } from '../services/AllocationService';
import { IAllocationStrategy } from '../strategies/IAllocationStrategy';
import { AssignmentFormatter } from './formatters/AssignmentFormatter';
import { ErrorFormatter } from './formatters/ErrorFormatter';
import { prompt } from './prompts';
import { ILogger } from '../infrastructure/logging/ILogger';

/**
 * Thin I/O layer: prompts, delegates to AllocationService, formats output.
 * Contains no business logic and no direct database/logging-transport calls.
 */
export class CliController {
  constructor(
    private readonly allocationService: AllocationService,
    private readonly logger: ILogger,
  ) {}

  async run(strategy: IAllocationStrategy): Promise<void> {
    const rawHours = await prompt('Enter client work hours needed: ');

    let request: ClientRequest;
    try {
      request = new ClientRequest(Number(rawHours));
    } catch (err) {
      // Not yet reached AllocationService, so this is the only place this error is logged.
      this.logger.warn('Invalid CLI input', { err, rawHours });
      console.error(ErrorFormatter.format(err));
      return;
    }

    try {
      const result = await this.allocationService.allocate(strategy, request);
      console.log(AssignmentFormatter.format(result, strategy.name));
    } catch (err) {
      // Already logged inside AllocationService — just present it to the user here.
      console.error(ErrorFormatter.format(err));
    }
  }
}
