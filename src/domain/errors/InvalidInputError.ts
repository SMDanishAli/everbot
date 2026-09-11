import { DomainError } from './DomainError';

export class InvalidInputError extends DomainError {
  readonly code = 'INVALID_INPUT';

  constructor(message: string = 'Work hours must be a positive integer.') {
    super(message);
  }
}
