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
import { OrderPersistenceMapper, type OrderRecord } from './mappers/order.persistence-mapper';
import { OutboxMessageMapper } from './mappers/outbox-message.mapper';

@Injectable()
export class TypeormOrderRepository extends OrderRepository {
  constructor(
    private readonly transactions: TransactionManager,
    private readonly outbox: OutboxWriter,
    private readonly orderMapper: OrderPersistenceMapper,
    private readonly outboxMapper: OutboxMessageMapper,
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
      await this.outbox.write(order.pullEvents().map((event) => this.outboxMapper.map(event)));
    });
  }

  async findById(id: OrderId): Promise<Order | undefined> {
    const manager = this.transactions.manager;
    const row = await manager.findOneBy(OrderEntity, { id: id.value });
    if (!row) {
      return undefined;
    }
    const [record] = await this.loadRecords(manager, [row]);
    return record && this.orderMapper.toDomain(record);
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
    const records = await this.loadRecords(manager, page);

    const last = page.at(-1);
    return {
      orders: records.map((record) => this.orderMapper.toDomain(record)),
      nextCursor:
        rows.length > limit && last ? { placedAt: last.placedAt, id: last.id } : undefined,
    };
  }

  private async insert(manager: EntityManager, order: Order): Promise<void> {
    const { order: row, items } = this.orderMapper.toPersistence(order);
    row.version = 1;
    await manager.insert(OrderEntity, row);
    await manager.insert(OrderItemEntity, items);
  }

  private async update(manager: EntityManager, order: Order): Promise<void> {
    const { order: row } = this.orderMapper.toPersistence(order);
    const result = await manager.update(
      OrderEntity,
      { id: row.id, version: order.version },
      { status: row.status, cancelledAt: row.cancelledAt, version: () => 'version + 1' },
    );
    if (result.affected !== 1) {
      throw new ConcurrentModificationError(order.id.value);
    }
  }

  private async loadRecords(manager: EntityManager, rows: OrderEntity[]): Promise<OrderRecord[]> {
    if (rows.length === 0) {
      return [];
    }
    const items = await manager.find(OrderItemEntity, {
      where: { orderId: In(rows.map((row) => row.id)) },
    });
    return rows.map((order) => ({
      order,
      items: items.filter((item) => item.orderId === order.id),
    }));
  }
}
