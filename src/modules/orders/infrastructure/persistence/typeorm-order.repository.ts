import { Injectable } from '@nestjs/common';
import { EntityManager, In } from 'typeorm';
import { ConcurrentModificationError } from '../../application/errors/order-errors';
import {
  OrderRepository,
  type ListOrdersQuery,
  type OrderPage,
} from '../../application/ports/order.repository';
import type { Order } from '../../domain/order';
import type { OrderId } from '../../domain/order-id';
import { TransactionManager } from '../../../../shared/database/transaction-manager';
import { OutboxWriter } from '../../../../shared/outbox/outbox-writer';
import { OrderItemEntity } from './order-item.entity';
import { OrderEntity } from './order.entity';
import { OrderMapper } from './order.mapper';
import { toOutboxMessage } from './outbox-message.mapper';

@Injectable()
export class TypeormOrderRepository extends OrderRepository {
  constructor(
    private readonly transactions: TransactionManager,
    private readonly outbox: OutboxWriter,
  ) {
    super();
  }

  save(order: Order): Promise<void> {
    return this.transactions.run(async () => {
      const manager = this.transactions.manager;
      if (order.version === 0) {
        await this.insert(manager, order);
      } else {
        await this.update(manager, order);
      }
      await this.outbox.write(order.pullEvents().map(toOutboxMessage));
    });
  }

  async findById(id: OrderId): Promise<Order | undefined> {
    const row = await this.transactions.manager.findOne(OrderEntity, {
      where: { id: id.value },
      relations: { items: true },
    });
    return row ? OrderMapper.toDomain(row) : undefined;
  }

  async list({ limit, after }: ListOrdersQuery): Promise<OrderPage> {
    const manager = this.transactions.manager;
    const query = manager
      .createQueryBuilder(OrderEntity, 'o')
      .orderBy('o.placedAt', 'DESC')
      .addOrderBy('o.id', 'DESC')
      .limit(limit + 1);
    if (after) {
      query.where('(o.placed_at, o.id) < (:placedAt, :id)', {
        placedAt: after.placedAt,
        id: after.id,
      });
    }
    const rows = await query.getMany();
    const page = rows.slice(0, limit);
    await this.attachItems(manager, page);

    const last = page.at(-1);
    return {
      orders: page.map((row) => OrderMapper.toDomain(row)),
      nextCursor:
        rows.length > limit && last ? { placedAt: last.placedAt, id: last.id } : undefined,
    };
  }

  private async insert(manager: EntityManager, order: Order): Promise<void> {
    const { order: row, items } = OrderMapper.toEntity(order);
    row.version = 1;
    await manager.insert(OrderEntity, row);
    await manager.insert(OrderItemEntity, items);
  }

  private async update(manager: EntityManager, order: Order): Promise<void> {
    const { order: row } = OrderMapper.toEntity(order);
    const result = await manager.update(
      OrderEntity,
      { id: row.id, version: order.version },
      { status: row.status, cancelledAt: row.cancelledAt, version: () => 'version + 1' },
    );
    if (result.affected !== 1) {
      throw new ConcurrentModificationError(order.id.value);
    }
  }

  private async attachItems(manager: EntityManager, rows: OrderEntity[]): Promise<void> {
    if (rows.length === 0) {
      return;
    }
    const items = await manager.find(OrderItemEntity, {
      where: { orderId: In(rows.map((row) => row.id)) },
    });
    for (const row of rows) {
      row.items = items.filter((item) => item.orderId === row.id);
    }
  }
}
