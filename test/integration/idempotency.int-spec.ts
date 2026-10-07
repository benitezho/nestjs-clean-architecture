import {
  IdempotencyService,
  type StoredResponse,
} from '../../src/shared/idempotency/idempotency.service';
import {
  IdempotencyKeyReuseError,
  InvalidIdempotencyKeyError,
} from '../../src/shared/idempotency/idempotency.errors';
import { TransactionManager } from '../../src/shared/database/transaction-manager';
import { createTestApp, type TestApp } from '../support/test-app';

describe('IdempotencyService (integration)', () => {
  let testApp: TestApp;
  let service: IdempotencyService;
  let transactions: TransactionManager;

  beforeAll(async () => {
    testApp = await createTestApp();
    service = testApp.app.get(IdempotencyService);
    transactions = testApp.app.get(TransactionManager);
  });

  beforeEach(() => testApp.reset());
  afterAll(() => testApp.app.close());

  const request = (key: string, requestHash = 'a'.repeat(64)) => ({
    scope: 'POST /things',
    key,
    requestHash,
  });
  const ok = (id: number): StoredResponse => ({ status: 201, body: { id } });

  it('runs the handler once and replays the stored response', async () => {
    const handler = jest.fn(() => Promise.resolve(ok(1)));

    const first = await service.execute(request('k1'), handler);
    const second = await service.execute(request('k1'), handler);

    expect(handler).toHaveBeenCalledTimes(1);
    expect(first).toEqual({ replayed: false, response: ok(1) });
    expect(second).toEqual({ replayed: true, response: ok(1) });
  });

  it('rejects the same key with a different request hash', async () => {
    await service.execute(request('k1'), () => Promise.resolve(ok(1)));

    await expect(
      service.execute(request('k1', 'b'.repeat(64)), () => Promise.resolve(ok(2))),
    ).rejects.toThrow(IdempotencyKeyReuseError);
  });

  it('scopes keys: the same key in another scope is independent', async () => {
    await service.execute(request('k1'), () => Promise.resolve(ok(1)));

    const other = await service.execute({ ...request('k1'), scope: 'POST /other' }, () =>
      Promise.resolve(ok(2)),
    );

    expect(other.replayed).toBe(false);
  });

  it('does not consume the key when the handler fails', async () => {
    await expect(
      service.execute(request('k1'), () => Promise.reject(new Error('boom'))),
    ).rejects.toThrow('boom');

    const retry = await service.execute(request('k1'), () => Promise.resolve(ok(1)));

    expect(retry.replayed).toBe(false);
  });

  it('serialises concurrent requests with the same key: the handler runs once', async () => {
    const handler = jest.fn(async () => {
      await new Promise((resolve) => setTimeout(resolve, 100));
      return ok(7);
    });

    const results = await Promise.all([
      service.execute(request('k1'), handler),
      service.execute(request('k1'), handler),
      service.execute(request('k1'), handler),
    ]);

    expect(handler).toHaveBeenCalledTimes(1);
    expect(results.filter((r) => r.replayed)).toHaveLength(2);
    expect(results.every((r) => r.response.body.id === 7)).toBe(true);
  });

  it('commits the key together with the handler writes', async () => {
    await expect(
      service.execute(request('k1'), async () => {
        await transactions.manager.query(
          `INSERT INTO outbox_events (id, aggregate_type, aggregate_id, event_type, payload, occurred_at)
           VALUES (gen_random_uuid(), 'a', '1', 't', '{}', now())`,
        );
        throw new Error('after write');
      }),
    ).rejects.toThrow('after write');

    const [row] = await testApp.dataSource.query<{ count: string }[]>(
      'SELECT count(*) FROM outbox_events',
    );
    expect(Number(row?.count)).toBe(0);
  });

  it.each(['', ' ', 'has space', 'x'.repeat(256), 'ñandú'])(
    'rejects invalid key %p',
    async (key) => {
      await expect(service.execute(request(key), () => Promise.resolve(ok(1)))).rejects.toThrow(
        InvalidIdempotencyKeyError,
      );
    },
  );
});
