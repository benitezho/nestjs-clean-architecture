import { DomainEvent } from './events/domain-event';
import { OrderCancelled } from './events/order-cancelled.event';
import { OrderPlaced } from './events/order-placed.event';
import {
  CurrencyMismatchError,
  EmptyOrderError,
  InvalidOrderError,
  OrderAlreadyCancelledError,
} from './errors/order-errors';
import { Money } from './money';
import { OrderId } from './order-id';
import { OrderItem } from './order-item';
import { OrderStatus } from './order-status';

export interface PlaceOrderProps {
  id: OrderId;
  customerId: string;
  items: OrderItem[];
  placedAt: Date;
}

export interface OrderSnapshot {
  id: OrderId;
  customerId: string;
  items: OrderItem[];
  status: OrderStatus;
  placedAt: Date;
  cancelledAt?: Date;
  version: number;
}

export class Order {
  private readonly pendingEvents: DomainEvent[] = [];

  private constructor(
    readonly id: OrderId,
    readonly customerId: string,
    private readonly lineItems: readonly OrderItem[],
    private currentStatus: OrderStatus,
    readonly placedAt: Date,
    private cancellationDate: Date | undefined,
    /** 0 until first persisted; then the optimistic-concurrency token. */
    readonly version: number,
  ) {}

  static place(props: PlaceOrderProps): Order {
    if (props.customerId.trim() === '') {
      throw new InvalidOrderError('Customer id must not be blank');
    }
    Order.assertValidItems(props.items);

    const order = new Order(
      props.id,
      props.customerId,
      [...props.items],
      OrderStatus.PLACED,
      props.placedAt,
      undefined,
      0,
    );
    order.pendingEvents.push(
      new OrderPlaced(
        props.id.value,
        props.placedAt,
        props.customerId,
        order.total,
        props.items.length,
      ),
    );
    return order;
  }

  /** Rebuilds a persisted order. Trusts the stored state and records no events. */
  static rehydrate(snapshot: OrderSnapshot): Order {
    return new Order(
      snapshot.id,
      snapshot.customerId,
      [...snapshot.items],
      snapshot.status,
      snapshot.placedAt,
      snapshot.cancelledAt,
      snapshot.version,
    );
  }

  get items(): readonly OrderItem[] {
    return this.lineItems;
  }

  get status(): OrderStatus {
    return this.currentStatus;
  }

  get cancelledAt(): Date | undefined {
    return this.cancellationDate;
  }

  get currency(): string {
    return this.lineItems[0]!.unitPrice.currency;
  }

  get total(): Money {
    return this.lineItems.reduce((sum, item) => sum.add(item.lineTotal), Money.zero(this.currency));
  }

  cancel(at: Date): void {
    if (this.currentStatus === OrderStatus.CANCELLED) {
      throw new OrderAlreadyCancelledError(this.id.value);
    }
    this.currentStatus = OrderStatus.CANCELLED;
    this.cancellationDate = at;
    this.pendingEvents.push(new OrderCancelled(this.id.value, at, this.customerId));
  }

  pullEvents(): DomainEvent[] {
    return this.pendingEvents.splice(0);
  }

  private static assertValidItems(items: OrderItem[]): void {
    const [first, ...rest] = items;
    if (!first) {
      throw new EmptyOrderError();
    }
    const mismatch = rest.find((item) => item.unitPrice.currency !== first.unitPrice.currency);
    if (mismatch) {
      throw new CurrencyMismatchError(first.unitPrice.currency, mismatch.unitPrice.currency);
    }
  }
}
