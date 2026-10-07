import { ArgumentsHost, Logger } from '@nestjs/common';
import { QueryFailedError } from 'typeorm';
import { ApplicationError } from '../kernel/errors/application-error';
import { GlobalExceptionFilter } from './global-exception.filter';

class NotFoundError extends ApplicationError {
  readonly kind = 'not_found';
  readonly code = 'thing.not_found';
}

function host(request: object) {
  const response = {
    set: jest.fn().mockReturnThis(),
    status: jest.fn().mockReturnThis(),
    type: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  };
  const argumentsHost = {
    switchToHttp: () => ({ getRequest: () => request, getResponse: () => response }),
  } as unknown as ArgumentsHost;
  return { argumentsHost, response };
}

describe('GlobalExceptionFilter', () => {
  const request = { method: 'POST', originalUrl: '/orders?x=1', id: 'req-7' };
  let errorLog: jest.SpyInstance;
  let debugLog: jest.SpyInstance;

  beforeEach(() => {
    errorLog = jest.spyOn(Logger.prototype, 'error').mockImplementation();
    debugLog = jest.spyOn(Logger.prototype, 'debug').mockImplementation();
  });
  afterEach(() => jest.restoreAllMocks());

  it('writes problem+json with mapped headers', () => {
    const { argumentsHost, response } = host(request);
    const error = new QueryFailedError('q', [], Object.assign(new Error('x'), { code: '40001' }));

    new GlobalExceptionFilter().catch(error, argumentsHost);

    expect(response.set).toHaveBeenCalledWith({ 'Retry-After': '1' });
    expect(response.status).toHaveBeenCalledWith(503);
    expect(response.type).toHaveBeenCalledWith('application/problem+json');
    expect(response.json).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'persistence.retryable', instance: '/orders?x=1' }),
    );
  });

  it('logs server errors in full but answers a generic body', () => {
    const { argumentsHost, response } = host(request);
    const error = new Error('password=hunter2');

    new GlobalExceptionFilter().catch(error, argumentsHost);

    expect(errorLog).toHaveBeenCalledWith(
      expect.objectContaining({
        method: 'POST',
        url: '/orders?x=1',
        requestId: 'req-7',
        status: 500,
        err: error,
      }),
    );
    expect(JSON.stringify(response.json.mock.calls)).not.toContain('hunter2');
  });

  it('logs client errors at debug level without the error object', () => {
    const { argumentsHost } = host(request);

    new GlobalExceptionFilter().catch(new NotFoundError('missing'), argumentsHost);

    expect(errorLog).not.toHaveBeenCalled();
    const [entry] = debugLog.mock.calls[0] as [Record<string, unknown>];
    expect(entry).toMatchObject({ status: 404, code: 'thing.not_found' });
    expect(entry).not.toHaveProperty('err');
  });

  it('tolerates requests without an id', () => {
    const { argumentsHost } = host({ method: 'GET', originalUrl: '/x' });

    new GlobalExceptionFilter().catch(new Error('x'), argumentsHost);

    expect(errorLog).toHaveBeenCalledWith(expect.objectContaining({ requestId: undefined }));
  });
});
