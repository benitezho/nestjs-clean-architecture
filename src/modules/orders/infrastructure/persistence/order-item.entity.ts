import { Column, Entity, JoinColumn, ManyToOne, PrimaryColumn, type Relation } from 'typeorm';
import { bigintTransformer } from '../../../../shared/database/bigint.transformer';
import { OrderEntity } from './order.entity';

@Entity({ name: 'order_items' })
export class OrderItemEntity {
  @PrimaryColumn({ name: 'order_id', type: 'uuid', primaryKeyConstraintName: 'pk_order_items' })
  orderId!: string;

  @PrimaryColumn({ type: 'int', primaryKeyConstraintName: 'pk_order_items' })
  position!: number;

  @Column({ type: 'varchar', length: 64 })
  sku!: string;

  @Column({ type: 'varchar', length: 200 })
  name!: string;

  @Column({ type: 'int' })
  quantity!: number;

  @Column({ name: 'unit_price_amount', type: 'bigint', transformer: bigintTransformer })
  unitPriceAmount!: number;

  @ManyToOne(() => OrderEntity, (order) => order.items, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'order_id', foreignKeyConstraintName: 'fk_order_items_order' })
  order?: Relation<OrderEntity>;
}
