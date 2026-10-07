import { DataSource } from 'typeorm';
import { ConcurrentModificationError } from '../../src/modules/orders/application/errors/application-error';
import { OrderRepository } from '../../src/modules/orders/application/ports/order.repository';
import { UnitOfWork } from '../../src/modules/orders/application/ports/unit-of-work';
import { OrderStatus } from '../../src/modules/orders/domain/order-status';
import { OutboxWriter } from '../../src/shared/outbox/outbox-writer';
import { buildOrder } from '../support/builders';
import { createTestApp, type TestApp } from '../support/test-app';

describe('TypeormOrderRepository (integration)', () => {
  let testApp: TestApp;
  let repository: OrderRepository;
  let unitOfWork: UnitOfWork;
  let dataSource: DataSource;

  beforeAll(async () => {
    testApp = await createTestApp();
    repository = testApp.app.get(OrderRepository);
    unitOfWork = testApp.app.get(UnitOfWork);
    dataSource = testApp.dataSource;
  });

  beforeEach(() => testApp.reset());
  afterAll(() => testApp.app.close());

  const count = async (table: string): Promise<number> => {
    const [row] = await dataSource.query<{ count: string }[]>(`SELECT count(*) FROM ${table}`);
    return Number(row?.count);
  };

  describe('round trip', () => {
    it('persists and reloads an order with items in order', async () => {
      const order = buildOrder();
      await repository.save(order);

      const loaded = await repository.findById(order.id);

      expect(loaded).toBeDefined();
      expect(loaded?.customerId).toBe('customer-1');
      expect(loaded?.items.map((i) => i.sku)).toEqual(['SKU-1', 'SKU-2']);
      expect(loaded?.total.amount).toBe(4498);
      expect(loaded?.placedAt).toEqual(order.placedAt);
      expect(loaded?.cancelledAt).toBeUndefined();
      expect(loaded?.version).toBe(1);
    });

    it('persists a cancellation and bumps the version', async () => {
      const order = buildOrder();
      await repository.save(order);
      const loaded = (await repository.findById(order.id))!;
      const cancelledAt = new Date('2026-02-01T10:00:00.000Z');
      loaded.cancel(cancelledAt);
      await repository.save(loaded);

      const reloaded = (await repository.findById(order.id))!;

      expect(reloaded.status).toBe(OrderStatus.CANCELLED);
      expect(reloaded.cancelledAt).toEqual(cancelledAt);
      expect(reloaded.version).toBe(2);
    });

    it('returns undefined for an unknown id', async () => {
      expect(await repository.findById(buildOrder().id)).toBeUndefined();
    });
  });

  describe('list', () => {
    it('pages newest first with keyset cursors, including ties on placed_at', async () => {
      const sameInstant = new Date('2026-03-01T10:00:00.000Z');
      const orders = [
        buildOrder({ placedAt: new Date('2026-03-01T09:00:00.000Z') }),
        buildOrder({ placedAt: sameInstant }),
        buildOrder({ placedAt: sameInstant }),
        buildOrder({ placedAt: new Date('2026-03-01T11:00:00.000Z') }),
        buildOrder({ placedAt: new Date('2026-03-01T12:00:00.000Z') }),
      ];
      for (const order of orders) {
        await repository.save(order);
      }

      const seen: string[] = [];
      let after;
      do {
        const page = await repository.list({ limit: 2, after });
        seen.push(...page.orders.map((o) => o.id.value));
        expect(page.orders.every((o) => o.items.length === 2)).toBe(true);
        after = page.nextCursor;
      } while (after);

      const expected = [...orders]
        .sort(
          (a, b) =>
            b.placedAt.getTime() - a.placedAt.getTime() || b.id.value.localeCompare(a.id.value),
        )
        .map((o) => o.id.value);
      expect(seen).toEqual(expected);
    });

    it('returns no cursor on the last page', async () => {
      await repository.save(buildOrder());

      const page = await repository.list({ limit: 1 });

      expect(page.orders).toHaveLength(1);
      expect(page.nextCursor).toBeUndefined();
    });
  });

  describe('transactional outbox', () => {
    it('commits the order and its outbox row together', async () => {
      const order = buildOrder();
      await repository.save(order);

      const rows = await dataSource.query<
        { event_type: string; aggregate_id: string; status: string }[]
      >('SELECT event_type, aggregate_id, status FROM outbox_events');

      expect(rows).toEqual([
        { event_type: 'order.placed', aggregate_id: order.id.value, status: 'pending' },
      ]);
    });

    it('writes one outbox row per domain event', async () => {
      const order = buildOrder();
      await repository.save(order);
      const loaded = (await repository.findById(order.id))!;
      loaded.cancel(new Date());
      await repository.save(loaded);

      const rows = await dataSource.query<{ event_type: string }[]>(
        'SELECT event_type FROM outbox_events ORDER BY occurred_at, event_type',
      );

      expect(rows.map((r) => r.event_type).sort()).toEqual(['order.cancelled', 'order.placed']);
    });

    it('rolls back the order and the outbox row together', async () => {
      const order = buildOrder();

      await expect(
        unitOfWork.run(async () => {
          await repository.save(order);
          throw new Error('abort');
        }),
      ).rejects.toThrow('abort');

      expect(await count('orders')).toBe(0);
      expect(await count('order_items')).toBe(0);
      expect(await count('outbox_events')).toBe(0);
    });

    it('rolls the order back when the outbox write fails', async () => {
      const order = buildOrder();
      const [event] = order.pullEvents();
      await dataSource.query(
        `INSERT INTO outbox_events (id, aggregate_type, aggregate_id, event_type, payload, occurred_at)
         VALUES ($1, 'order', 'x', 'order.placed', '{}', now())`,
        [event!.eventId],
      );
      const clashing = buildOrder();
      jest.spyOn(clashing, 'pullEvents').mockReturnValue([event!]);

      await expect(repository.save(clashing)).rejects.toThrow();

      expect(await count('orders')).toBe(0);
    });

    it('refuses to write outbox rows outside a transaction', async () => {
      const writer = testApp.app.get(OutboxWriter);

      await expect(
        writer.write([
          {
            id: '3f2504e0-4f89-41d3-9a0c-0305e82c3301',
            type: 't',
            aggregateType: 'a',
            aggregateId: '1',
            payload: {},
            occurredAt: new Date(),
          },
        ]),
      ).rejects.toThrow(/must run inside/);
    });
  });

  describe('optimistic concurrency', () => {
    it('rejects the second of two writers that loaded the same version', async () => {
      const order = buildOrder();
      await repository.save(order);
      const first = (await repository.findById(order.id))!;
      const second = (await repository.findById(order.id))!;
      first.cancel(new Date());
      second.cancel(new Date());

      await repository.save(first);

      await expect(repository.save(second)).rejects.toThrow(ConcurrentModificationError);
      expect(await count('outbox_events')).toBe(2);
    });
  });
});
