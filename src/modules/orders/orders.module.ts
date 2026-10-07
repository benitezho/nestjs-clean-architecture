import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../shared/database/database.module';
import { IdempotencyModule } from '../../shared/idempotency/idempotency.module';
import { OutboxModule } from '../../shared/outbox/outbox.module';
import { Clock } from './application/ports/clock';
import { IdGenerator } from './application/ports/id-generator';
import { OrderRepository } from './application/ports/order.repository';
import { UnitOfWork } from './application/ports/unit-of-work';
import { CancelOrder } from './application/use-cases/cancel-order.use-case';
import { GetOrder } from './application/use-cases/get-order.use-case';
import { ListOrders } from './application/use-cases/list-orders.use-case';
import { PlaceOrder } from './application/use-cases/place-order.use-case';
import { TypeormOrderRepository } from './infrastructure/persistence/typeorm-order.repository';
import { SystemClock } from './infrastructure/system-clock';
import { TypeormUnitOfWork } from './infrastructure/typeorm-unit-of-work';
import { UuidIdGenerator } from './infrastructure/uuid-id-generator';
import { OrdersController } from './interface/http/orders.controller';

/** Use cases are plain classes; the module is the only place that wires them to adapters. */
@Module({
  imports: [DatabaseModule, OutboxModule, IdempotencyModule],
  controllers: [OrdersController],
  providers: [
    { provide: Clock, useClass: SystemClock },
    { provide: IdGenerator, useClass: UuidIdGenerator },
    { provide: UnitOfWork, useClass: TypeormUnitOfWork },
    { provide: OrderRepository, useClass: TypeormOrderRepository },
    {
      provide: PlaceOrder,
      inject: [OrderRepository, UnitOfWork, Clock, IdGenerator],
      useFactory: (...deps: ConstructorParameters<typeof PlaceOrder>) => new PlaceOrder(...deps),
    },
    {
      provide: CancelOrder,
      inject: [OrderRepository, UnitOfWork, Clock],
      useFactory: (...deps: ConstructorParameters<typeof CancelOrder>) => new CancelOrder(...deps),
    },
    {
      provide: GetOrder,
      inject: [OrderRepository],
      useFactory: (...deps: ConstructorParameters<typeof GetOrder>) => new GetOrder(...deps),
    },
    {
      provide: ListOrders,
      inject: [OrderRepository],
      useFactory: (...deps: ConstructorParameters<typeof ListOrders>) => new ListOrders(...deps),
    },
  ],
})
export class OrdersModule {}
