import { randomUUID } from 'node:crypto';
import { DataSource } from 'typeorm';
import { EventPublisher } from '../../src/shared/outbox/event-publisher';
import type { OutboxMessage } from '../../src/shared/outbox/outbox-message';
import { OutboxConfig } from '../../src/shared/outbox/outbox.config';
import { OutboxRelay } from '../../src/shared/outbox/outbox-relay';
import { createTestApp, type TestApp } from '../support/test-app';

class ScriptedPublisher extends EventPublisher {
  readonly published: OutboxMessage[] = [];
  failWith?: Error;
  delayMs = 0;

  async publish(message: OutboxMessage): Promise<void> {
    if (this.delayMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, this.delayMs));
    }
    if (this.failWith) {
      throw this.failWith;
    }
    this.published.push(message);
  }
}

interface OutboxRow {
  status: string;
  attempts: number;
  next_attempt_at: Date;
  published_at: Date | null;
  last_error: string | null;
}

describe('OutboxRelay (integration)', () => {
  const NOW = new Date('2026-04-01T12:00:00.000Z');
  const publisher = new ScriptedPublisher();
  let testApp: TestApp;
  let dataSource: DataSource;
  let relay: OutboxRelay;

  beforeAll(async () => {
    testApp = await createTestApp({
      publisher,
      env: { OUTBOX_MAX_ATTEMPTS: '3', OUTBOX_BACKOFF_BASE_MS: '1000', OUTBOX_BATCH_SIZE: '10' },
    });
    dataSource = testApp.dataSource;
    relay = testApp.app.get(OutboxRelay);
  });

  beforeEach(async () => {
    await testApp.reset();
    publisher.published.length = 0;
    publisher.failWith = undefined;
    publisher.delayMs = 0;
  });

  afterAll(() => testApp.app.close());

  async function insertEvent(id = randomUUID()): Promise<string> {
    await dataSource.query(
      `INSERT INTO outbox_events (id, aggregate_type, aggregate_id, event_type, payload, occurred_at, next_attempt_at)
       VALUES ($1, 'order', 'agg-1', 'order.placed', '{"orderId":"agg-1"}', $2, $2)`,
      [id, NOW],
    );
    return id;
  }

  async function rowOf(id: string): Promise<OutboxRow> {
    const [row] = await dataSource.query<OutboxRow[]>(
      'SELECT status, attempts, next_attempt_at, published_at, last_error FROM outbox_events WHERE id = $1',
      [id],
    );
    return row!;
  }

  it('publishes pending events keyed by event id and marks them published', async () => {
    const id = await insertEvent();

    const result = await relay.processBatch(NOW);

    expect(result).toEqual({ claimed: 1, published: 1, retried: 0, failed: 0 });
    expect(publisher.published).toEqual([
      expect.objectContaining({
        id,
        type: 'order.placed',
        aggregateId: 'agg-1',
        payload: { orderId: 'agg-1' },
      }),
    ]);
    expect(await rowOf(id)).toMatchObject({ status: 'published', published_at: NOW });
  });

  it('does not publish an event twice', async () => {
    await insertEvent();

    await relay.processBatch(NOW);
    const second = await relay.processBatch(NOW);

    expect(second.claimed).toBe(0);
    expect(publisher.published).toHaveLength(1);
  });

  it('retries with exponential backoff and ignores rows that are not due yet', async () => {
    const id = await insertEvent();
    publisher.failWith = new Error('broker down');

    await relay.processBatch(NOW);
    expect(await rowOf(id)).toMatchObject({
      status: 'pending',
      attempts: 1,
      next_attempt_at: new Date(NOW.getTime() + 1000),
      last_error: 'broker down',
    });

    const tooEarly = await relay.processBatch(new Date(NOW.getTime() + 999));
    expect(tooEarly.claimed).toBe(0);

    await relay.processBatch(new Date(NOW.getTime() + 1000));
    expect((await rowOf(id)).attempts).toBe(2);
    expect((await rowOf(id)).next_attempt_at).toEqual(new Date(NOW.getTime() + 1000 + 2000));
  });

  it('recovers when the publisher heals and clears the last error', async () => {
    const id = await insertEvent();
    publisher.failWith = new Error('broker down');
    await relay.processBatch(NOW);

    publisher.failWith = undefined;
    await relay.processBatch(new Date(NOW.getTime() + 1000));

    expect(await rowOf(id)).toMatchObject({ status: 'published', attempts: 1, last_error: null });
  });

  it('moves to terminal failed after max attempts and never picks it up again', async () => {
    const id = await insertEvent();
    publisher.failWith = new Error('permanent');
    let clock = NOW.getTime();

    const results = [];
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      results.push(await relay.processBatch(new Date(clock)));
      clock += 60_000;
    }

    expect(results.map((r) => [r.retried, r.failed])).toEqual([
      [1, 0],
      [1, 0],
      [0, 1],
    ]);
    expect(await rowOf(id)).toMatchObject({
      status: 'failed',
      attempts: 3,
      last_error: 'permanent',
    });
    expect((await relay.processBatch(new Date(clock + 3_600_000))).claimed).toBe(0);
  });

  it('one failing event does not block the others in the batch', async () => {
    const good = await insertEvent();
    const bad = await insertEvent();
    publisher.published.length = 0;
    const original = publisher.publish.bind(publisher);
    jest.spyOn(publisher, 'publish').mockImplementation((message) => {
      if (message.id === bad) {
        return Promise.reject(new Error('poison'));
      }
      return original(message);
    });

    const result = await relay.processBatch(NOW);

    expect(result).toMatchObject({ claimed: 2, published: 1, retried: 1 });
    expect((await rowOf(good)).status).toBe('published');
    expect((await rowOf(bad)).status).toBe('pending');
    jest.restoreAllMocks();
  });

  it('two relays running concurrently never publish the same event twice (SKIP LOCKED)', async () => {
    const ids = await Promise.all(Array.from({ length: 20 }, () => insertEvent()));
    publisher.delayMs = 20;
    const relayA = relay;
    const relayB = new OutboxRelay(dataSource, publisher, testApp.app.get(OutboxConfig));

    const [a, b] = await Promise.all([relayA.processBatch(NOW), relayB.processBatch(NOW)]);

    expect(a.claimed).toBeGreaterThan(0);
    expect(b.claimed).toBeGreaterThan(0);
    expect(a.published + b.published).toBe(20);
    const publishedIds = publisher.published.map((m) => m.id);
    expect(new Set(publishedIds).size).toBe(20);
    expect([...publishedIds].sort()).toEqual([...ids].sort());
  });
});
