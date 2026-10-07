import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp, type TestApp } from '../support/test-app';

const validBody = {
  customerId: 'customer-1',
  items: [
    { sku: 'SKU-1', name: 'Mug', quantity: 2, unitPrice: { amount: 1999, currency: 'USD' } },
    { sku: 'SKU-2', name: 'Plate', quantity: 1, unitPrice: { amount: 500, currency: 'USD' } },
  ],
};

describe('Orders API (e2e)', () => {
  let testApp: TestApp;
  let http: ReturnType<typeof request>;
  let app: INestApplication;

  beforeAll(async () => {
    testApp = await createTestApp();
    app = testApp.app;
    http = request(app.getHttpServer());
  });

  beforeEach(() => testApp.reset());
  afterAll(() => app.close());

  const placeOrder = (body: object = validBody) => http.post('/orders').send(body);

  describe('POST /orders', () => {
    it('creates an order, computing the total server-side', async () => {
      const res = await placeOrder().expect(201);

      expect(res.headers.location).toBe(`/orders/${String(res.body.id)}`);
      expect(res.body).toMatchObject({
        customerId: 'customer-1',
        status: 'PLACED',
        total: { amount: 4498, currency: 'USD' },
        cancelledAt: null,
      });
      expect(res.body.items[0]).toMatchObject({ sku: 'SKU-1', lineTotal: { amount: 3998 } });
    });

    it('rejects an invalid body with Problem Details listing each field', async () => {
      const res = await placeOrder({
        customerId: '',
        items: [{ sku: 'A', name: 'x', quantity: 0, unitPrice: { amount: 1.5, currency: 'usd' } }],
        extra: true,
      }).expect(400);

      expect(res.headers['content-type']).toMatch(/application\/problem\+json/);
      expect(res.body).toMatchObject({
        type: 'about:blank',
        title: 'Bad Request',
        status: 400,
        instance: '/orders',
      });
      const fields = (res.body.errors as { field: string }[]).map((e) => e.field);
      expect(fields).toEqual(
        expect.arrayContaining([
          'customerId',
          'extra',
          'items.0.quantity',
          'items.0.unitPrice.amount',
          'items.0.unitPrice.currency',
        ]),
      );
    });

    it('rejects an empty items array', async () => {
      const res = await placeOrder({ customerId: 'c', items: [] }).expect(400);

      expect(res.body.errors).toEqual([
        { field: 'items', messages: ['items must contain at least 1 elements'] },
      ]);
    });

    it('maps a business-rule violation to 422', async () => {
      const mixed = {
        customerId: 'c',
        items: [
          { sku: 'A', name: 'a', quantity: 1, unitPrice: { amount: 1, currency: 'USD' } },
          { sku: 'B', name: 'b', quantity: 1, unitPrice: { amount: 1, currency: 'EUR' } },
        ],
      };

      const res = await placeOrder(mixed).expect(422);

      expect(res.headers['content-type']).toMatch(/application\/problem\+json/);
      expect(res.body).toMatchObject({
        status: 422,
        code: 'money.currency_mismatch',
        type: 'urn:problem-type:money.currency_mismatch',
        details: { expected: 'USD', actual: 'EUR' },
      });
    });
  });

  describe('idempotency', () => {
    const withKey = (key: string, body: object = validBody) =>
      http.post('/orders').set('Idempotency-Key', key).send(body);

    it('replays the stored response for the same key and body', async () => {
      const first = await withKey('key-1').expect(201);
      const replay = await withKey('key-1').expect(201);

      expect(replay.body).toEqual(first.body);
      expect(replay.headers['idempotent-replayed']).toBe('true');
      expect(first.headers['idempotent-replayed']).toBeUndefined();
      expect(replay.headers.location).toBe(first.headers.location);

      const list = await http.get('/orders').expect(200);
      expect(list.body.data).toHaveLength(1);
      const outbox = await testApp.dataSource.query<unknown[]>('SELECT 1 FROM outbox_events');
      expect(outbox).toHaveLength(1);
    });

    it('treats a reordered but identical body as the same request', async () => {
      const reordered = { items: validBody.items, customerId: validBody.customerId };
      await withKey('key-2').expect(201);

      const replay = await withKey('key-2', reordered).expect(201);

      expect(replay.headers['idempotent-replayed']).toBe('true');
    });

    it('answers 422 when the key is reused with a different body', async () => {
      await withKey('key-3').expect(201);

      const res = await withKey('key-3', { ...validBody, customerId: 'someone-else' }).expect(422);

      expect(res.body).toMatchObject({ status: 422, code: 'idempotency.key_reuse' });
    });

    it('does not burn the key when the request fails validation', async () => {
      await withKey('key-4', { customerId: 'c', items: [] }).expect(400);

      await withKey('key-4').expect(201);
    });

    it('creates a single order for concurrent requests with the same key', async () => {
      const responses = await Promise.all([1, 2, 3].map(() => withKey('key-5')));

      expect(responses.map((r) => r.status)).toEqual([201, 201, 201]);
      expect(new Set(responses.map((r) => r.body.id as string)).size).toBe(1);
    });

    it('rejects a malformed key with 400', async () => {
      const res = await withKey('has space').expect(400);

      expect(res.body.code).toBe('idempotency.invalid_key');
    });
  });

  describe('GET /orders/:id', () => {
    it('returns the order', async () => {
      const { body: created } = await placeOrder().expect(201);

      const res = await http.get(`/orders/${String(created.id)}`).expect(200);

      expect(res.body).toEqual(created);
    });

    it('answers 404 Problem Details for an unknown id', async () => {
      const res = await http.get('/orders/3f2504e0-4f89-41d3-9a0c-0305e82c3301').expect(404);

      expect(res.body).toMatchObject({
        status: 404,
        code: 'order.not_found',
        details: { orderId: '3f2504e0-4f89-41d3-9a0c-0305e82c3301' },
      });
    });

    it('answers 400 for a malformed id', async () => {
      const res = await http.get('/orders/not-a-uuid').expect(400);

      expect(res.headers['content-type']).toMatch(/problem\+json/);
    });
  });

  describe('GET /orders', () => {
    it('pages through orders newest first using the opaque cursor', async () => {
      const ids: string[] = [];
      for (let i = 0; i < 5; i += 1) {
        ids.unshift((await placeOrder().expect(201)).body.id as string);
        await new Promise((resolve) => setTimeout(resolve, 5));
      }

      const first = await http.get('/orders?limit=2').expect(200);
      const second = await http
        .get(`/orders?limit=2&cursor=${String(first.body.nextCursor)}`)
        .expect(200);
      const third = await http
        .get(`/orders?limit=2&cursor=${String(second.body.nextCursor)}`)
        .expect(200);

      const seen = [first, second, third].flatMap((res) =>
        (res.body.data as { id: string }[]).map((o) => o.id),
      );
      expect(seen).toEqual(ids);
      expect(third.body.nextCursor).toBeNull();
    });

    it('validates the query', async () => {
      await http.get('/orders?limit=0').expect(400);
      const res = await http.get('/orders?cursor=garbage').expect(400);

      expect(res.body.code).toBe('pagination.invalid_cursor');
    });
  });

  describe('POST /orders/:id/cancel', () => {
    it('cancels a placed order', async () => {
      const { body: created } = await placeOrder().expect(201);

      const res = await http.post(`/orders/${String(created.id)}/cancel`).expect(200);

      expect(res.body.status).toBe('CANCELLED');
      expect(res.body.cancelledAt).not.toBeNull();
      const stored = await http.get(`/orders/${String(created.id)}`).expect(200);
      expect(stored.body.status).toBe('CANCELLED');
    });

    it('answers 409 when cancelling twice', async () => {
      const { body: created } = await placeOrder().expect(201);
      await http.post(`/orders/${String(created.id)}/cancel`).expect(200);

      const res = await http.post(`/orders/${String(created.id)}/cancel`).expect(409);

      expect(res.body).toMatchObject({ status: 409, code: 'order.already_cancelled' });
    });

    it('answers 404 for an unknown order', async () => {
      await http.post('/orders/3f2504e0-4f89-41d3-9a0c-0305e82c3301/cancel').expect(404);
    });

    it('lets exactly one of two concurrent cancellations win, the other gets 409', async () => {
      const { body: created } = await placeOrder().expect(201);

      const results = await Promise.all([
        http.post(`/orders/${String(created.id)}/cancel`),
        http.post(`/orders/${String(created.id)}/cancel`),
      ]);

      expect(results.map((r) => r.status).sort()).toEqual([200, 409]);
    });
  });

  describe('platform endpoints', () => {
    it('reports health including the database', async () => {
      const res = await http.get('/health').expect(200);

      expect(res.body).toMatchObject({ status: 'ok', info: { database: { status: 'up' } } });
    });

    it('serves the OpenAPI document', async () => {
      const res = await http.get('/docs-json').expect(200);

      expect(Object.keys(res.body.paths as object)).toEqual(
        expect.arrayContaining(['/orders', '/orders/{id}', '/orders/{id}/cancel', '/health']),
      );
    });

    it('answers unknown routes with Problem Details', async () => {
      const res = await http.get('/nope').expect(404);

      expect(res.headers['content-type']).toMatch(/problem\+json/);
    });
  });
});
