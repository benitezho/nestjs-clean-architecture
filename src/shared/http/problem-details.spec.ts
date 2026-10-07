import { BadRequestException, NotFoundException } from '@nestjs/common';
import { toProblemDetails } from './problem-details';

class FakeConflict extends Error {
  readonly kind = 'conflict';
  readonly code = 'thing.conflict';
}

describe('toProblemDetails', () => {
  it.each([
    ['conflict', 409],
    ['not_found', 404],
    ['validation', 422],
    ['bad_request', 400],
  ])('maps error kind %s to HTTP %i', (kind, status) => {
    const error = Object.assign(new Error('boom'), { kind, code: 'x.y' });

    const problem = toProblemDetails(error, '/things/1');

    expect(problem).toMatchObject({
      type: 'urn:problem-type:x.y',
      status,
      detail: 'boom',
      instance: '/things/1',
      code: 'x.y',
    });
  });

  it('uses the status phrase as title', () => {
    expect(toProblemDetails(new FakeConflict('x')).title).toBe('Conflict');
  });

  it('keeps status and validation errors of HttpExceptions', () => {
    const errors = [{ field: 'items', messages: ['items must not be empty'] }];

    const problem = toProblemDetails(new BadRequestException({ message: 'Invalid', errors }));

    expect(problem).toMatchObject({ status: 400, title: 'Bad Request', detail: 'Invalid', errors });
  });

  it('maps framework exceptions generically', () => {
    expect(toProblemDetails(new NotFoundException('nope'))).toMatchObject({
      status: 404,
      detail: 'nope',
    });
  });

  it('does not leak the message of unknown errors', () => {
    const problem = toProblemDetails(new Error('connection string postgres://secret'));

    expect(problem).toMatchObject({ status: 500, title: 'Internal Server Error' });
    expect(problem.detail).toBeUndefined();
  });

  it('ignores errors that carry an unknown kind', () => {
    const error = Object.assign(new Error('x'), { kind: 'weird', code: 'a.b' });

    expect(toProblemDetails(error).status).toBe(500);
  });
});
