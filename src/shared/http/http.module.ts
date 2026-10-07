import { Module } from '@nestjs/common';
import { APP_FILTER, APP_PIPE } from '@nestjs/core';
import { GlobalExceptionFilter } from './global-exception.filter';
import { createValidationPipe } from './validation.pipe';

@Module({
  providers: [
    { provide: APP_FILTER, useClass: GlobalExceptionFilter },
    { provide: APP_PIPE, useFactory: createValidationPipe },
  ],
})
export class HttpModule {}
