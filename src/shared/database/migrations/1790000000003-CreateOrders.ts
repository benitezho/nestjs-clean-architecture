import type { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateOrders1790000000003 implements MigrationInterface {
  name = 'CreateOrders1790000000003';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "orders" (
        "id" uuid NOT NULL,
        "customer_id" character varying(64) NOT NULL,
        "status" character varying(16) NOT NULL,
        "currency" character(3) NOT NULL,
        "total_amount" bigint NOT NULL,
        "placed_at" TIMESTAMP WITH TIME ZONE NOT NULL,
        "cancelled_at" TIMESTAMP WITH TIME ZONE,
        "version" integer NOT NULL,
        CONSTRAINT "pk_orders" PRIMARY KEY ("id")
      )`);
    await queryRunner.query(
      `CREATE INDEX "idx_orders_placed_at_id" ON "orders" ("placed_at", "id")`,
    );
    await queryRunner.query(`
      CREATE TABLE "order_items" (
        "order_id" uuid NOT NULL,
        "position" integer NOT NULL,
        "sku" character varying(64) NOT NULL,
        "name" character varying(200) NOT NULL,
        "quantity" integer NOT NULL,
        "unit_price_amount" bigint NOT NULL,
        CONSTRAINT "pk_order_items" PRIMARY KEY ("order_id", "position")
      )`);
    await queryRunner.query(`
      ALTER TABLE "order_items"
        ADD CONSTRAINT "fk_order_items_order" FOREIGN KEY ("order_id")
        REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "order_items"`);
    await queryRunner.query(`DROP INDEX "idx_orders_placed_at_id"`);
    await queryRunner.query(`DROP TABLE "orders"`);
  }
}
