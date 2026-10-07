import { HttpException, HttpStatus } from '@nestjs/common';
import { STATUS_CODES } from 'node:http';

/** RFC 9457 problem details, plus `code` and `errors` extension members. */
export interface ProblemDetails {
  type: string;
  title: string;
  status: number;
  detail?: string;
  instance?: string;
  code?: string;
  errors?: { field: string; messages: string[] }[];
}

/**
 * Domain and application errors are plain classes (no framework imports). They
 * opt in to this mapping by exposing `kind` and `code`.
 */
interface ClassifiedError extends Error {
  kind: string;
  code: string;
}

const STATUS_BY_KIND: Record<string, number> = {
  bad_request: HttpStatus.BAD_REQUEST,
  validation: HttpStatus.UNPROCESSABLE_ENTITY,
  not_found: HttpStatus.NOT_FOUND,
  conflict: HttpStatus.CONFLICT,
};

export function toProblemDetails(exception: unknown, instance?: string): ProblemDetails {
  if (isClassifiedError(exception)) {
    const status = STATUS_BY_KIND[exception.kind]!;
    return {
      type: `urn:problem-type:${exception.code}`,
      title: STATUS_CODES[status]!,
      status,
      detail: exception.message,
      instance,
      code: exception.code,
    };
  }
  if (exception instanceof HttpException) {
    return fromHttpException(exception, instance);
  }
  return {
    type: 'about:blank',
    title: STATUS_CODES[500]!,
    status: HttpStatus.INTERNAL_SERVER_ERROR,
    instance,
  };
}

function isClassifiedError(exception: unknown): exception is ClassifiedError {
  return (
    exception instanceof Error &&
    'kind' in exception &&
    'code' in exception &&
    typeof exception.kind === 'string' &&
    typeof exception.code === 'string' &&
    exception.kind in STATUS_BY_KIND
  );
}

function fromHttpException(exception: HttpException, instance?: string): ProblemDetails {
  const status = exception.getStatus();
  const body = exception.getResponse();
  const details = typeof body === 'object' ? (body as Record<string, unknown>) : {};
  const message = typeof body === 'string' ? body : details.message;
  return {
    type: 'about:blank',
    title: STATUS_CODES[status] ?? 'Error',
    status,
    detail: Array.isArray(message) ? message.join('; ') : (message as string | undefined),
    instance,
    ...(Array.isArray(details.errors) && { errors: details.errors as ProblemDetails['errors'] }),
  };
}
