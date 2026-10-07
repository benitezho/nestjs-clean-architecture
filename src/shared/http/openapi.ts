import type { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

export function setupOpenApi(app: INestApplication): void {
  const document = SwaggerModule.createDocument(
    app,
    new DocumentBuilder()
      .setTitle('Orders API')
      .setDescription('Errors are returned as RFC 9457 application/problem+json.')
      .setVersion('1.0.0')
      .build(),
  );
  SwaggerModule.setup('docs', app, document);
}
