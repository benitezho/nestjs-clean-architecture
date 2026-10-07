import { BaseError } from './base-error';

/** A use case could not complete (missing resource, conflict, rejected request). */
export abstract class ApplicationError extends BaseError {}
