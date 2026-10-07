import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Res,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiHeader,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiTags,
  ApiUnprocessableEntityResponse,
} from '@nestjs/swagger';
import type { Response } from 'express';
import { hashRequest } from '../../../../shared/idempotency/request-hash';
import {
  IdempotencyService,
  type StoredResponse,
} from '../../../../shared/idempotency/idempotency.service';
import { CancelOrder } from '../../application/use-cases/cancel-order.use-case';
import { GetOrder } from '../../application/use-cases/get-order.use-case';
import { ListOrders } from '../../application/use-cases/list-orders.use-case';
import { PlaceOrder } from '../../application/use-cases/place-order.use-case';
import { decodeCursor, encodeCursor } from './cursor.codec';
import { ListOrdersQuery } from './dto/list-orders.query';
import { OrderListResponse, OrderResponse } from './dto/order.response';
import { PlaceOrderRequest } from './dto/place-order.request';
import { presentOrder } from './order.presenter';

const PLACE_ORDER_SCOPE = 'POST /orders';

@ApiTags('orders')
@Controller('orders')
export class OrdersController {
  constructor(
    private readonly placeOrder: PlaceOrder,
    private readonly cancelOrder: CancelOrder,
    private readonly getOrder: GetOrder,
    private readonly listOrders: ListOrders,
    private readonly idempotency: IdempotencyService,
  ) {}

  @Post()
  @ApiHeader({
    name: 'Idempotency-Key',
    required: false,
    description:
      'Replays the stored response when repeated with the same body; 422 if the body differs.',
  })
  @ApiCreatedResponse({ type: OrderResponse })
  @ApiBadRequestResponse({ description: 'Validation failed (application/problem+json)' })
  @ApiUnprocessableEntityResponse({ description: 'Business rule or Idempotency-Key violated' })
  async place(
    @Body() body: PlaceOrderRequest,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Res({ passthrough: true }) res: Response,
  ): Promise<Record<string, unknown>> {
    const handler = async (): Promise<StoredResponse> => ({
      status: 201,
      body: { ...presentOrder(await this.placeOrder.execute(body)) },
    });
    const { replayed, response } =
      idempotencyKey === undefined
        ? { replayed: false, response: await handler() }
        : await this.idempotency.execute(
            { scope: PLACE_ORDER_SCOPE, key: idempotencyKey, requestHash: hashRequest(body) },
            handler,
          );

    res.status(response.status).location(`/orders/${String(response.body.id)}`);
    if (replayed) {
      res.setHeader('Idempotent-Replayed', 'true');
    }
    return response.body;
  }

  @Get(':id')
  @ApiOkResponse({ type: OrderResponse })
  @ApiNotFoundResponse({ description: 'Order not found' })
  async get(@Param('id', ParseUUIDPipe) id: string): Promise<OrderResponse> {
    return presentOrder(await this.getOrder.execute(id));
  }

  @Get()
  @ApiOkResponse({ type: OrderListResponse })
  async list(@Query() query: ListOrdersQuery): Promise<OrderListResponse> {
    const page = await this.listOrders.execute({
      limit: query.limit,
      after: query.cursor ? decodeCursor(query.cursor) : undefined,
    });
    return {
      data: page.orders.map(presentOrder),
      nextCursor: page.nextCursor ? encodeCursor(page.nextCursor) : null,
    };
  }

  @Post(':id/cancel')
  @HttpCode(200)
  @ApiOkResponse({ type: OrderResponse })
  @ApiNotFoundResponse({ description: 'Order not found' })
  @ApiConflictResponse({ description: 'Order already cancelled or modified concurrently' })
  async cancel(@Param('id', ParseUUIDPipe) id: string): Promise<OrderResponse> {
    return presentOrder(await this.cancelOrder.execute(id));
  }
}
