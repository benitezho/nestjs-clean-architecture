import type { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateIdempotencyKeys1790000000002 implements MigrationInterface {
  name = 'CreateIdempotencyKeys1790000000002';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "idempotency_keys" (
        "scope" character varying(64) NOT NULL,
        "key" character varying(255) NOT NULL,
        "request_hash" character(64) NOT NULL,
        "response_status" integer,
        "response_body" jsonb,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "pk_idempotency_keys" PRIMARY KEY ("scope", "key")
      )`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "idempotency_keys"`);
  }
}
