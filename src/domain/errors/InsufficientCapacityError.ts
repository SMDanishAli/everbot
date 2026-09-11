import { DomainError } from './DomainError';

export class InsufficientCapacityError extends DomainError {
  readonly code = 'INSUFFICIENT_CAPACITY';

  constructor(
    message: string = 'Insufficient robot capacity to complete the requested work.',
  ) {
    super(message);
  }
}
