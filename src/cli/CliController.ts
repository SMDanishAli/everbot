import { ClientRequest } from '../domain/entities/ClientRequest';
import { AllocationService } from '../services/AllocationService';
import { IAllocationStrategy } from '../strategies/IAllocationStrategy';
import { AssignmentFormatter } from './formatters/AssignmentFormatter';
import { ErrorFormatter } from './formatters/ErrorFormatter';
import { prompt } from './prompts';
import { ILogger } from '../infrastructure/logging/ILogger';
import { ComparisonFormatter } from './formatters/ComparisonFormatter';
import { ClientHoursParser } from '../parsers/ClientHoursParser';

const formatMultiClientNotice = (message: string): string =>
  process.stdout.isTTY ? `\x1b[33m${message}\x1b[0m` : message;

/**
 * Thin I/O layer: prompts, delegates to AllocationService, formats output.
 * Contains no business logic and no direct database/logging-transport calls.
 */
export class CliController {
  constructor(
    private readonly allocationService: AllocationService,
    private readonly logger: ILogger,
  ) {}

  async run(
    strategy: IAllocationStrategy,
    multiClientL3Strategy = strategy,
    comparisonStrategy?: IAllocationStrategy,
    comparisonTargetStrategy?: IAllocationStrategy,
  ): Promise<void> {
    const rawHours = await prompt(
      'Enter client work hours needed (comma- or space-separated for multiple clients): ',
    );

    let requests: ClientRequest[];
    try {
      requests = ClientHoursParser.parse(rawHours);
    } catch (err) {
      // Not yet reached AllocationService, so this is the only place this error is logged.
      this.logger.warn('Invalid CLI input', { err, rawHours });
      console.error(ErrorFormatter.format(err));
      return;
    }

    try {
      if (requests.length === 1) {
        if (comparisonStrategy) {
          const { result, comparison } = await this.allocationService.allocateWithComparison(
            strategy,
            comparisonStrategy,
            requests[0],
            comparisonTargetStrategy,
          );
          console.log(AssignmentFormatter.format(result, strategy.name));
          console.log(ComparisonFormatter.format(comparison));
        } else {
          const result = await this.allocationService.allocate(strategy, requests[0]);
          console.log(AssignmentFormatter.format(result, strategy.name));
        }
      } else {
        console.log(
          formatMultiClientNotice(
            'Multi-client mode: Auto selecting L3-style allocation (Cost Optimised + Standby Activation).',
          ),
        );
        const results = await this.allocationService.allocateMany(
          multiClientL3Strategy,
          requests,
        );
        console.log(
          results
            .map((result) => AssignmentFormatter.format(result, multiClientL3Strategy.name))
            .join('\n\n'),
        );
      }
    } catch (err) {
      // Already logged inside AllocationService — just present it to the user here.
      console.error(ErrorFormatter.format(err));
    }
  }
}
