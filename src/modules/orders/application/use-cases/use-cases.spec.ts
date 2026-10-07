import { EmptyOrderError, OrderAlreadyCancelledError } from '../../domain/errors/order-errors';
import { OrderStatus } from '../../domain/order-status';
import { ConcurrentModificationError, OrderNotFoundError } from '../errors/order-errors';
import { FixedClock, PassThroughUnitOfWork, SequentialIdGenerator } from '../testing/fakes';
import { InMemoryOrderRepository } from '../testing/in-memory-order.repository';
import { CancelOrder } from './cancel-order.use-case';
import { GetOrder } from './get-order.use-case';
import { ListOrders } from './list-orders.use-case';
import { PlaceOrder, type PlaceOrderCommand } from './place-order.use-case';
import { OrderId } from '../../domain/order-id';

const command: PlaceOrderCommand = {
  customerId: 'customer-1',
  items: [
    { sku: 'SKU-1', name: 'Widget', quantity: 2, unitPrice: { amount: 500, currency: 'USD' } },
  ],
};

function setup() {
  const repository = new InMemoryOrderRepository();
  const unitOfWork = new PassThroughUnitOfWork();
  const clock = new FixedClock(new Date('2026-01-15T10:00:00.000Z'));
  const ids = new SequentialIdGenerator();
  return {
    repository,
    unitOfWork,
    clock,
    placeOrder: new PlaceOrder(repository, unitOfWork, clock, ids),
    cancelOrder: new CancelOrder(repository, unitOfWork, clock),
    getOrder: new GetOrder(repository),
    listOrders: new ListOrders(repository),
  };
}

describe('PlaceOrder', () => {
  it('persists a PLACED order inside a unit of work and emits OrderPlaced', async () => {
    const { placeOrder, getOrder, repository, unitOfWork } = setup();

    const placed = await placeOrder.execute(command);

    expect(unitOfWork.runs).toBe(1);
    expect(repository.publishedEvents.map((e) => e.name)).toEqual(['order.placed']);
    const stored = await getOrder.execute(placed.id.value);
    expect(stored.status).toBe(OrderStatus.PLACED);
    expect(stored.total.amount).toBe(1000);
  });

  it('surfaces domain errors and persists nothing', async () => {
    const { placeOrder, repository } = setup();

    await expect(placeOrder.execute({ ...command, items: [] })).rejects.toThrow(EmptyOrderError);
    expect(repository.publishedEvents).toEqual([]);
  });
});

describe('GetOrder', () => {
  it('fails with OrderNotFoundError for an unknown id', async () => {
    const { getOrder } = setup();

    await expect(getOrder.execute('3f2504e0-4f89-41d3-9a0c-0305e82c3301')).rejects.toThrow(
      OrderNotFoundError,
    );
  });
});

describe('CancelOrder', () => {
  it('cancels with the clock time and emits OrderCancelled', async () => {
    const { placeOrder, cancelOrder, getOrder, clock, repository } = setup();
    const placed = await placeOrder.execute(command);
    const cancelTime = new Date('2026-01-15T12:00:00.000Z');
    clock.advanceTo(cancelTime);

    await cancelOrder.execute(placed.id.value);

    const stored = await getOrder.execute(placed.id.value);
    expect(stored.status).toBe(OrderStatus.CANCELLED);
    expect(stored.cancelledAt).toEqual(cancelTime);
    expect(repository.publishedEvents.map((e) => e.name)).toEqual([
      'order.placed',
      'order.cancelled',
    ]);
  });

  it('fails when the order is already cancelled', async () => {
    const { placeOrder, cancelOrder } = setup();
    const placed = await placeOrder.execute(command);
    await cancelOrder.execute(placed.id.value);

    await expect(cancelOrder.execute(placed.id.value)).rejects.toThrow(OrderAlreadyCancelledError);
  });

  it('fails for an unknown order', async () => {
    const { cancelOrder } = setup();

    await expect(cancelOrder.execute('3f2504e0-4f89-41d3-9a0c-0305e82c3301')).rejects.toThrow(
      OrderNotFoundError,
    );
  });

  it('propagates a concurrent modification from the repository', async () => {
    const { placeOrder, repository } = setup();
    const placed = await placeOrder.execute(command);
    const first = await repository.findById(OrderId.from(placed.id.value));
    const second = await repository.findById(OrderId.from(placed.id.value));
    first!.cancel(new Date());
    second!.cancel(new Date());
    await repository.save(first!);

    await expect(repository.save(second!)).rejects.toThrow(ConcurrentModificationError);
  });
});

describe('ListOrders', () => {
  it('returns newest first and pages with a cursor', async () => {
    const { placeOrder, listOrders, clock } = setup();
    for (const hour of [10, 11, 12]) {
      clock.advanceTo(new Date(`2026-01-15T${hour}:00:00.000Z`));
      await placeOrder.execute(command);
    }

    const firstPage = await listOrders.execute({ limit: 2 });
    expect(firstPage.orders.map((o) => o.placedAt.getUTCHours())).toEqual([12, 11]);
    expect(firstPage.nextCursor).toBeDefined();

    const secondPage = await listOrders.execute({ limit: 2, after: firstPage.nextCursor });
    expect(secondPage.orders.map((o) => o.placedAt.getUTCHours())).toEqual([10]);
    expect(secondPage.nextCursor).toBeUndefined();
  });

  it('returns an empty page when there are no orders', async () => {
    const { listOrders } = setup();

    expect(await listOrders.execute({ limit: 10 })).toEqual({
      orders: [],
      nextCursor: undefined,
    });
  });
});
