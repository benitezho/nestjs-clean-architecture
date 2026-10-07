import { Column, Entity, Index, OneToMany, PrimaryColumn, type Relation } from 'typeorm';
import { bigintTransformer } from '../../../../shared/database/bigint.transformer';
import { OrderItemEntity } from './order-item.entity';

@Entity({ name: 'orders' })
@Index('idx_orders_placed_at_id', ['placedAt', 'id'])
export class OrderEntity {
  @PrimaryColumn({ type: 'uuid', primaryKeyConstraintName: 'pk_orders' })
  id!: string;

  @Column({ name: 'customer_id', type: 'varchar', length: 64 })
  customerId!: string;

  @Column({ type: 'varchar', length: 16 })
  status!: string;

  @Column({ type: 'char', length: 3 })
  currency!: string;

  @Column({ name: 'total_amount', type: 'bigint', transformer: bigintTransformer })
  totalAmount!: number;

  @Column({ name: 'placed_at', type: 'timestamptz' })
  placedAt!: Date;

  @Column({ name: 'cancelled_at', type: 'timestamptz', nullable: true })
  cancelledAt!: Date | null;

  @Column({ type: 'int' })
  version!: number;

  @OneToMany(() => OrderItemEntity, (item) => item.order)
  items?: Relation<OrderItemEntity>[];
}
