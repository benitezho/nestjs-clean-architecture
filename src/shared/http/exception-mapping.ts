import { HttpException, HttpStatus } from '@nestjs/common';
import { STATUS_CODES } from 'node:http';
import { QueryFailedError } from 'typeorm';
import { BaseError, type ErrorKind } from '../kernel/errors/base-error';
import type { ProblemDetails, ProblemResponse } from './problem-details';

/** Exhaustive on purpose: adding an ErrorKind without a status does not compile. */
const STATUS_BY_KIND: Record<ErrorKind, HttpStatus> = {
  bad_request: HttpStatus.BAD_REQUEST,
  validation: HttpStatus.UNPROCESSABLE_ENTITY,
  not_found: HttpStatus.NOT_FOUND,
  conflict: HttpStatus.CONFLICT,
};

const RETRY_AFTER_SECONDS = '1';

interface PersistenceProblem {
  status: HttpStatus;
  code: string;
  detail: string;
  headers: Record<string, string>;
}

const RETRYABLE: PersistenceProblem = {
  status: HttpStatus.SERVICE_UNAVAILABLE,
  code: 'persistence.retryable',
  detail: 'The service is temporarily unable to process the request; retry shortly',
  headers: { 'Retry-After': RETRY_AFTER_SECONDS },
};

/** Known PostgreSQL SQLSTATE codes. Messages never include constraint names or SQL. */
const PROBLEM_BY_SQLSTATE: Record<string, PersistenceProblem> = {
  '23505': {
    status: HttpStatus.CONFLICT,
    code: 'persistence.unique_violation',
    detail: 'The resource conflicts with an existing one',
    headers: {},
  },
  '40001': RETRYABLE,
  '40P01': RETRYABLE,
};

/** Pure translation of any thrown value to a Problem Details response. */
export function toProblemResponse(exception: unknown, instance?: string): ProblemResponse {
  if (exception instanceof BaseError) {
    return fromBaseError(exception, instance);
  }
  if (exception instanceof HttpException) {
    return { problem: fromHttpException(exception, instance), headers: {} };
  }
  if (exception instanceof QueryFailedError) {
    const known = PROBLEM_BY_SQLSTATE[sqlState(exception.driverError) ?? ''];
    if (known) {
      return fromPersistenceProblem(known, instance);
    }
  }
  return internalServerError(instance);
}

function fromBaseError(error: BaseError, instance?: string): ProblemResponse {
  const status = STATUS_BY_KIND[error.kind];
  return {
    problem: {
      type: problemType(error.code),
      title: STATUS_CODES[status]!,
      status,
      detail: error.message,
      instance,
      code: error.code,
      ...(error.details && { details: error.details }),
    },
    headers: {},
  };
}

function fromPersistenceProblem(known: PersistenceProblem, instance?: string): ProblemResponse {
  return {
    problem: {
      type: problemType(known.code),
      title: STATUS_CODES[known.status]!,
      status: known.status,
      detail: known.detail,
      instance,
      code: known.code,
    },
    headers: known.headers,
  };
}

function fromHttpException(exception: HttpException, instance?: string): ProblemDetails {
  const status = exception.getStatus();
  const body = exception.getResponse();
  const fields = typeof body === 'object' ? (body as Record<string, unknown>) : {};
  const message = typeof body === 'string' ? body : fields.message;
  return {
    type: 'about:blank',
    title: STATUS_CODES[status] ?? 'Error',
    status,
    detail: Array.isArray(message) ? message.join('; ') : (message as string | undefined),
    instance,
    ...(Array.isArray(fields.errors) && { errors: fields.errors as ProblemDetails['errors'] }),
  };
}

function internalServerError(instance?: string): ProblemResponse {
  const status = HttpStatus.INTERNAL_SERVER_ERROR;
  return {
    problem: {
      type: 'about:blank',
      title: STATUS_CODES[status]!,
      status,
      detail: 'An unexpected error occurred',
      instance,
    },
    headers: {},
  };
}

function sqlState(driverError: unknown): string | undefined {
  const code = (driverError as { code?: unknown } | undefined)?.code;
  return typeof code === 'string' ? code : undefined;
}

function problemType(code: string): string {
  return `urn:problem-type:${code}`;
}
