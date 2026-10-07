import request from 'supertest';
import { EventPublisher } from '../../src/shared/outbox/event-publisher';
import type { OutboxMessage } from '../../src/shared/outbox/outbox-message';
import { createTestApp, eventually, type TestApp } from '../support/test-app';

class CapturingPublisher extends EventPublisher {
  readonly published: OutboxMessage[] = [];

  publish(message: OutboxMessage): Promise<void> {
    this.published.push(message);
    return Promise.resolve();
  }
}

describe('Outbox relay worker (e2e)', () => {
  const publisher = new CapturingPublisher();
  let testApp: TestApp;

  beforeAll(async () => {
    testApp = await createTestApp({
      publisher,
      env: { OUTBOX_RELAY_ENABLED: 'true', OUTBOX_POLL_INTERVAL_MS: '50' },
    });
  });

  afterAll(() => testApp.app.close());

  it('publishes the events of a placed and cancelled order in the background', async () => {
    const http = request(testApp.app.getHttpServer());
    const { body: order } = await http
      .post('/orders')
      .send({
        customerId: 'c',
        items: [{ sku: 'A', name: 'a', quantity: 1, unitPrice: { amount: 100, currency: 'USD' } }],
      })
      .expect(201);
    await http.post(`/orders/${String(order.id)}/cancel`).expect(200);

    await eventually(() => {
      expect(publisher.published.map((m) => m.type).sort()).toEqual([
        'order.cancelled',
        'order.placed',
      ]);
    });

    expect(publisher.published.every((m) => m.aggregateId === order.id)).toBe(true);
    const rows = await testApp.dataSource.query<{ id: string; status: string }[]>(
      'SELECT id, status FROM outbox_events',
    );
    expect(rows.every((r) => r.status === 'published')).toBe(true);
    expect(rows.map((r) => r.id).sort()).toEqual(publisher.published.map((m) => m.id).sort());
  });

  it('stops polling on shutdown without leaving the app hanging', async () => {
    const started = Date.now();

    await testApp.app.close();

    expect(Date.now() - started).toBeLessThan(2000);
  });
});
