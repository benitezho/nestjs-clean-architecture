import { ApiProperty } from '@nestjs/swagger';

export class MoneyResponse {
  @ApiProperty({ example: 1999 }) amount!: number;
  @ApiProperty({ example: 'USD' }) currency!: string;
}

export class OrderItemResponse {
  @ApiProperty() sku!: string;
  @ApiProperty() name!: string;
  @ApiProperty() quantity!: number;
  @ApiProperty({ type: MoneyResponse }) unitPrice!: MoneyResponse;
  @ApiProperty({ type: MoneyResponse }) lineTotal!: MoneyResponse;
}

export class OrderResponse {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty() customerId!: string;
  @ApiProperty({ enum: ['PLACED', 'CANCELLED'] }) status!: string;
  @ApiProperty({ type: [OrderItemResponse] }) items!: OrderItemResponse[];
  @ApiProperty({ type: MoneyResponse }) total!: MoneyResponse;
  @ApiProperty({ format: 'date-time' }) placedAt!: string;
  @ApiProperty({ format: 'date-time', nullable: true, type: String }) cancelledAt!: string | null;
}

export class OrderListResponse {
  @ApiProperty({ type: [OrderResponse] }) data!: OrderResponse[];
  @ApiProperty({
    nullable: true,
    type: String,
    description: 'Pass as `cursor` to get the next page',
  })
  nextCursor!: string | null;
}
