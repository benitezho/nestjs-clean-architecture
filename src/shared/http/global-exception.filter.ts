import { ArgumentsHost, Catch, ExceptionFilter, Logger } from '@nestjs/common';
import type { Request, Response } from 'express';
import { toProblemResponse } from './exception-mapping';

const SERVER_ERROR = 500;

/**
 * Last line of defence: every error leaves the API as application/problem+json.
 * Server errors are logged in full here and never described to the client.
 */
@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    const request = http.getRequest<Request>();
    const { problem, headers } = toProblemResponse(exception, request.originalUrl);
    this.log(exception, request, problem.status, problem.code);

    const response = http.getResponse<Response>();
    response.set(headers).status(problem.status).type('application/problem+json').json(problem);
  }

  private log(exception: unknown, request: Request, status: number, code?: string): void {
    const context = {
      method: request.method,
      url: request.originalUrl,
      requestId: requestIdOf(request),
    };
    if (status >= SERVER_ERROR) {
      this.logger.error({ ...context, status, code, err: exception });
    } else {
      this.logger.debug({ ...context, status, code });
    }
  }
}

/** Set by pino-http (or any middleware that assigns `req.id`). */
function requestIdOf(request: Request): string | undefined {
  const { id } = request as Request & { id?: unknown };
  return typeof id === 'string' || typeof id === 'number' ? String(id) : undefined;
}
