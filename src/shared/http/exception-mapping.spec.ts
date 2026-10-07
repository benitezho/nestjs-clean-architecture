import { BadRequestException, NotFoundException } from '@nestjs/common';
import { QueryFailedError } from 'typeorm';
import { ApplicationError } from '../kernel/errors/application-error';
import type { ErrorKind } from '../kernel/errors/base-error';
import { DomainError } from '../kernel/errors/domain-error';
import { toProblemResponse } from './exception-mapping';

class AppFailure extends ApplicationError {
  constructor(
    readonly kind: ErrorKind,
    details?: Record<string, unknown>,
  ) {
    super('boom', details);
  }
  readonly code = 'x.y';
}

class RuleFailure extends DomainError {
  readonly kind = 'conflict';
  readonly code = 'rule.conflict';
}

function dbError(sqlState: string): QueryFailedError {
  const driverError = Object.assign(new Error('duplicate key value violates "uq_secret"'), {
    code: sqlState,
  });
  return new QueryFailedError('INSERT INTO secrets ...', [], driverError);
}

describe('toProblemResponse', () => {
  describe('BaseError', () => {
    it.each<[ErrorKind, number, string]>([
      ['bad_request', 400, 'Bad Request'],
      ['validation', 422, 'Unprocessable Entity'],
      ['not_found', 404, 'Not Found'],
      ['conflict', 409, 'Conflict'],
    ])('maps kind %s to HTTP %i', (kind, status, title) => {
      const { problem, headers } = toProblemResponse(new AppFailure(kind), '/things/1');

      expect(problem).toEqual({
        type: 'urn:problem-type:x.y',
        title,
        status,
        detail: 'boom',
        instance: '/things/1',
        code: 'x.y',
      });
      expect(headers).toEqual({});
    });

    it('passes details through as an extension member', () => {
      const { problem } = toProblemResponse(new AppFailure('validation', { max: 3 }));

      expect(problem.details).toEqual({ max: 3 });
    });

    it('omits details when there are none', () => {
      expect(toProblemResponse(new AppFailure('conflict')).problem).not.toHaveProperty('details');
    });

    it('treats domain and application errors alike', () => {
      expect(toProblemResponse(new RuleFailure('x')).problem).toMatchObject({
        status: 409,
        code: 'rule.conflict',
      });
    });
  });

  describe('HttpException', () => {
    it('keeps status and validation errors', () => {
      const errors = [{ field: 'items', messages: ['items must not be empty'] }];

      const { problem } = toProblemResponse(
        new BadRequestException({ message: 'Invalid', errors }),
      );

      expect(problem).toMatchObject({
        type: 'about:blank',
        status: 400,
        title: 'Bad Request',
        detail: 'Invalid',
        errors,
      });
    });

    it('maps framework exceptions generically', () => {
      expect(toProblemResponse(new NotFoundException('nope')).problem).toMatchObject({
        status: 404,
        detail: 'nope',
      });
    });
  });

  describe('QueryFailedError', () => {
    it('maps unique_violation (23505) to 409 without leaking SQL or constraints', () => {
      const { problem, headers } = toProblemResponse(dbError('23505'), '/orders');

      expect(problem).toMatchObject({
        type: 'urn:problem-type:persistence.unique_violation',
        status: 409,
        code: 'persistence.unique_violation',
        instance: '/orders',
      });
      expect(JSON.stringify(problem)).not.toMatch(/uq_secret|INSERT|secrets/);
      expect(headers).toEqual({});
    });

    it.each(['40001', '40P01'])('maps %s to 503 with Retry-After', (sqlState) => {
      const { problem, headers } = toProblemResponse(dbError(sqlState));

      expect(problem).toMatchObject({ status: 503, code: 'persistence.retryable' });
      expect(headers).toEqual({ 'Retry-After': '1' });
    });

    it('maps other database errors to 500 without leaking them', () => {
      const { problem } = toProblemResponse(dbError('42P01'));

      expect(problem).toMatchObject({ status: 500, title: 'Internal Server Error' });
      expect(JSON.stringify(problem)).not.toMatch(/uq_secret|INSERT|secrets/);
    });

    it('maps a driver error without a code to 500', () => {
      const error = new QueryFailedError('SELECT 1', [], new Error('no code'));

      expect(toProblemResponse(error).problem.status).toBe(500);
    });
  });

  describe('unknown errors', () => {
    it('answers 500 with a generic detail and never leaks the message', () => {
      const { problem } = toProblemResponse(new Error('connection string postgres://secret'), '/x');

      expect(problem).toEqual({
        type: 'about:blank',
        title: 'Internal Server Error',
        status: 500,
        detail: 'An unexpected error occurred',
        instance: '/x',
      });
    });

    it('handles thrown non-errors', () => {
      expect(toProblemResponse('just a string').problem.status).toBe(500);
    });

    it('does not trust look-alike objects that are not BaseError', () => {
      const lookAlike = Object.assign(new Error('x'), { kind: 'conflict', code: 'a.b' });

      expect(toProblemResponse(lookAlike).problem.status).toBe(500);
    });
  });
});
