import { DomainError } from './DomainError';

export class ZeroRobotsError extends DomainError {
  readonly code = 'ZERO_ROBOTS';

  constructor(message: string = 'No robots available for assignment.') {
    super(message);
  }
}
