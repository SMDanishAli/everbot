import { DomainError } from './DomainError';

export class ImpossibleAllocationError extends DomainError {
  readonly code = 'IMPOSSIBLE_ALLOCATION';

  constructor(
    message: string = 'Unable to allocate at least one robot from each category with the available inventory.',
  ) {
    super(message);
  }
}
