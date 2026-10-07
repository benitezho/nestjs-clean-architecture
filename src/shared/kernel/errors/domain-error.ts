import { BaseError } from './base-error';

/** A business rule was violated. */
export abstract class DomainError extends BaseError {}
