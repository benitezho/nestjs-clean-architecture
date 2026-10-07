import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsInt,
  IsNotEmpty,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

export class MoneyRequest {
  @ApiProperty({ description: 'Amount in minor units (e.g. cents)', example: 1999 })
  @IsInt()
  @Min(0)
  @Max(Number.MAX_SAFE_INTEGER)
  amount!: number;

  @ApiProperty({ description: 'ISO 4217 code', example: 'USD' })
  @Matches(/^[A-Z]{3}$/, { message: 'currency must be a 3-letter uppercase ISO 4217 code' })
  currency!: string;
}

export class OrderItemRequest {
  @ApiProperty({ example: 'SKU-123' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  sku!: string;

  @ApiProperty({ example: 'Ceramic mug' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  name!: string;

  @ApiProperty({ minimum: 1, example: 2 })
  @IsInt()
  @Min(1)
  @Max(10_000)
  quantity!: number;

  @ApiProperty({ type: MoneyRequest })
  @ValidateNested()
  @Type(() => MoneyRequest)
  unitPrice!: MoneyRequest;
}

export class PlaceOrderRequest {
  @ApiProperty({ example: 'customer-42' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  customerId!: string;

  @ApiProperty({ type: [OrderItemRequest], minItems: 1, maxItems: 100 })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => OrderItemRequest)
  items!: OrderItemRequest[];
}
